-- 0001_init.sql — initial schema (spec §17). Applied in phase 1.
-- Rule: every private table has RLS; a user reads/writes only their own rows.
-- Admin rights come from auth.users.raw_app_meta_data->>'role' = 'admin', which only the
-- service role can set (never a browser-editable value).

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── user profile ─────────────────────────
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  birth_year int check (birth_year between 1900 and 2100), -- 18+ is enforced in the app (spec §6)
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  weight_kg numeric(5,1) check (weight_kg between 30 and 350),
  target_weight_kg numeric(5,1) check (target_weight_kg between 30 and 350),
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  sleep_hours numeric(3,1),
  water_cups_now int,
  busy_days smallint[] default '{}',          -- 0=Sunday … 6=Saturday
  preferences jsonb not null default '{}',
  safety_flags jsonb not null default '{}',   -- answers to the safety screen (spec §6)
  onboarding_step smallint not null default 0, -- autosave position in the questionnaire
  onboarding_completed_at timestamptz,
  disabled_at timestamptz,                    -- admin can disable a user
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_type text not null check (goal_type in
    ('lose_weight','maintain_weight','gain_weight','strength','muscle','endurance','general_fitness','flexibility','habits')),
  target text,
  priority smallint not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.food_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  dietary_pattern text,           -- e.g. omnivore, vegetarian, vegan, kosher
  allergies text[] not null default '{}',
  sensitivities text[] not null default '{}',
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  meals_per_day smallint check (meals_per_day between 1 and 8),
  cooking_minutes smallint,
  updated_at timestamptz not null default now()
);

create table public.exercise_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  experience text check (experience in ('beginner','intermediate','advanced')),
  location text[] not null default '{}',     -- home, gym, outdoors
  equipment text[] not null default '{}',
  available_days smallint[] not null default '{}',
  session_minutes smallint check (session_minutes between 5 and 180),
  limitations text,                           -- injuries, pain, movement limits (free text)
  updated_at timestamptz not null default now()
);

-- ───────────────────────── plans & daily loop ─────────────────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  status text not null default 'active' check (status in ('draft','active','superseded','archived')),
  version int not null default 1,
  plan_json jsonb not null,           -- validated against src/lib/plan/schema.ts
  generation_meta jsonb not null default '{}', -- model, prompt version, validator result
  created_at timestamptz not null default now(),
  unique (user_id, week_start, version)
);
create unique index plans_one_active_per_week on public.plans (user_id, week_start) where status = 'active';

create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  type text not null check (type in ('meal','workout','movement','water','recovery','habit')),
  title text not null,
  ref jsonb not null default '{}',    -- e.g. {"recipe_id": …} or {"workout_index": 0}
  points smallint not null check (points between 0 and 25),
  status text not null default 'pending' check (status in ('pending','done','partial','swapped','skipped')),
  sort_order smallint not null default 0
);
create index daily_tasks_user_date on public.daily_tasks (user_id, date);

-- One completion per task: prevents double scoring (spec §21, §22).
create table public.task_completions (
  task_id uuid primary key references public.daily_tasks on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  outcome text not null check (outcome in ('done','partial','swapped')),
  points_awarded smallint not null,
  completed_at timestamptz not null default now(),
  note text
);

-- ───────────────────────── content libraries (admin-managed) ─────────────────────────
create table public.muscles (
  id text primary key,                -- chest, upper_back, lower_back, shoulders, biceps, triceps, abs, glutes, quads, hamstrings, calves …
  name_he text not null,
  view text not null check (view in ('front','back','both')),
  description_he text
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_he text not null,
  instructions_he text not null,
  cautions_he text,
  equipment text[] not null default '{}',
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  primary_muscles text[] not null default '{}',   -- muscles.id
  secondary_muscles text[] not null default '{}', -- muscles.id
  contraindications text[] not null default '{}', -- e.g. knee_pain, shoulder_injury
  media_url text,
  media_license text,
  review_status text not null default 'draft' check (review_status in ('draft','approved','retired')),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_he text not null,
  meal_type text[] not null default '{}',          -- breakfast, lunch, dinner, snack
  dietary_tags text[] not null default '{}',       -- vegetarian, vegan, kosher_dairy …
  allergens text[] not null default '{}',          -- gluten, milk, egg, peanut, tree_nut, soy, fish, sesame …
  ingredients jsonb not null,                      -- [{name_he, amount, unit, food_ref?}]
  steps_he text[] not null default '{}',
  prep_minutes smallint,
  servings smallint not null default 1,
  nutrition jsonb,          -- per serving; null when not reliable (spec §10)
  nutrition_source text,    -- where the values come from
  image_url text,
  review_status text not null default 'draft' check (review_status in ('draft','approved','retired')),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── logs ─────────────────────────
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  exercise_id uuid references public.exercises on delete set null,
  task_id uuid references public.daily_tasks on delete set null,
  date date not null,
  sets jsonb not null default '[]',   -- [{reps, weight_kg?, seconds?}]
  effort smallint check (effort between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  weight_kg numeric(5,1) check (weight_kg between 30 and 350),
  measurements jsonb not null default '{}', -- optional circumferences
  unique (user_id, date)
);

create table public.wellbeing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  unique (user_id, date)
);

