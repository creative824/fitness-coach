// Applies the migrations to an in-memory Postgres (PGlite + pgvector) with a minimal stub of
// Supabase's auth schema, then checks the RLS rules the spec requires (§17, §22).
// Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { vector } from "@electric-sql/pglite-pgvector";
import fs from "node:fs";

const db = new PGlite({ extensions: { vector, pgcrypto } });

await db.exec(`
  create role authenticated; create role anon;
  create schema auth;
  create table auth.users (id uuid primary key, raw_app_meta_data jsonb default '{}');
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on all functions in schema auth to authenticated;
`);

const dir = new URL("../migrations/", import.meta.url);
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(new URL(file, dir), "utf8"));
}

// Content seed must apply cleanly on top of the migrations, twice (idempotent).
const seed = fs.readFileSync(new URL("../seed/content.sql", import.meta.url), "utf8");
await db.exec(seed);
await db.exec(seed);

// Supabase grants table privileges to `authenticated`; RLS is what restricts rows.
await db.exec(`
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`);

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const PLAN = "aaaaaaaa-0000-0000-0000-000000000001";
const TASK = "bbbbbbbb-0000-0000-0000-000000000001";

await db.exec(`
  insert into auth.users (id) values ('${A}'), ('${B}');
  insert into public.profiles (user_id, display_name) values ('${A}', 'alice'), ('${B}', 'bob');
  insert into public.plans (id, user_id, week_start, plan_json) values ('${PLAN}', '${A}', '2020-01-05', '{}');
  insert into public.daily_tasks (id, plan_id, user_id, date, type, title, points)
    values ('${TASK}', '${PLAN}', '${A}', '2020-01-05', 'water', 'water', 5);
  insert into public.task_completions (task_id, user_id, outcome, points_awarded) values ('${TASK}', '${A}', 'done', 5);
  insert into public.exercises (slug, name_he, instructions_he, difficulty, review_status)
    values ('pushup', 'שכיבות סמיכה', 'x', 'beginner', 'approved'), ('draft-one', 'טיוטה', 'x', 'beginner', 'draft');
`);

async function as(sub, sql, appMetadata = {}) {
  const claims = JSON.stringify({ sub, app_metadata: appMetadata }).replaceAll("'", "''");
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims}', false);`);
  try {
    return { rows: (await db.query(sql)).rows };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec("reset role");
  }
}

let failed = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

let r;
r = await as(B, "select display_name from profiles");
check("user sees only own profile", r.rows?.length === 1 && r.rows[0].display_name === "bob");

r = await as(B, `update profiles set display_name = 'x' where user_id = '${A}' returning 1`);
check("user cannot update another user's profile", r.rows?.length === 0);

r = await as(B, `insert into profiles (user_id) values ('${A}')`);
check("user cannot insert a row for another user", Boolean(r.error));

r = await as(B, "select count(*)::int as n from plans");
check("user cannot read another user's plan", r.rows?.[0].n === 0);

r = await as(A, "select count(*)::int as n from plans");
check("user reads own plan", r.rows?.[0].n === 1);

r = await as(A, `insert into plans (user_id, week_start, plan_json) values ('${A}', '2026-10-25', '{}')`);
check("plans are written by the server only", Boolean(r.error));

r = await as(A, "update task_completions set points_awarded = 999 returning 1");
check("user cannot change awarded points", r.rows?.length === 0);

r = await as(B, "select slug from exercises");
check("users see approved exercises only", r.rows?.length === 1 && r.rows[0].slug === "pushup");

r = await as(B, "select slug from exercises", { role: "admin" });
check("admin (server-set app_metadata) sees drafts", r.rows?.some((x) => x.slug === "draft-one") && r.rows.length > 2);

r = await as(B, "select count(*)::int as n from knowledge_sources");
check("knowledge sources are not readable by users", r.rows?.[0].n === 0);

r = await db
  .query(`insert into task_completions (task_id, user_id, outcome, points_awarded) values ('${TASK}', '${A}', 'done', 5)`)
  .then(() => ({}), (e) => ({ error: e.message }));
check("a task cannot be completed (scored) twice", Boolean(r.error));

r = await as(A, "select count(*)::int as n from feature_flags where enabled");
check("billing and premium gating flags start OFF", r.rows?.[0].n === 0);

r = await db.query("select (select count(*) from exercises)::int as e, (select count(*) from meal_ideas)::int as r, (select count(*) from muscles)::int as m");
check("content seed loads idempotently", r.rows[0].e > 40 && r.rows[0].r > 30 && r.rows[0].m === 14);

