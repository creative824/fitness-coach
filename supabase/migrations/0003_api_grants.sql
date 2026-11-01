-- Newer Supabase projects no longer grant the API roles access to tables created in `public`
-- ("permission denied for table ..."). Grant signed-in users table access explicitly;
-- row level security (enabled on every table, policies in 0001/0002) still decides which rows they see.
-- The `anon` role gets nothing: every policy is written for `authenticated`.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Tables added by later migrations get the same access.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
