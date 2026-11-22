-- 0009_day_logs.sql — one row per user and day for the simplified "today" screen.
--
-- - menu: the day's generated menu (slots, the meal of each slot, the calories it was built
--   for, and whether it was eaten). Built in the app from src/lib/menu/engine.ts; only the
--   choices are stored, the portions are recomputed from the meal library.
-- - fitness: exercises of today's workout marked done, and general activities the user added
--   ("walked 15 minutes").
-- Calories eaten are still counted from food_logs: marking a menu meal as eaten writes a food log.
-- Own rows only. Safe to run more than once.

create table if not exists public.day_logs (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,                       -- the user's local date
  menu jsonb,
  fitness jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  check (menu is null or (jsonb_typeof(menu) = 'object' and pg_column_size(menu) < 16000)),
  check (jsonb_typeof(fitness) = 'object' and pg_column_size(fitness) < 16000)
);

drop trigger if exists day_logs_touch on public.day_logs;
create trigger day_logs_touch before update on public.day_logs for each row execute function public.touch_updated_at();

alter table public.day_logs enable row level security;
drop policy if exists day_logs_own on public.day_logs;
create policy day_logs_own on public.day_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.day_logs from anon;
grant select, insert, update, delete on public.day_logs to authenticated;
