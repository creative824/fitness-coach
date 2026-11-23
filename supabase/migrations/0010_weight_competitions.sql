-- 0010_weight_competitions.sql — diet competitions: the winner lost the largest share of their
-- own body weight.
--
-- Rules:
-- - The score is the percent of body weight lost between the weigh-in at the start (the last
--   weight up to 7 days before the member's first day, or else the first one in the
--   competition) and the latest weigh-in. It is kept in tenths of a percent (34 = 3.4%).
-- - Only a healthy pace counts: at most 1% of body weight a week (and at least 1% in total).
--   Losing faster brings no extra points, so crash dieting cannot win. A gain counts as 0.
-- - A member needs two weigh-ins to have a score. Other members see only the percent, never a
--   weight in kilograms.
-- - Someone whose health answers rule out a weight-loss goal (pregnancy, an eating disorder,
--   underweight...) cannot create or join this kind of competition.

alter table public.leaderboards drop constraint if exists leaderboards_kind_check;
alter table public.leaderboards add constraint leaderboards_kind_check
  check (kind in ('consistency', 'habits', 'water', 'weight_loss'));

-- True when the caller's health answers allow a weight-loss competition.
create or replace function public.can_join_weight_competition() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select not coalesce((p.safety_flags->'result'->'restrictions'->>'noWeightLossGoal')::boolean, false)
       and not coalesce((p.safety_flags->'result'->'restrictions'->>'hideWeightTracking')::boolean, false)
    from public.profiles p where p.user_id = auth.uid()
  ), true);
$$;

