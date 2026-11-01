-- 0007_hardening.sql — fixes from the code review before competitions are built.
--
-- 1. Points cannot be inflated by calling save_week_plan from the browser: only the current
--    or next week, and at most the number of tasks a real plan has per day and type.
-- 2. A task can be marked only on its own day or the day after (time-zone slack), so points
--    cannot be "filled in" weeks later.
-- 3. A daily per-user limit on AI calls (the free Gemini quota is shared by everyone).
-- 4. audit_logs is written for content changes and for disabling a user.
-- 5. A user cannot change profiles.disabled_at on their own row.

-- ───────────────────────── 1. save_week_plan ─────────────────────────
-- Most tasks of one type per day that a generated plan can hold (src/lib/plan/generate.ts).
create or replace function public.task_daily_cap(p_type text) returns int
language sql immutable set search_path = '' as $$
  select case p_type when 'meal' then 6 when 'habit' then 2 else 1 end;
$$;

create or replace function public.save_week_plan(p_week_start date, p_plan jsonb, p_tasks jsonb, p_meta jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  next_version int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if extract(dow from p_week_start) <> 0 then raise exception 'a plan week starts on Sunday'; end if;
  -- The week that holds yesterday (time-zone slack) up to next week. Past weeks are closed.
  if p_week_start + 6 < current_date - 1 or p_week_start > current_date + 8 then
    raise exception 'plan week out of range';
  end if;
  if jsonb_typeof(p_plan) <> 'object' then raise exception 'plan must be an object'; end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) > 84 then raise exception 'invalid tasks'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_tasks) e
    group by e->>'date', e->>'type'
    having count(*) > public.task_daily_cap(e->>'type')
  ) then
    raise exception 'too many tasks of one type in a day';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
    from public.plans where user_id = uid and week_start = p_week_start;

  update public.plans set status = 'superseded'
    where user_id = uid and week_start = p_week_start and status = 'active';

  insert into public.plans (user_id, week_start, status, version, plan_json, generation_meta)
    values (uid, p_week_start, 'active', next_version, p_plan, coalesce(p_meta, '{}'))
    returning id into new_id;

  -- Keep completed tasks of earlier versions of this week.
  update public.daily_tasks d set plan_id = new_id
    from public.plans p
    where d.plan_id = p.id and p.user_id = uid and p.week_start = p_week_start and p.id <> new_id
      and exists (select 1 from public.task_completions c where c.task_id = d.id);

  insert into public.daily_tasks (plan_id, user_id, date, type, title, ref, points, sort_order)
    select new_id, uid, (e->>'date')::date, e->>'type', left(e->>'title', 200),
           coalesce(e->'ref', '{}'), public.task_points(e->>'type'), coalesce((e->>'sort_order')::smallint, 0)
    from jsonb_array_elements(p_tasks) e
    where not exists (
      select 1 from public.daily_tasks k
      where k.plan_id = new_id and k.date = (e->>'date')::date and k.sort_order = coalesce((e->>'sort_order')::smallint, 0)
    );

  if exists (select 1 from public.daily_tasks where plan_id = new_id and (date < p_week_start or date > p_week_start + 6)) then
    raise exception 'task outside the plan week';
  end if;
  return new_id;
end $$;

-- ───────────────────────── 2. marking window ─────────────────────────
create or replace function public.assert_task_markable(p_date date) returns void
language plpgsql stable set search_path = '' as $$
begin
  -- One day of slack each way covers Israel vs UTC.
  if p_date > current_date + 1 then raise exception 'cannot mark a future task'; end if;
  if p_date < current_date - 1 then raise exception 'too late to change this task'; end if;
end $$;

create or replace function public.set_task_outcome(p_task_id uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t public.daily_tasks;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into t from public.daily_tasks where id = p_task_id and user_id = uid;
  if not found then raise exception 'task not found'; end if;
  perform public.assert_task_markable(t.date);

  if p_outcome in ('pending', 'skipped') then
    delete from public.task_completions where task_id = t.id;
  elsif p_outcome in ('done', 'partial', 'swapped') then
    insert into public.task_completions (task_id, user_id, outcome, points_awarded)
      values (t.id, uid, p_outcome, case when p_outcome = 'partial' then ceil(t.points / 2.0)::smallint else t.points end)
      on conflict (task_id) do update
        set outcome = excluded.outcome, points_awarded = excluded.points_awarded, completed_at = now();
  else
    raise exception 'unknown outcome %', p_outcome;
  end if;
  update public.daily_tasks set status = p_outcome where id = t.id;
end $$;

create or replace function public.set_task_outcome_as(p_user uuid, p_task_id uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.daily_tasks;
begin
  perform public.assert_service_role();
  select * into t from public.daily_tasks where id = p_task_id and user_id = p_user;
  if not found then raise exception 'task not found'; end if;
  perform public.assert_task_markable(t.date);
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

-- ───────────────────────── 3. AI quota ─────────────────────────
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  kind text not null check (kind in ('food_estimate', 'coach')),
  calls int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_read_own on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;

-- Counts one call and says whether it is within today's limit. Atomic, so parallel calls
-- cannot slip past the limit.
create or replace function public.take_ai_quota_for(p_user uuid, p_kind text, p_limit int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if p_user is distinct from auth.uid() and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not allowed';
  end if;
  insert into public.ai_usage (user_id, day, kind, calls) values (p_user, current_date, p_kind, 1)
    on conflict (user_id, day, kind) do update set calls = public.ai_usage.calls + 1
    returning calls into n;
  return n <= p_limit;
end $$;

create or replace function public.take_ai_quota(p_kind text, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return public.take_ai_quota_for(auth.uid(), p_kind, p_limit);
end $$;

create or replace function public.take_ai_quota_as(p_user uuid, p_kind text, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_service_role();
  return public.take_ai_quota_for(p_user, p_kind, p_limit);
end $$;

revoke all on function public.take_ai_quota_for(uuid, text, int) from public, anon, authenticated;
revoke all on function public.take_ai_quota(text, int) from public, anon;
revoke all on function public.take_ai_quota_as(uuid, text, int) from public, anon, authenticated;
grant execute on function public.take_ai_quota(text, int) to authenticated;

-- ───────────────────────── 4. audit log ─────────────────────────
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (actor, action, entity, entity_id, meta)
    values (auth.uid(), lower(tg_op), tg_table_name, coalesce(rec->>'id', rec->>'slug', rec->>'user_id'),
            case when tg_op = 'UPDATE'
                 then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
                 else jsonb_build_object('row', rec) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['exercises', 'meal_ideas', 'muscles'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
end $$;

-- ───────────────────────── 5. disabled_at ─────────────────────────
create or replace function public.guard_profile_admin_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.disabled_at is distinct from old.disabled_at then
    if public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
      insert into public.audit_logs (actor, action, entity, entity_id, meta)
        values (auth.uid(), case when new.disabled_at is null then 'enable' else 'disable' end, 'profiles', new.user_id::text, '{}');
    else
      new.disabled_at := old.disabled_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_admin_fields on public.profiles;
create trigger profiles_guard_admin_fields before update on public.profiles
  for each row execute function public.guard_profile_admin_fields();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.ai_usage to service_role;
    grant execute on function public.take_ai_quota_as(uuid, text, int) to service_role;
  end if;
end $$;
