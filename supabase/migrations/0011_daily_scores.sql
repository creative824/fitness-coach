-- 0011_daily_scores.sql — keep each day's score as it was on that day.
--
-- score: the daily score (0–100) and its parts (calories 70, protein 15, fitness 10, tasks 5),
-- with the calorie and protein targets of that day. Written by the app while the day is going;
-- a later change of goals never rewrites past days. Own rows only (day_logs policies).
-- Safe to run more than once.

alter table public.day_logs add column if not exists score jsonb;

alter table public.day_logs drop constraint if exists day_logs_score_shape;
alter table public.day_logs add constraint day_logs_score_shape
  check (score is null or (jsonb_typeof(score) = 'object' and pg_column_size(score) < 2000));
