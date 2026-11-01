-- 0006_telegram.sql — follow-up spec §9: a Telegram bot as another way into the same account.
--
-- Linking uses a one-time code with an expiry, never a username. Only a hash of the code is
-- stored. The bot's server (the webhook) works with the service role, and only through the
-- *_as functions below, which refuse any other caller. Users can see and delete their own link.

create table if not exists public.telegram_links (
  user_id uuid primary key references auth.users on delete cascade,
  telegram_user_id bigint not null unique,
  chat_id bigint not null,
  linked_at timestamptz not null default now()
);

create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists telegram_link_tokens_user on public.telegram_link_tokens (user_id);

-- Every Telegram update id is stored once, so a webhook retry is not handled twice.
create table if not exists public.telegram_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_updates enable row level security;   -- no policies: service role only

drop policy if exists telegram_links_read_own on public.telegram_links;
create policy telegram_links_read_own on public.telegram_links for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists telegram_links_delete_own on public.telegram_links;
create policy telegram_links_delete_own on public.telegram_links for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists telegram_tokens_own on public.telegram_link_tokens;
create policy telegram_tokens_own on public.telegram_link_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, delete on public.telegram_links to authenticated;
grant select, insert, delete on public.telegram_link_tokens to authenticated;

-- Refuses any caller except the service role (the bot's server).
create or replace function public.assert_service_role() returns void
language plpgsql stable set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'not allowed'; end if;
end $$;

-- Links a Telegram account with a one-time code. Returns the user id, or null when the code is
-- wrong, used or expired. A Telegram account can be linked to one site account at a time.
create or replace function public.telegram_link_as(p_token_hash text, p_telegram_user_id bigint, p_chat_id bigint)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.telegram_link_tokens;
begin
  perform public.assert_service_role();
  update public.telegram_link_tokens set used_at = now()
    where token_hash = p_token_hash and used_at is null and expires_at > now()
    returning * into t;
  if not found then return null; end if;
  delete from public.telegram_links where telegram_user_id = p_telegram_user_id or user_id = t.user_id;
  insert into public.telegram_links (user_id, telegram_user_id, chat_id) values (t.user_id, p_telegram_user_id, p_chat_id);
  delete from public.telegram_link_tokens where user_id = t.user_id and id <> t.id;
  return t.user_id;
end $$;

-- Marks a task for a linked user, with the same rules as set_task_outcome.
create or replace function public.set_task_outcome_as(p_user uuid, p_task_id uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.daily_tasks;
begin
  perform public.assert_service_role();
  select * into t from public.daily_tasks where id = p_task_id and user_id = p_user;
  if not found then raise exception 'task not found'; end if;
  if t.date > current_date + 1 then raise exception 'cannot mark a future task'; end if;
  if p_outcome in ('pending', 'skipped') then
    delete from public.task_completions where task_id = t.id;
  elsif p_outcome in ('done', 'partial', 'swapped') then
    insert into public.task_completions (task_id, user_id, outcome, points_awarded)
      values (t.id, p_user, p_outcome, case when p_outcome = 'partial' then ceil(t.points / 2.0)::smallint else t.points end)
      on conflict (task_id) do update
        set outcome = excluded.outcome, points_awarded = excluded.points_awarded, completed_at = now();
  else
    raise exception 'unknown outcome %', p_outcome;
  end if;
  update public.daily_tasks set status = p_outcome where id = t.id;
end $$;

-- Saves a meal reported in Telegram as a draft, with its items, in one step.
create or replace function public.save_food_log_as(p_user uuid, p_date date, p_text text, p_estimated boolean, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  perform public.assert_service_role();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then raise exception 'invalid items'; end if;
  insert into public.food_logs (user_id, date, free_text, status, source, estimated)
    values (p_user, p_date, left(p_text, 1000), 'draft', 'telegram', coalesce(p_estimated, false))
    returning id into new_id;
  insert into public.food_log_items (food_log_id, user_id, item_name, quantity, unit, preparation, kcal_min, kcal_max, protein_g, carbs_g, fat_g, confidence, sort_order)
    select new_id, p_user, left(e->>'item_name', 120), nullif(e->>'quantity', '')::numeric, left(e->>'unit', 30), left(e->>'preparation', 60),
           nullif(e->>'kcal_min', '')::smallint, nullif(e->>'kcal_max', '')::smallint,
           nullif(e->>'protein_g', '')::numeric, nullif(e->>'carbs_g', '')::numeric, nullif(e->>'fat_g', '')::numeric,
           e->>'confidence', (ord - 1)::smallint
    from jsonb_array_elements(p_items) with ordinality as t(e, ord);
  return new_id;
end $$;

revoke all on function public.assert_service_role() from public, anon;
revoke all on function public.telegram_link_as(text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.set_task_outcome_as(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.save_food_log_as(uuid, date, text, boolean, jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.telegram_links, public.telegram_link_tokens, public.telegram_updates to service_role;
    grant execute on function public.assert_service_role() to service_role;
    grant execute on function public.telegram_link_as(text, bigint, bigint) to service_role;
    grant execute on function public.set_task_outcome_as(uuid, uuid, text) to service_role;
    grant execute on function public.save_food_log_as(uuid, date, text, boolean, jsonb) to service_role;
  end if;
end $$;