-- ───────────────────────── AI coach ─────────────────────────
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  citations jsonb not null default '[]',  -- [{chunk_id, source_id}]
  safety jsonb not null default '{}',     -- flags raised on this turn
  created_at timestamptz not null default now()
);
create index chat_messages_thread on public.chat_messages (thread_id, created_at);

-- ───────────────────────── knowledge base (RAG) ─────────────────────────
create table public.knowledge_sources (
  id text primary key,          -- stable id; the article bot uses sha1(normalized url)[:16]
  title text not null,
  author text,
  publisher text,
  url text,
  published date,
  license text not null check (license in ('public-domain','abstract-only','link-only','licensed','original')),
  evidence_level text,          -- e.g. A (guideline / systematic review), B (reputable publisher)
  topics text[] not null default '{}',
  population text,
  summary text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  index_status text not null default 'not_indexed' check (index_status in ('not_indexed','indexing','indexed','error')),
  index_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.knowledge_sources on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  topic_tags text[] not null default '{}',
  unique (source_id, chunk_index)
);
create index knowledge_chunks_embedding on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- ───────────────────────── billing prep (OFF) & ops ─────────────────────────
create table public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  plan_tier text not null default 'free' check (plan_tier in ('free','premium')),
  status text not null default 'none' check (status in ('none','trialing','active','past_due','canceled')),
  provider text,            -- not chosen yet
  provider_customer_ref text,
  provider_subscription_ref text,
  period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text
);
insert into public.feature_flags (key, enabled, description) values
  ('billing_enabled', false, 'Billing provider and checkout. Off during beta.'),
  ('premium_gating_enabled', false, 'Restrict features by plan tier. Off during beta.');

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ───────────────────────── triggers ─────────────────────────
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger food_prefs_touch before update on public.food_preferences for each row execute function public.touch_updated_at();
create trigger exercise_prefs_touch before update on public.exercise_preferences for each row execute function public.touch_updated_at();
create trigger exercises_touch before update on public.exercises for each row execute function public.touch_updated_at();
create trigger recipes_touch before update on public.recipes for each row execute function public.touch_updated_at();
create trigger sources_touch before update on public.knowledge_sources for each row execute function public.touch_updated_at();

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.food_preferences enable row level security;
alter table public.exercise_preferences enable row level security;
alter table public.plans enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.wellbeing_logs enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.muscles enable row level security;
alter table public.exercises enable row level security;
alter table public.recipes enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_logs enable row level security;

-- Own-rows policies for user data the user edits directly.
do $$
declare t text;
begin
  foreach t in array array['profiles','goals','food_preferences','exercise_preferences',
                           'exercise_logs','weight_logs','wellbeing_logs','chat_threads']
  loop
    execute format('create policy %I on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
                   t || '_own', t);
  end loop;
end $$;

-- Read-only for the owner: these are written by the server (service role) only,
-- so a user cannot fake a plan, award points, or write assistant messages.
create policy plans_read_own on public.plans for select to authenticated using (user_id = (select auth.uid()));
create policy tasks_read_own on public.daily_tasks for select to authenticated using (user_id = (select auth.uid()));
create policy completions_read_own on public.task_completions for select to authenticated using (user_id = (select auth.uid()));
create policy chat_messages_read_own on public.chat_messages for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_read_own on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- Content libraries: signed-in users read approved rows; admins manage everything.
create policy muscles_read on public.muscles for select to authenticated using (true);
create policy muscles_admin on public.muscles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy exercises_read on public.exercises for select to authenticated using (review_status = 'approved' or public.is_admin());
create policy exercises_admin on public.exercises for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy recipes_read on public.recipes for select to authenticated using (review_status = 'approved' or public.is_admin());
create policy recipes_admin on public.recipes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sources_admin on public.knowledge_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chunks_admin on public.knowledge_chunks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy flags_read on public.feature_flags for select to authenticated using (true);
create policy flags_admin on public.feature_flags for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
-- knowledge_chunks are searched by the server through the service role, never from the browser.