r = await as(B, "select count(*)::int as n from meal_ideas");
check("seeded meal ideas stay hidden until approved", r.rows?.[0].n === 0);

r = await db
  .query("insert into meal_ideas (slug, title_he, hint_he) values ('x', 'יוגורט', 'מאתיים גרם 200')")
  .then(() => ({}), (e) => ({ error: e.message }));
check("meal ideas cannot carry amounts (no digits)", Boolean(r.error));

r = await as(A, `insert into water_logs (user_id, date, amount_ml) values ('${A}', '2026-11-01', 500) returning 1`);
check("user logs own water fill", r.rows?.length === 1);

r = await as(B, `insert into water_logs (user_id, date, amount_ml) values ('${A}', '2026-11-01', 500)`);
check("user cannot log water for another user", Boolean(r.error));

r = await as(B, "select count(*)::int as n from water_logs");
check("user cannot read another user's water log", r.rows?.[0].n === 0);

r = await as(B, "select count(*)::int as n from exercises where slug = 'plank'");
check("seeded exercises stay hidden until approved", r.rows?.[0].n === 0);

// ── follow-up §7: food log ──
await as(A, "select 1");
r = await as(A, `select public.save_food_log('2026-11-01', 'lunch', 'אורז ועוף', 'confirmed', 'web', 'cccccccc-0000-4000-8000-000000000001', true,
  '[{"item_name":"אורז","quantity":1,"unit":"כוס","kcal_min":180,"kcal_max":240},{"item_name":"חזה עוף","kcal_min":150,"kcal_max":220}]'::jsonb) as id`);
check("user saves a meal with items in one step", Boolean(r.rows?.[0]?.id));
const foodId = r.rows?.[0]?.id;
r = await as(A, `select public.save_food_log('2026-11-01', 'lunch', 'אורז ועוף', 'confirmed', 'web', 'cccccccc-0000-4000-8000-000000000001', true, '[]'::jsonb) as id`);
check("a retried save with the same client_ref is not stored twice", r.rows?.[0]?.id === foodId);
r = await as(A, "select count(*)::int as n from food_log_items");
check("items are saved with the meal", r.rows?.[0].n === 2);
r = await as(B, "select count(*)::int as n from food_logs");
check("user cannot read another user's food log", r.rows?.[0].n === 0);
r = await as(B, `insert into food_log_items (food_log_id, user_id, item_name) values ('${foodId}', '${B}', 'x')`);
check("user cannot add items to another user's meal", Boolean(r.error));
r = await as(A, `insert into food_log_items (food_log_id, user_id, item_name, kcal_min, kcal_max) values ('${foodId}', '${A}', 'x', 300, 100)`);
check("an estimate range cannot be upside down", Boolean(r.error));

// ── phase 3: saving a plan and scoring tasks go through security-definer functions ──
// Dates are relative to today, because a plan can only be saved for this week or the next.
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000));
const TD = iso(new Date());
const WS = addDays(TD, -new Date(`${TD}T00:00:00Z`).getUTCDay());
const NWS = addDays(WS, 7);
const tasksJson = JSON.stringify([
  { date: TD, type: "workout", title: "אימון", sort_order: 10, points: 25 },
  { date: TD, type: "water", title: "מים", sort_order: 20 },
]);
r = await as(A, `select save_week_plan('${WS}', '{"schema_version":1}', '${tasksJson}') as id`);
check("user saves own plan through save_week_plan", Boolean(r.rows?.[0].id));
r = await as(A, `select type, points from daily_tasks where date = '${TD}' order by sort_order`);
check("task points are set by the database, not the client", r.rows?.[0].points === 20 && r.rows?.[1].points === 5);

r = await as(A, `select id from daily_tasks where date = '${TD}' and type = 'workout'`);
const W = r.rows?.[0].id;
r = await as(A, `select set_task_outcome('${W}', 'done')`);
r = await as(A, `select set_task_outcome('${W}', 'done')`);
r = await as(A, `select count(*)::int as n, sum(points_awarded)::int as p from task_completions where task_id = '${W}'`);
check("marking a task twice scores it once", r.rows?.[0].n === 1 && r.rows?.[0].p === 20);
r = await as(A, `select set_task_outcome('${W}', 'partial')`);
r = await as(A, `select points_awarded from task_completions where task_id = '${W}'`);
check("partial counts half", r.rows?.[0].points_awarded === 10);

