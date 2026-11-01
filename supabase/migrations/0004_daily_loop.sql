-- 0004_daily_loop.sql — phase 3: save a weekly plan and score tasks.
--
-- plans, daily_tasks and task_completions stay read-only for users (0001). The two functions
-- below are the only way to write them. They run with the owner's rights but act only on the
-- caller's own rows (auth.uid()), and they set the points themselves, so a user cannot award
-- themselves points or score a task twice.

-- Points per task type (spec §12). Mirrored in src/lib/plan/tasks.ts for display only.
create or replace function public.task_points(p_type text) returns smallint
language sql immutable set search_path = '' as $$
  select (case p_type when 'workout' then 20 else 5 end)::smallint;
$$;

-- Saves a new version of the caller's plan for a week and its daily tasks.
-- Tasks that were already completed on the previous version are kept (moved to the new
-- version), so regenerating a plan never loses or doubles points.
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
  if jsonb_typeof(p_plan) <> 'object' then raise exception 'plan must be an object'; end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) > 84 then raise exception 'invalid tasks'; end if;

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
  if exists (select 1 from public.daily_tasks where plan_id = new_id group by date having count(*) > 12) then
    raise exception 'too many tasks in one day';
  end if;
  return new_id;
end $$;

-- Marks one of the caller's tasks. 'pending' undoes a mark. Points come from the task row,
-- partial counts half (rounded up). One completion row per task (primary key) = no double scoring.
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
  -- Tasks of future days cannot be marked. One day of slack covers time-zone edges.
  if t.date > current_date + 1 then raise exception 'cannot mark a future task'; end if;

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

revoke all on function public.save_week_plan(date, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.set_task_outcome(uuid, text) from public, anon;
grant execute on function public.save_week_plan(date, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.set_task_outcome(uuid, text) to authenticated;
grant execute on function public.task_points(text) to authenticated;

-- Today screen and progress read tasks by user and date.
create index if not exists task_completions_user on public.task_completions (user_id, completed_at);
create index if not exists weight_logs_user_date on public.weight_logs (user_id, date);
