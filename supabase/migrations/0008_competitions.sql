-- 0008_competitions.sql — private competitions ("טבלאות מנצחים") of up to 20 people.
--
-- Rules (product spec §2–§5, §9, §10):
-- - Every table is private. Joining needs a code; only its SHA-256 is stored, and the owner
--   can rotate it at any time (the old code stops working).
-- - At most 20 active members including the owner, enforced here under a row lock, so two
--   parallel joins cannot pass the limit.
-- - Scores are never written by users. They are computed here from the members' own daily
--   tasks, as a percentage of what each member's own plan asked for, so a plan with three
--   workouts a week is not punished against one with five. Nothing about food, weight or
--   health is shared: other members see only nicknames and the competition's score.
-- - When the end date passes, the first member who opens the table finalizes it: standings
--   are frozen and prize points are given (100 / 60 / 30, ties share).
-- - All writes go through the functions below; the tables have no write grants for users.

-- ───────────────────────── tables ─────────────────────────
create table if not exists public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('consistency', 'habits', 'water')),
  start_date date not null,
  end_date date not null,
  max_members smallint not null default 20 check (max_members between 2 and 20),
  invite_code_hash text unique check (invite_code_hash is null or char_length(invite_code_hash) = 64),
  prizes int[] not null default '{100,60,30}',
  cancelled_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date + 2 and end_date <= start_date + 90)
);

create table if not exists public.leaderboard_members (
  leaderboard_id uuid not null references public.leaderboards on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  removed_at timestamptz,             -- removed by the owner: cannot rejoin with the code
  primary key (leaderboard_id, user_id)
);
create index if not exists leaderboard_members_user on public.leaderboard_members (user_id) where left_at is null;

create table if not exists public.leaderboard_results (
  leaderboard_id uuid not null references public.leaderboards on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null,
  rank smallint not null,
  score smallint,
  prize_points int not null default 0,
  primary key (leaderboard_id, user_id)
);

alter table public.leaderboards enable row level security;
alter table public.leaderboard_members enable row level security;
alter table public.leaderboard_results enable row level security;

-- Is the caller an active member of this table? Security definer so policies do not recurse.
create or replace function public.is_leaderboard_member(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leaderboard_members
    where leaderboard_id = p_id and user_id = auth.uid() and left_at is null
  );
$$;

drop policy if exists leaderboards_read_members on public.leaderboards;
create policy leaderboards_read_members on public.leaderboards for select to authenticated
  using (public.is_leaderboard_member(id));
-- Members read only their own membership rows; the standings function returns nicknames.
drop policy if exists leaderboard_members_read_own on public.leaderboard_members;
create policy leaderboard_members_read_own on public.leaderboard_members for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists leaderboard_results_read_members on public.leaderboard_results;
create policy leaderboard_results_read_members on public.leaderboard_results for select to authenticated
  using (public.is_leaderboard_member(leaderboard_id) or user_id = (select auth.uid()));

revoke insert, update, delete on public.leaderboards, public.leaderboard_members, public.leaderboard_results from authenticated;
grant select on public.leaderboards, public.leaderboard_members, public.leaderboard_results to authenticated;

