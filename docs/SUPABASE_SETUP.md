# Supabase setup

1. **Schema**: run every file in `supabase/migrations/` in order (SQL Editor → New query → Run).
   Then run `supabase/seed/content.sql` to load the exercise library and the meal ideas as drafts (ideas only, no recipes).
   The seed is safe to re-run: it updates content by slug and never changes approval status.
   After editing `src/content/*.ts`, regenerate it with `npm run seed:gen`.
2. **Environment** (local `.env.local` and Vercel → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on newer projects)
3. **Auth → URL Configuration**:
   - Site URL: the production URL (e.g. `https://fitness-coach-xxx.vercel.app`).
   - Redirect URLs: add `https://<your-domain>/auth/confirm` and `http://localhost:3000/auth/confirm`.
     For Vercel preview deployments also add `https://*-<team>.vercel.app/auth/confirm`.
4. **Auth → Email**: keep "Confirm email" on. The default templates work: their link returns to
   `/auth/confirm?code=…`, which signs the user in and continues to the questionnaire (or to
   `/reset-password` for password resets). Supabase's built-in mailer is rate-limited; add custom SMTP
   before inviting beta users.
5. **Admin user**: set `app_metadata.role = "admin"` for a user from the SQL Editor:
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'you@example.com';
   ```
   The user must sign out and in again for the new role to reach the session.
