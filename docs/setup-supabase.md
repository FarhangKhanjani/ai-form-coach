# Supabase setup

## 1. Create the project

1. Sign up at https://supabase.com and create a project. **Region: Central EU (Frankfurt)** (GDPR).
2. Save the database password in your password manager. Don't put it in the repo or in chat.

## 2. Create the tables

Run every file in `supabase/migrations/`, in name order. Either:

- **Dashboard:** SQL Editor → New query → paste the contents of one migration file → Run. Repeat for the next file.
- **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.

Then make yourself admin (SQL Editor, after you've signed up in the app once):

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

## 3. Keys the app needs

Project Settings → API (or "Data API"):

- **Project URL** (`https://<ref>.supabase.co`) and the **anon / publishable key**. Both are meant to be public: the app ships them to every browser, and row-level security decides what each user can see. Fine to share and to commit.
- **Never share or commit** the `service_role` / secret key or the database password. They bypass all security.

## 4. Email sign-up

Authentication → Sign In / Providers → Email: enabled by default. Keep "Confirm email" on.

Authentication → URL Configuration:
- Site URL: `https://farhangkhanjani.github.io/ai-form-coach/`
- Redirect URLs: add `https://farhangkhanjani.github.io/ai-form-coach/**` and `http://localhost:5173/ai-form-coach/**` (local development).

## 5. Google sign-in

1. https://console.cloud.google.com → create a project (e.g. "AI Form Coach").
2. APIs & Services → OAuth consent screen: External, app name, your email, scopes `openid`, `email`, `profile`. While in testing mode, add yourself and your friend as test users.
3. APIs & Services → Credentials → Create credentials → OAuth client ID → **Web application**:
   - Authorized JavaScript origins: `https://farhangkhanjani.github.io`, `http://localhost:5173`
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
4. Copy the client ID and client secret into Supabase → Authentication → Sign In / Providers → Google → enable.

The Google client secret goes only into the Supabase dashboard, never into the repo.

## 6. What's stored

Keypoints, per-rep metrics, labels, profile (name, avatar, optional height). Never video. Deleting a user in Authentication → Users deletes all their data (cascade). Coaches only see recordings of users who switched on "use my reps for training" (`profiles.consent_training`).
