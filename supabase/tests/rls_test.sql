-- Row-level-security checks. Run after supabase_stub.sql and the migrations; any failure raises an error.
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', '{"full_name": "Athlete A", "avatar_url": "https://x/a.png"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'coach@example.com', '{}');
update public.profiles set role = 'coach' where id = '00000000-0000-0000-0000-00000000000c';

do $$ begin
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Athlete A', 'profile from Google name';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'b', 'profile from email';
end $$;

-- As athlete A: record a session with one rep, keypoints and a label
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.sessions (id, user_id, exercise_id, rule_set_id, camera_view, started_at, frame_width, frame_height)
  select '10000000-0000-0000-0000-000000000001', auth.uid(), 'squat', id, 'front', now(), 720, 960
  from public.rule_sets where exercise_id = 'squat' and camera_view = 'front' and version = 1;
insert into public.reps (id, session_id, user_id, n, start_ms, end_ms, metrics, issues)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', auth.uid(), 1, 1000, 4500, '{"depthPct": 110}', '{}');
insert into public.rep_keypoints (rep_id, user_id, frames) values ('20000000-0000-0000-0000-000000000001', auth.uid(), '[{"t":0,"lm":[]}]');
insert into public.rep_labels (rep_id, labeler_id, labeler_role, correct) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'athlete', true);
do $$ begin assert (select count(*) from public.reps) = 1, 'A sees own rep'; end $$;
-- An imported video needs confirmed consent
do $$ begin
  begin insert into public.sessions (user_id, exercise_id, camera_view, started_at, source, source_meta)
    values (auth.uid(), 'squat', 'side', now(), 'video_import', '{"fileName": "x.mp4"}');
    raise exception 'import without consent allowed';
  exception when check_violation then null; end;
end $$;
insert into public.sessions (user_id, exercise_id, camera_view, started_at, source, source_meta)
  values (auth.uid(), 'squat', 'side', now(), 'video_import', '{"fileName": "x.mp4", "consentConfirmed": true}');

-- A cannot make themselves coach
do $$ begin
  begin update public.profiles set role = 'coach' where id = auth.uid(); raise exception 'role change allowed';
  exception when insufficient_privilege then null; end;
end $$;
-- A cannot claim a coach label
do $$ begin
  begin insert into public.rep_labels (rep_id, labeler_id, labeler_role, correct) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'coach', false);
    raise exception 'athlete inserted coach label';
  exception when insufficient_privilege then null; end;
end $$;
-- A cannot write a session for someone else
do $$ begin
  begin insert into public.sessions (user_id, exercise_id, camera_view, started_at) values ('00000000-0000-0000-0000-00000000000b', 'squat', 'front', now());
    raise exception 'wrote other user session';
  exception when insufficient_privilege then null; end;
end $$;

-- As athlete B: sees nothing of A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.sessions) = 0, 'B sees A sessions';
  assert (select count(*) from public.reps) = 0, 'B sees A reps';
  assert (select count(*) from public.rep_keypoints) = 0, 'B sees A keypoints';
  assert (select count(*) from public.rep_labels) = 0, 'B sees A labels';
  assert (select count(*) from public.profiles) = 1, 'B sees other profiles';
  assert (select count(*) from public.exercises) = 13, 'B reads catalog';
end $$;

-- As coach: nothing until A consents
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin assert (select count(*) from public.reps) = 0, 'coach sees reps without consent'; end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.profiles set consent_training = true where id = auth.uid();
do $$ begin assert (select consent_training_at from public.profiles where id = auth.uid()) is not null, 'consent time set'; end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.reps) = 1, 'coach sees consented reps';
  assert (select count(*) from public.rep_keypoints) = 1, 'coach sees consented keypoints';
end $$;
insert into public.rep_labels (rep_id, labeler_id, labeler_role, correct, error_codes) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'coach', false, '{shifting_sideways}');
do $$ begin
  begin update public.reps set n = 99; exception when others then null; end;
  assert (select n from public.reps) = 1, 'coach changed athlete rep';
end $$;

-- Account deletion removes everything
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.sessions) = 0 and (select count(*) from public.rep_labels) = 0, 'cascade delete';
end $$;
\echo ALL RLS CHECKS PASSED
