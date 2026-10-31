-- 0002_content_meals_water.sql — phase 2: exercise library fields, meal ideas, water logging.

-- ───────────────────────── exercises ─────────────────────────
alter table public.exercises
  add column if not exists category text not null default 'strength'
    check (category in ('strength','cardio','mobility','core')),
  add column if not exists mode text not null default 'reps' check (mode in ('reps','seconds')),
  add column if not exists easier_slug text,
  add column if not exists reviewed_by uuid references auth.users on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists exercises_primary_muscles on public.exercises using gin (primary_muscles);

-- ───────────────────────── meal ideas ─────────────────────────
-- Product decision: no recipes. The plan suggests simple meal ideas such as
-- "small breakfast: a vegetable salad with nuts", with no amounts and no cooking steps.
-- The recipes table from 0001 was never filled, so it is replaced.
drop table if exists public.recipes cascade;

create table if not exists public.meal_ideas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_he text not null,                          -- "סלט ירקות עם אגוזים"
  hint_he text,                                    -- one short line, never amounts or steps
  meal_type text[] not null default '{}',          -- breakfast, lunch, dinner, snack
  portion text not null default 'regular' check (portion in ('light','regular')),
  components text[] not null default '{}',         -- protein, vegetables, carbs, fat, fruit
  dietary_tags text[] not null default '{}',       -- vegetarian, vegan, pescatarian, kosher_*
  allergens text[] not null default '{}',          -- same keys as onboarding allergies
  review_status text not null default 'draft' check (review_status in ('draft','approved','retired')),
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_ideas_no_digits check (title_he !~ '[0-9]' and coalesce(hint_he, '') !~ '[0-9]')
);

create index if not exists meal_ideas_allergens on public.meal_ideas using gin (allergens);
create index if not exists meal_ideas_meal_type on public.meal_ideas using gin (meal_type);

drop trigger if exists meal_ideas_touch on public.meal_ideas;
create trigger meal_ideas_touch before update on public.meal_ideas for each row execute function public.touch_updated_at();

alter table public.meal_ideas enable row level security;
drop policy if exists meal_ideas_read on public.meal_ideas;
create policy meal_ideas_read on public.meal_ideas for select to authenticated using (review_status = 'approved' or public.is_admin());
drop policy if exists meal_ideas_admin on public.meal_ideas;
create policy meal_ideas_admin on public.meal_ideas for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── water ─────────────────────────
-- Drinking is logged one fill at a time: each tap on "+1" adds one glass or bottle of the
-- user's own size. The daily target and pacing are computed in code (src/lib/water).
alter table public.profiles
  add column if not exists water_vessel_ml smallint not null default 250
    check (water_vessel_ml between 100 and 2000);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,                    -- the user's local date
  amount_ml smallint not null check (amount_ml between 50 and 2000),
  logged_at timestamptz not null default now()
);

create index if not exists water_logs_user_date on public.water_logs (user_id, date);

alter table public.water_logs enable row level security;
drop policy if exists water_logs_own on public.water_logs;
create policy water_logs_own on public.water_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
