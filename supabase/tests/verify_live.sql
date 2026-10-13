-- Read-only check that a live database has everything the migrations create.
-- Paste into the Supabase SQL Editor and run. Every row should say ok = true.
with checks(item, expected, actual) as (
  values
  ('tables', 9::bigint, (select count(*) from information_schema.tables where table_schema = 'public'
      and table_name in ('profiles','exercises','exercise_errors','rule_sets','recording_groups','sessions','reps','rep_keypoints','rep_labels'))),
  ('row level security on', 9, (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and c.relname in ('profiles','exercises','exercise_errors','rule_sets','recording_groups','sessions','reps','rep_keypoints','rep_labels'))),
  ('access policies', 22, (select count(*) from pg_policies where schemaname = 'public')),
  ('unique constraints', 4, (select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and c.contype = 'u')),
  ('delete-cascade links', 11, (select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and c.contype = 'f' and c.confdeltype = 'c')),
  ('profile-on-signup trigger', 1, (select count(*) from pg_trigger where tgname = 'on_auth_user_created')),
  ('users cannot change their role', 0, (select count(*) from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
      and grantee = 'authenticated' and privilege_type = 'UPDATE')),
  ('exercises seeded', 3, (select count(*) from public.exercises)),
  ('squat error types seeded', 7, (select count(*) from public.exercise_errors where exercise_id = 'squat')),
  ('squat rule sets (front v1, side v1, front v2)', 3, (select count(*) from public.rule_sets where exercise_id = 'squat')),
  ('sessions.thresholds column', 1, (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'sessions' and column_name = 'thresholds'))
)
select item, expected, actual, expected = actual as ok from checks;
