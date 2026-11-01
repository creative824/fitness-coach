-- 0005_food_log.sql — follow-up spec §7, §10: free-text food log with AI estimates.
--
-- One row per reported meal (food_logs) and its items (food_log_items). Values are estimates,
-- always stored as a range (kcal_min..kcal_max). Rows belong to their user only (RLS).
-- A daily summary is computed when read, not stored, so it can never drift from the items.
-- No points are given for food logs, and nothing rewards eating less.

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,                                  -- the user's local date
  logged_at timestamptz not null default now(),
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')),
  free_text text not null check (char_length(free_text) between 1 and 1000),
  status text not null default 'confirmed' check (status in ('draft','confirmed')),
  source text not null default 'web' check (source in ('web','telegram')),
  -- Set by the client for each save; a retried request with the same ref is ignored.
  client_ref uuid unique,
  estimated boolean not null default false,            -- true when an AI estimate was used
  confirmed_at timestamptz
);
create index if not exists food_logs_user_date on public.food_logs (user_id, date);

create table if not exists public.food_log_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null references public.food_logs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  item_name text not null check (char_length(item_name) between 1 and 120),
  quantity numeric(7,2) check (quantity is null or quantity > 0),
  unit text check (char_length(unit) <= 30),
  preparation text check (char_length(preparation) <= 60),
  kcal_min smallint check (kcal_min between 0 and 5000),
  kcal_max smallint check (kcal_max between 0 and 5000),
  protein_g numeric(6,1) check (protein_g between 0 and 500),
  carbs_g numeric(6,1) check (carbs_g between 0 and 1000),
  fat_g numeric(6,1) check (fat_g between 0 and 500),
  confidence text check (confidence in ('low','medium','high')),
  sort_order smallint not null default 0,
  check (kcal_min is null or kcal_max is null or kcal_min <= kcal_max)
);
create index if not exists food_log_items_log on public.food_log_items (food_log_id);

alter table public.food_logs enable row level security;
alter table public.food_log_items enable row level security;
drop policy if exists food_logs_own on public.food_logs;
create policy food_logs_own on public.food_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists food_log_items_own on public.food_log_items;
create policy food_log_items_own on public.food_log_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.food_logs f where f.id = food_log_id and f.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.food_logs, public.food_log_items to authenticated;

-- Calorie tracking can be switched off; the log then keeps text and habits only.
alter table public.profiles add column if not exists calorie_tracking boolean not null default true;

-- Saves one meal and its items in one step, as the caller (RLS applies). A repeated
-- client_ref returns the existing row instead of saving twice.
create or replace function public.save_food_log(
  p_date date, p_meal_type text, p_text text, p_status text, p_source text, p_client_ref uuid, p_estimated boolean, p_items jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then raise exception 'invalid items'; end if;
  if p_client_ref is not null then
    select id into new_id from public.food_logs where client_ref = p_client_ref and user_id = uid;
    if new_id is not null then return new_id; end if;
  end if;

  insert into public.food_logs (user_id, date, meal_type, free_text, status, source, client_ref, estimated, confirmed_at)
    values (uid, p_date, p_meal_type, p_text, p_status, coalesce(p_source, 'web'), p_client_ref, coalesce(p_estimated, false),
            case when p_status = 'confirmed' then now() end)
    returning id into new_id;

  insert into public.food_log_items (food_log_id, user_id, item_name, quantity, unit, preparation, kcal_min, kcal_max, protein_g, carbs_g, fat_g, confidence, sort_order)
    select new_id, uid, left(e->>'item_name', 120), nullif(e->>'quantity', '')::numeric, left(e->>'unit', 30), left(e->>'preparation', 60),
           nullif(e->>'kcal_min', '')::smallint, nullif(e->>'kcal_max', '')::smallint,
           nullif(e->>'protein_g', '')::numeric, nullif(e->>'carbs_g', '')::numeric, nullif(e->>'fat_g', '')::numeric,
           e->>'confidence', (ord - 1)::smallint
    from jsonb_array_elements(p_items) with ordinality as t(e, ord);
  return new_id;
end $$;

revoke all on function public.save_food_log(date, text, text, text, text, uuid, boolean, jsonb) from public, anon;
grant execute on function public.save_food_log(date, text, text, text, text, uuid, boolean, jsonb) to authenticated;
