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
  insert into public.plans (id, user_id, week_start, plan_json) values ('${PLAN}', '${A}', '2026-11-01', '{}');
  insert into public.daily_tasks (id, plan_id, user_id, date, type, title, points)
    values ('${TASK}', '${PLAN}', '${A}', '2026-11-01', 'water', 'water', 5);
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

r = await as(A, `insert into plans (user_id, week_start, plan_json) values ('${A}', '2026-11-08', '{}')`);
check("plans are written by the server only", Boolean(r.error));

r = await as(A, "update task_completions set points_awarded = 999 returning 1");
check("user cannot change awarded points", r.rows?.length === 0);

r = await as(B, "select slug from exercises");
check("users see approved exercises only", r.rows?.length === 1 && r.rows[0].slug === "pushup");

r = await as(B, "select slug from exercises", { role: "admin" });
check("admin (server-set app_metadata) sees drafts", r.rows?.length === 2);

r = await as(B, "select count(*)::int as n from knowledge_sources");
check("knowledge sources are not readable by users", r.rows?.[0].n === 0);

r = await db
  .query(`insert into task_completions (task_id, user_id, outcome, points_awarded) values ('${TASK}', '${A}', 'done', 5)`)
  .then(() => ({}), (e) => ({ error: e.message }));
check("a task cannot be completed (scored) twice", Boolean(r.error));

r = await as(A, "select count(*)::int as n from feature_flags where enabled");
check("billing and premium gating flags start OFF", r.rows?.[0].n === 0);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll RLS checks passed");
process.exit(failed ? 1 : 0);