-- Same as in 0008, plus the health check for weight-loss competitions.
create or replace function public.create_leaderboard(
  p_name text, p_kind text, p_start date, p_end date, p_display_name text, p_code_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_kind = 'weight_loss' and not public.can_join_weight_competition() then raise exception 'not suitable for weight loss'; end if;
  if p_start < current_date - 1 or p_start > current_date + 30 then raise exception 'start date out of range'; end if;
  if (select count(*) from public.leaderboard_members m join public.leaderboards b on b.id = m.leaderboard_id
      where m.user_id = uid and m.left_at is null and b.cancelled_at is null and b.finalized_at is null) >= 10 then
    raise exception 'too many active competitions';
  end if;
  insert into public.leaderboards (name, owner_id, kind, start_date, end_date, invite_code_hash)
    values (btrim(p_name), uid, p_kind, p_start, p_end, p_code_hash)
    returning id into new_id;
  insert into public.leaderboard_members (leaderboard_id, user_id, display_name, role)
    values (new_id, uid, btrim(p_display_name), 'owner');
  insert into public.audit_logs (actor, action, entity, entity_id) values (uid, 'create', 'leaderboards', new_id::text);
  return new_id;
end $$;

create or replace function public.join_leaderboard(p_code_hash text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.leaderboards;
  n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into b from public.leaderboards where invite_code_hash = p_code_hash for update;
  if not found then return null; end if;
  if b.cancelled_at is not null or b.finalized_at is not null or b.end_date < current_date then
    raise exception 'competition is over';
  end if;
  if exists (select 1 from public.leaderboard_members where leaderboard_id = b.id and user_id = uid and left_at is null) then
    return b.id;
  end if;
  if b.kind = 'weight_loss' and not public.can_join_weight_competition() then raise exception 'not suitable for weight loss'; end if;
  if exists (select 1 from public.leaderboard_members where leaderboard_id = b.id and user_id = uid and removed_at is not null) then
    raise exception 'removed from this competition';
  end if;
  select count(*) into n from public.leaderboard_members where leaderboard_id = b.id and left_at is null;
  if n >= b.max_members then raise exception 'competition is full'; end if;
  if (select count(*) from public.leaderboard_members m join public.leaderboards x on x.id = m.leaderboard_id
      where m.user_id = uid and m.left_at is null and x.cancelled_at is null and x.finalized_at is null) >= 10 then
    raise exception 'too many active competitions';
  end if;
  insert into public.leaderboard_members (leaderboard_id, user_id, display_name, role)
    values (b.id, uid, btrim(p_display_name), 'member')
    on conflict (leaderboard_id, user_id) do update
      set left_at = null, joined_at = now(), display_name = excluded.display_name;
  return b.id;
end $$;

-- Standings. For 'weight_loss' the score is tenths of a percent lost (capped at a healthy
-- pace), done = weigh-ins in the competition and planned = 0. Other kinds are as in 0008.
create or replace function public.leaderboard_standings(p_id uuid)
returns table (member_key text, display_name text, is_me boolean, is_owner boolean, done int, planned int, score int, rank int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b public.leaderboards;
begin
  if not public.is_leaderboard_member(p_id) then raise exception 'not a member'; end if;
  select * into b from public.leaderboards where id = p_id;

  if b.kind = 'weight_loss' then
    return query
    with m as (
      select lm.user_id, lm.display_name, lm.role,
             greatest(b.start_date, lm.joined_at::date) as from_day,
             least(b.end_date, current_date, coalesce(b.cancelled_at::date, b.end_date)) as to_day
      from public.leaderboard_members lm
      where lm.leaderboard_id = p_id and lm.left_at is null
    ), w as (
      select m.user_id, m.display_name, m.role, m.from_day, m.to_day,
             coalesce(
               (select x.weight_kg from public.weight_logs x
                 where x.user_id = m.user_id and x.date between m.from_day - 7 and m.from_day
                 order by x.date desc limit 1),
               (select x.weight_kg from public.weight_logs x
                 where x.user_id = m.user_id and x.date between m.from_day and m.to_day
                 order by x.date asc limit 1)
             ) as start_kg,
             (select x.weight_kg from public.weight_logs x
               where x.user_id = m.user_id and x.date between m.from_day and m.to_day
               order by x.date desc limit 1) as last_kg,
             (select count(*)::int from public.weight_logs x
               where x.user_id = m.user_id and x.date between m.from_day - 7 and m.to_day) as weighins,
             (select count(*)::int from public.weight_logs x
               where x.user_id = m.user_id and x.date between m.from_day and m.to_day) as in_window
      from m
    ), scored as (
      select w.*,
             case when w.start_kg is null or w.last_kg is null or w.weighins < 2 or w.to_day < w.from_day then null
                  else greatest(0, least(
                    round(1000.0 * (w.start_kg - w.last_kg) / w.start_kg),
                    -- healthy pace: 1% a week, at least 1% in total (tenths of a percent)
                    greatest(10, round(10.0 * (w.to_day - w.from_day + 1) / 7.0))
                  ))::int
             end as pct
      from w
    )
    select md5(s.user_id::text || p_id::text), s.display_name, s.user_id = auth.uid(), s.role = 'owner',
           s.in_window, 0, s.pct,
           (case when s.pct is null then null else rank() over (order by s.pct desc nulls last) end)::int
    from scored s
    order by s.pct desc nulls last, s.display_name;
    return;
  end if;

  return query
  with m as (
    select lm.user_id, lm.display_name, lm.role,
           greatest(b.start_date, lm.joined_at::date) as from_day,
           least(b.end_date, current_date, coalesce(b.cancelled_at::date, b.end_date)) as to_day
    from public.leaderboard_members lm
    where lm.leaderboard_id = p_id and lm.left_at is null
  ), counts as (
    select m.user_id,
           count(c.task_id)::int as done_n,
           count(t.id)::int as planned_n,
           greatest(0, m.to_day - m.from_day + 1) as days
    from m
    left join public.daily_tasks t
      on t.user_id = m.user_id and t.date between m.from_day and m.to_day
     and t.type = any (public.competition_task_types(b.kind))
     and t.plan_id in (select p.id from public.plans p where p.user_id = m.user_id and p.status = 'active')
    left join public.task_completions c on c.task_id = t.id
    group by m.user_id, m.from_day, m.to_day
  ), scored as (
    select m.user_id, m.display_name, m.role, k.done_n, k.planned_n,
           case when k.days <= 0 then null
                else least(100, round(100.0 * k.done_n / greatest(k.planned_n, public.competition_min_planned(b.kind, k.days), 1)))::int
           end as pct
    from m join counts k on k.user_id = m.user_id
  )
  select md5(s.user_id::text || p_id::text), s.display_name, s.user_id = auth.uid(), s.role = 'owner',
         s.done_n, s.planned_n, s.pct,
         (case when s.pct is null then null else rank() over (order by s.pct desc nulls last) end)::int
  from scored s
  order by s.pct desc nulls last, s.display_name;
end $$;

revoke all on function public.can_join_weight_competition() from public, anon;
grant execute on function public.can_join_weight_competition() to authenticated;
revoke all on function public.create_leaderboard(text, text, date, date, text, text) from public, anon;
revoke all on function public.join_leaderboard(text, text) from public, anon;
revoke all on function public.leaderboard_standings(uuid) from public, anon;
grant execute on function public.create_leaderboard(text, text, date, date, text, text) to authenticated;
grant execute on function public.join_leaderboard(text, text) to authenticated;
grant execute on function public.leaderboard_standings(uuid) to authenticated;
