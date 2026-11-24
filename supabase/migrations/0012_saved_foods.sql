-- 0012_saved_foods.sql — each user's own recipes and regular foods.
--
-- A recipe ("טראפלס": dark chocolate, a jar of peanut butter, a cup of cornflakes, 40 balls) is
-- counted once in the app (src/lib/food/recipe.ts) and kept here with its nutrition per unit,
-- so "אכלתי 5 טראפלס" is counted at once. `recipe` keeps what is needed to edit it later: the
-- ingredients as understood, the answers given (package weights, units made) and any package
-- labels typed. A regular food is the same with one unit ("מנה").
-- Own rows only. Safe to run more than once.

create table if not exists public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('recipe', 'food')),
  unit_name text check (unit_name is null or char_length(unit_name) <= 30),
  yield_units numeric check (yield_units is null or (yield_units > 0 and yield_units <= 1000)),
  per_unit jsonb not null check (jsonb_typeof(per_unit) = 'object' and pg_column_size(per_unit) < 2000),
  recipe jsonb not null default '{}' check (jsonb_typeof(recipe) = 'object' and pg_column_size(recipe) < 16000),
  accuracy text check (accuracy in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists saved_foods_user on public.saved_foods (user_id, updated_at desc);

drop trigger if exists saved_foods_touch on public.saved_foods;
create trigger saved_foods_touch before update on public.saved_foods for each row execute function public.touch_updated_at();

alter table public.saved_foods enable row level security;
drop policy if exists saved_foods_own on public.saved_foods;
create policy saved_foods_own on public.saved_foods for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.saved_foods from anon;
grant select, insert, update, delete on public.saved_foods to authenticated;