-- ───────────────────────── helpers ─────────────────────────
-- Task types that count for a kind of competition.
create or replace function public.competition_task_types(p_kind text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'consistency' then array['workout']
    when 'water' then array['water']
    else array['meal', 'workout', 'movement', 'water', 'recovery', 'habit']
  end;
$$;

-- The fewest planned tasks a member is measured against over n days, so a plan stripped down
-- to one easy task cannot reach 100%: two workouts a week, one water task a day, three tasks a day.
create or replace function public.competition_min_planned(p_kind text, p_days int) returns int
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'consistency' then ceil(greatest(p_days, 0) * 2 / 7.0)::int
    when 'water' then greatest(p_days, 0)
    else greatest(p_days, 0) * 3
  end;
$$;

create or replace function public.leaderboard_assert_owner(p_id uuid) returns public.leaderboards
language plpgsql security definer set search_path = '' as $$
declare
  b public.leaderboards;
begin
  select * into b from public.leaderboards where id = p_id;
  if not found or b.owner_id is distinct from auth.uid() then raise exception 'not the owner'; end if;
  return b;
end $$;

-- ───────────────────────── create / join / leave ─────────────────────────
-- Creates a table with the caller as owner and returns its id. The invite code is set with
-- leaderboard_rotate_code (the app creates the code and sends only its hash).
create or replace function public.create_leaderboard(
  p_name text, p_kind text, p_start date, p_end date, p_display_name text, p_code_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
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

-- Joins by code. Returns the table id, or null when the code is wrong. Raises when the table
-- is full, over or cancelled, so the app can say why.
create or replace function public.join_leaderboard(p_code_hash text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.leaderboards;
  n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  -- Lock the table row: parallel joins wait here, so the member count below is exact.
  select * into b from public.leaderboards where invite_code_hash = p_code_hash for update;
  if not found then return null; end if;
  if b.cancelled_at is not null or b.finalized_at is not null or b.end_date < current_date then
    raise exception 'competition is over';
  end if;
  if exists (select 1 from public.leaderboard_members where leaderboard_id = b.id and user_id = uid and left_at is null) then
    return b.id;
  end if;
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

create or replace function public.leave_leaderboard(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.leaderboards where id = p_id and owner_id = auth.uid()) then
    raise exception 'the owner cannot leave; cancel the competition instead';
  end if;
  update public.leaderboard_members set left_at = now()
    where leaderboard_id = p_id and user_id = auth.uid() and left_at is null;
end $$;

-- Members are addressed by the opaque key from leaderboard_standings, never by user id.
create or replace function public.leaderboard_remove_member(p_id uuid, p_member_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  perform public.leaderboard_assert_owner(p_id);
  select user_id into target from public.leaderboard_members
    where leaderboard_id = p_id and left_at is null and md5(user_id::text || p_id::text) = p_member_key;
  if target is null then raise exception 'member not found'; end if;
  if target = auth.uid() then raise exception 'the owner cannot remove themselves'; end if;
  update public.leaderboard_members set left_at = now(), removed_at = now()
    where leaderboard_id = p_id and user_id = target;
  insert into public.audit_logs (actor, action, entity, entity_id, meta)
    values (auth.uid(), 'remove_member', 'leaderboards', p_id::text, jsonb_build_object('user_id', target));
end $$;

create or replace function public.leaderboard_rotate_code(p_id uuid, p_code_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.leaderboard_assert_owner(p_id);
  update public.leaderboards set invite_code_hash = p_code_hash where id = p_id;
end $$;

create or replace function public.leaderboard_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.leaderboards := public.leaderboard_assert_owner(p_id);
begin
  if b.finalized_at is not null then raise exception 'competition already ended'; end if;
  update public.leaderboards set cancelled_at = now(), invite_code_hash = null where id = p_id;
  insert into public.audit_logs (actor, action, entity, entity_id) values (auth.uid(), 'cancel', 'leaderboards', p_id::text);
end $$;

-- ───────────────────────── scoring ─────────────────────────
-- Standings for one table, for its members only. Score = completed / planned tasks of the
-- competition's kind between the start (or the member's join day) and today (or the end),
-- as a whole percentage. A member with no days counted yet has a null score.
create or replace function public.leaderboard_standings(p_id uuid)
returns table (member_key text, display_name text, is_me boolean, is_owner boolean, done int, planned int, score int, rank int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b public.leaderboards;
begin
  if not public.is_leaderboard_member(p_id) then raise exception 'not a member'; end if;
  select * into b from public.leaderboards where id = p_id;
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

-- Freezes the standings once the end date has passed and gives prize points. Any member may
-- call it; it does nothing before the end or when already done.
create or replace function public.finalize_leaderboard(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  b public.leaderboards;
begin
  if not public.is_leaderboard_member(p_id) then raise exception 'not a member'; end if;
  select * into b from public.leaderboards where id = p_id for update;
  if b.finalized_at is not null or b.cancelled_at is not null or b.end_date >= current_date then return false; end if;

  insert into public.leaderboard_results (leaderboard_id, user_id, display_name, rank, score, prize_points)
  select p_id, lm.user_id, s.display_name, coalesce(s.rank, 999), s.score, 0
  from public.leaderboard_standings(p_id) s
  join public.leaderboard_members lm
    on lm.leaderboard_id = p_id and lm.left_at is null and md5(lm.user_id::text || p_id::text) = s.member_key;

  -- Tied members share the prizes of the places they hold together, rounded down.
  update public.leaderboard_results r set prize_points = x.pts
  from (
    select r2.user_id,
           (select coalesce(sum(coalesce(b.prizes[i], 0)), 0)
              from generate_series(r2.rank, r2.rank + cnt.n - 1) as i) / cnt.n as pts
    from public.leaderboard_results r2
    join (select rank, count(*)::int as n from public.leaderboard_results
          where leaderboard_id = p_id and score is not null and score > 0 group by rank) cnt on cnt.rank = r2.rank
    where r2.leaderboard_id = p_id and r2.score is not null and r2.score > 0
  ) x
  where r.leaderboard_id = p_id and r.user_id = x.user_id;

  update public.leaderboards set finalized_at = now(), invite_code_hash = null where id = p_id;
  insert into public.audit_logs (actor, action, entity, entity_id) values (auth.uid(), 'finalize', 'leaderboards', p_id::text);
  return true;
end $$;

-- ───────────────────────── grants ─────────────────────────
revoke all on function public.is_leaderboard_member(uuid) from public, anon;
revoke all on function public.leaderboard_assert_owner(uuid) from public, anon, authenticated;
revoke all on function public.create_leaderboard(text, text, date, date, text, text) from public, anon;
revoke all on function public.join_leaderboard(text, text) from public, anon;
revoke all on function public.leave_leaderboard(uuid) from public, anon;
revoke all on function public.leaderboard_remove_member(uuid, text) from public, anon;
revoke all on function public.leaderboard_rotate_code(uuid, text) from public, anon;
revoke all on function public.leaderboard_cancel(uuid) from public, anon;
revoke all on function public.leaderboard_standings(uuid) from public, anon;
revoke all on function public.finalize_leaderboard(uuid) from public, anon;
grant execute on function public.is_leaderboard_member(uuid) to authenticated;
grant execute on function public.create_leaderboard(text, text, date, date, text, text) to authenticated;
grant execute on function public.join_leaderboard(text, text) to authenticated;
grant execute on function public.leave_leaderboard(uuid) to authenticated;
grant execute on function public.leaderboard_remove_member(uuid, text) to authenticated;
grant execute on function public.leaderboard_rotate_code(uuid, text) to authenticated;
grant execute on function public.leaderboard_cancel(uuid) to authenticated;
grant execute on function public.leaderboard_standings(uuid) to authenticated;
grant execute on function public.finalize_leaderboard(uuid) to authenticated;
grant execute on function public.competition_task_types(text) to authenticated;
grant execute on function public.competition_min_planned(text, int) to authenticated;
