-- 0002_content_columns.sql — fields the exercise library and body map need (phase 2).
alter table public.exercises
  add column if not exists category text not null default 'strength'
    check (category in ('strength','cardio','mobility','core')),
  add column if not exists mode text not null default 'reps' check (mode in ('reps','seconds')),
  add column if not exists easier_slug text,
  add column if not exists reviewed_by uuid references auth.users on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.recipes
  add column if not exists reviewed_by uuid references auth.users on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists exercises_primary_muscles on public.exercises using gin (primary_muscles);
create index if not exists recipes_allergens on public.recipes using gin (allergens);
