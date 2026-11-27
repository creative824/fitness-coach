-- 0013_food_diary.sql — the smart food diary ("יום האוכל שלי").
--
-- Builds on the food log of 0005; no data is moved or rewritten.
-- 1. Two more meal kinds a meal can be filed under: 'nibble' (נשנוש) and 'other' (ארוחה אחרת).
--    Existing rows keep their kind. Until this runs the app files them as 'snack' / no kind.
-- 2. update_food_log: changes a saved meal (its kind and its items, e.g. new amounts) in one
--    step, as the caller (RLS applies). Until this runs the app does the same in three calls.
-- Food likes, dislikes and "never eat" need no change: likes / dislikes are columns of
-- food_preferences (0001) and "never eat" is kept in profiles.preferences.
-- Safe to run more than once.

alter table public.food_logs drop constraint if exists food_logs_meal_type_check;
alter table public.food_logs add constraint food_logs_meal_type_check
  check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'nibble', 'other'));

create or replace function public.update_food_log(p_id uuid, p_meal_type text, p_items jsonb)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then raise exception 'invalid items'; end if;
  update public.food_logs set meal_type = p_meal_type where id = p_id and user_id = uid;
  if not found then return false; end if;

  delete from public.food_log_items where food_log_id = p_id and user_id = uid;
  insert into public.food_log_items (food_log_id, user_id, item_name, quantity, unit, preparation, kcal_min, kcal_max, protein_g, carbs_g, fat_g, confidence, sort_order)
    select p_id, uid, left(e->>'item_name', 120), nullif(e->>'quantity', '')::numeric, left(e->>'unit', 30), left(e->>'preparation', 60),
           nullif(e->>'kcal_min', '')::smallint, nullif(e->>'kcal_max', '')::smallint,
           nullif(e->>'protein_g', '')::numeric, nullif(e->>'carbs_g', '')::numeric, nullif(e->>'fat_g', '')::numeric,
           e->>'confidence', (ord - 1)::smallint
    from jsonb_array_elements(p_items) with ordinality as t(e, ord);
  return true;
end $$;

revoke all on function public.update_food_log(uuid, text, jsonb) from public, anon;
grant execute on function public.update_food_log(uuid, text, jsonb) to authenticated;