r = await as(B, `select set_task_outcome('${W}', 'done')`);
check("user cannot mark another user's task", Boolean(r.error));

r = await as(A, `select save_week_plan('${WS}', '{"schema_version":1}', '${tasksJson}') as id`);
r = await as(A, `select count(*)::int as n, count(*) filter (where status = 'active')::int as a from plans where week_start = '${WS}'`);
check("regenerating keeps one active version", r.rows?.[0].n === 2 && r.rows?.[0].a === 1);
r = await as(A, `select count(*)::int as n from daily_tasks d join plans p on p.id = d.plan_id
  where p.status = 'active' and p.week_start = '${WS}'`);
check("regenerating keeps completed tasks without duplicates", r.rows?.[0].n === 2);
r = await as(A, `select sum(points_awarded)::int as p from task_completions c join daily_tasks d on d.id = c.task_id where d.date = '${TD}'`);
check("regenerating does not double points", r.rows?.[0].p === 10);

r = await as(A, `select save_week_plan('${addDays(WS, 1)}', '{}', '[]')`);
check("plan weeks start on Sunday", Boolean(r.error));
r = await as(A, `select save_week_plan('${NWS}', '{}', '[{"date":"${addDays(NWS, 14)}","type":"water","title":"x"}]')`);
check("tasks must fall inside the plan week", Boolean(r.error));

r = await as(A, `select save_week_plan('${NWS}', '{}', '[{"date":"${addDays(NWS, 6)}","type":"water","title":"x"}]')`);
r = await as(A, `select id from daily_tasks where date = '${addDays(NWS, 6)}'`);
r = await as(A, `select set_task_outcome('${r.rows?.[0].id}', 'done')`);
check("future tasks cannot be marked", Boolean(r.error));

// ── review fixes (0007): points cannot be inflated from the browser ──
r = await as(A, `select save_week_plan('${addDays(WS, -14)}', '{}', '[{"date":"${addDays(WS, -14)}","type":"water","title":"x"}]')`);
check("a plan cannot be saved for a past week", Boolean(r.error));
r = await as(A, `select save_week_plan('${addDays(WS, 28)}', '{}', '[]')`);
check("a plan cannot be saved weeks ahead", Boolean(r.error));
const stuffed = JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ date: TD, type: "workout", title: "x", sort_order: 10 + i })));
r = await as(A, `select save_week_plan('${WS}', '{}', '${stuffed}')`);
check("a day cannot hold more workouts than a real plan", Boolean(r.error));
await db.exec(`insert into daily_tasks (id, plan_id, user_id, date, type, title, points)
  values ('bbbbbbbb-0000-0000-0000-000000000009', '${PLAN}', '${A}', '${addDays(TD, -5)}', 'water', 'old', 5)`);
r = await as(A, `select set_task_outcome('bbbbbbbb-0000-0000-0000-000000000009', 'done')`);
check("a task cannot be marked days after its date", Boolean(r.error));

r = await as(A, "select take_ai_quota('food_estimate', 2) as ok");
r = await as(A, "select take_ai_quota('food_estimate', 2) as ok");
const second = r.rows?.[0].ok;
r = await as(A, "select take_ai_quota('food_estimate', 2) as ok");
check("the daily AI limit stops the call after the limit", second === true && r.rows?.[0].ok === false);
r = await as(A, `insert into ai_usage (user_id, day, kind, calls) values ('${B}', current_date, 'coach', 0)`);
check("users cannot write AI usage directly", Boolean(r.error));
r = await as(A, `select take_ai_quota_for('${B}', 'coach', 5)`);
check("users cannot spend another user's AI quota", Boolean(r.error));
r = await as(A, `select take_ai_quota_as('${B}', 'coach', 5)`);
check("users cannot use the bot's AI quota function", Boolean(r.error));

r = await as(A, `update profiles set disabled_at = now() where user_id = '${A}' returning disabled_at`);
check("a user cannot set disabled_at on their own profile", r.rows?.length === 1 && r.rows[0].disabled_at === null);
await as(B, "update exercises set name_he = 'שכיבות סמיכה רחבות' where slug = 'pushup'", { role: "admin" });
r = await db.query(`select meta from audit_logs where entity = 'exercises' and action = 'update' and actor = '${B}'`);
check("admin content changes are written to the audit log", r.rows.length === 1 && r.rows[0].meta.after.name_he === "שכיבות סמיכה רחבות");

r = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
check(`every public table has RLS on${r.rows.length ? ` (missing: ${r.rows.map((x) => x.relname).join(", ")})` : ""}`, r.rows.length === 0);

r = await as(A, `insert into weight_logs (user_id, date, weight_kg) values ('${A}', '2026-11-01', 74.5) returning 1`);
check("user logs own weight", r.rows?.length === 1);
r = await as(B, "select count(*)::int as n from weight_logs");
check("user cannot read another user's weight", r.rows?.[0].n === 0);

// ── follow-up §9: Telegram linking ──
const HASH = "a".repeat(64);
r = await as(A, `insert into telegram_link_tokens (user_id, token_hash, expires_at) values ('${A}', '${HASH}', now() + interval '10 minutes') returning 1`);
check("user creates own link code", r.rows?.length === 1);
r = await as(B, "select count(*)::int as n from telegram_link_tokens");
check("user cannot see another user's link codes", r.rows?.[0].n === 0);
r = await as(A, `select telegram_link_as('${HASH}', 777, 777)`);
check("a signed-in user cannot link a Telegram account directly", Boolean(r.error));
r = await as(A, `select save_food_log_as('${A}', '2026-11-01', 'x', false, '[]'::jsonb)`);
check("a signed-in user cannot use the bot's food save", Boolean(r.error));
r = await as(B, `select set_task_outcome_as('${A}', '${TASK}', 'done')`);
check("a signed-in user cannot mark tasks as the bot", Boolean(r.error));
async function asBot(sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"role":"service_role"}', false);`);
  try { return { rows: (await db.query(sql)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec("reset role"); }
}
r = await asBot(`select telegram_link_as('${HASH}', 777, 777) as u`);
check("the bot links with a valid code", r.rows?.[0]?.u === A);
r = await asBot(`select telegram_link_as('${HASH}', 888, 888) as u`);
check("a link code works only once", r.rows?.[0]?.u === null);
await db.exec(`insert into telegram_link_tokens (user_id, token_hash, expires_at) values ('${B}', '${"b".repeat(64)}', now() - interval '1 minute')`);
r = await asBot(`select telegram_link_as('${"b".repeat(64)}', 999, 999) as u`);
check("an expired link code is refused", r.rows?.[0]?.u === null);
r = await as(B, "select count(*)::int as n from telegram_links");
check("user cannot see another user's Telegram link", r.rows?.[0].n === 0);
r = await as(A, `delete from telegram_links where user_id = '${A}' returning 1`);
check("user can unlink Telegram", r.rows?.length === 1);
r = await asBot(`select save_food_log_as('${A}', '2026-11-01', 'טוסט', true, '[{"item_name":"טוסט","kcal_min":250,"kcal_max":350}]'::jsonb) as id`);
r = await as(A, "select status, source from food_logs where free_text = 'טוסט'");
check("a meal from the bot is saved as a draft in the same account", r.rows?.[0]?.status === "draft" && r.rows?.[0]?.source === "telegram");

// ── competitions (0008) ──
const CODE = "c".repeat(64);
const START = TD;
const END = addDays(TD, 13);
r = await as(A, `select create_leaderboard('אתגר נובמבר', 'habits', '${START}', '${END}', 'אורי', '${CODE}') as id`);
const LB = r.rows?.[0]?.id;
check("a user creates a competition and becomes its owner", Boolean(LB));
r = await as(A, `select create_leaderboard('${"x".repeat(41)}', 'habits', '${START}', '${END}', 'אורי', null)`);
check("a competition name is at most 40 characters", Boolean(r.error));
r = await as(A, `select create_leaderboard('x', 'weight_loss', '${START}', '${END}', 'אורי', null)`);
check("only the safe competition kinds exist", Boolean(r.error));
r = await as(A, `select create_leaderboard('x', 'habits', '${START}', '${addDays(START, 120)}', 'אורי', null)`);
check("a competition lasts at most 90 days", Boolean(r.error));

r = await as(B, "select count(*)::int as n from leaderboards");
check("a non-member cannot see a competition", r.rows?.[0].n === 0);
r = await as(B, `select * from leaderboard_standings('${LB}')`);
check("a non-member cannot read the standings", Boolean(r.error));
r = await as(B, `select join_leaderboard('${"d".repeat(64)}', 'בוב') as id`);
check("a wrong code joins nothing", r.rows?.[0].id === null);
r = await as(B, `insert into leaderboard_members (leaderboard_id, user_id, display_name) values ('${LB}', '${B}', 'x')`);
check("users cannot add themselves to a competition directly", Boolean(r.error));
r = await as(B, `select join_leaderboard('${CODE}', 'בוב') as id`);
check("a user joins with the code", r.rows?.[0].id === LB);
r = await as(B, `update leaderboards set max_members = 2 where id = '${LB}' returning 1`);
check("members cannot change a competition", Boolean(r.error) || r.rows?.length === 0);

r = await as(B, `select display_name, is_me, score from leaderboard_standings('${LB}')`);
check("members see both nicknames and which row is theirs",
  r.rows?.length === 2 && r.rows.filter((x) => x.is_me).length === 1 && r.rows.find((x) => x.is_me).display_name === "בוב");
r = await as(B, `select score from leaderboard_standings('${LB}') where is_me`);
check("a member with no tasks scores 0, not 100", r.rows?.[0].score === 0);
r = await as(B, "select count(*)::int as n from leaderboard_members");
check("members read only their own membership row", r.rows?.[0].n === 1);

// 20 members at most, owner included.
const extra = Array.from({ length: 19 }, (_, i) => `33333333-3333-3333-3333-${String(i).padStart(12, "0")}`);
await db.exec(`insert into auth.users (id) values ${extra.map((u) => `('${u}')`).join(", ")}`);
let lastOk = true;
for (let i = 0; i < 18; i++) {
  r = await as(extra[i], `select join_leaderboard('${CODE}', 'm${i}') as id`);
  lastOk = lastOk && r.rows?.[0].id === LB;
}
r = await as(extra[18], `select join_leaderboard('${CODE}', 'one too many')`);
check("the 21st member is refused (20 including the owner)", lastOk && /full/.test(r.error ?? ""));

r = await as(A, `select member_key from leaderboard_standings('${LB}') where display_name = 'בוב'`);
const bobKey = r.rows?.[0].member_key;
r = await as(B, `select leaderboard_remove_member('${LB}', '${bobKey}')`);
check("only the owner can remove a member", Boolean(r.error));
r = await as(A, `select leaderboard_remove_member('${LB}', '${bobKey}')`);
r = await as(B, `select join_leaderboard('${CODE}', 'בוב') as id`);
check("a removed member cannot rejoin with the code", /removed/.test(r.error ?? ""));
r = await as(extra[18], `select join_leaderboard('${CODE}', 'now there is room') as id`);
check("a freed place can be taken", r.rows?.[0].id === LB);

r = await as(A, `select finalize_leaderboard('${LB}') as done`);
check("a running competition is not finalized", r.rows?.[0].done === false);
await db.exec(`update leaderboards set start_date = '${addDays(TD, -10)}', end_date = '${addDays(TD, -1)}' where id = '${LB}';
  update leaderboard_members set joined_at = now() - interval '10 days' where leaderboard_id = '${LB}';
  insert into daily_tasks (id, plan_id, user_id, date, type, title, points)
    values ('bbbbbbbb-0000-0000-0000-000000000010', '${PLAN}', '${A}', '${addDays(TD, -2)}', 'water', 'w', 5);
  insert into task_completions (task_id, user_id, outcome, points_awarded) values ('bbbbbbbb-0000-0000-0000-000000000010', '${A}', 'done', 5);`);
r = await as(A, `select score, planned from leaderboard_standings('${LB}') where is_me`);
check("the score is done out of at least three tasks a day, not out of what a stripped plan asks", r.rows?.[0].score === 3 && r.rows[0].planned === 2);
r = await as(A, `select finalize_leaderboard('${LB}') as done`);
r = await as(A, `select finalize_leaderboard('${LB}') as again`);
check("an ended competition is finalized once", r.rows?.[0].again === false);
r = await as(A, `select rank, prize_points from leaderboard_results where leaderboard_id = '${LB}' and user_id = '${A}'`);
check("the winner gets the first prize", r.rows?.[0]?.rank === 1 && r.rows[0].prize_points === 100);
r = await as(extra[0], `select prize_points from leaderboard_results where leaderboard_id = '${LB}' and user_id = '${extra[0]}'`);
check("a member who did nothing gets no prize", r.rows?.[0]?.prize_points === 0);
r = await as(extra[0], `select join_leaderboard('${CODE}', 'late')`);
check("an ended competition cannot be joined", Boolean(r.error) || r.rows?.[0]?.join_leaderboard === null);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll RLS checks passed");
process.exit(failed ? 1 : 0);
