-- AI Form Coach: initial schema.
-- Stores keypoints and metrics only, never video (project rule; GDPR).
-- Every user-owned row is deleted when the user's account is deleted (on delete cascade from auth.users).

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  role          text not null default 'athlete' check (role in ('athlete', 'coach', 'admin')),
  height_cm     numeric(5, 1) check (height_cm between 50 and 260),
  -- consent to use this user's keypoints for building/training form models (opt-in, revocable)
  consent_training boolean not null default false,
  consent_training_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Create a profile for every new account; takes name/avatar from Google sign-in when present.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.consent_training is distinct from old.consent_training then
    new.consent_training_at := case when new.consent_training then now() end;
  end if;
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Role checks used by policies. security definer so they can read profiles regardless of RLS.
create function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any (roles));
$$;

-- ---------------------------------------------------------------------------
-- Exercises, their error types, and versioned rule sets
-- ---------------------------------------------------------------------------
create table public.exercises (
  id          text primary key,                 -- slug, e.g. 'squat'
  name        text not null,
  description text,
  status      text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  doc_path    text,                             -- form standard in the repo, e.g. docs/exercises/squat.md
  created_at  timestamptz not null default now()
);

create table public.exercise_errors (
  exercise_id text not null references public.exercises (id) on delete cascade,
  code        text not null,                    -- e.g. 'knees_caving'; 'correct' is a label, not an error
  name        text not null,
  description text,
  severity    text not null default 'technique' check (severity in ('safety', 'technique', 'style')),
  primary key (exercise_id, code)
);

-- Thresholds live here, not in app code. A new version is a new row; old sessions keep pointing at the one they used.
create table public.rule_sets (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  text not null references public.exercises (id) on delete cascade,
  version      integer not null,
  camera_view  text not null check (camera_view in ('front', 'side', 'diagonal')),
  rules        jsonb not null,                  -- { "<rule>": { "metric": ..., "min"/"max": ..., "unit": ... } }
  notes        text,
  coach_approved_by uuid references public.profiles (id) on delete set null,
  coach_approved_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (exercise_id, camera_view, version)
);

-- ---------------------------------------------------------------------------
-- Recording: groups (several phones at once), sessions, reps, keypoints, labels
-- ---------------------------------------------------------------------------
-- One recording seen by several phones (e.g. front + side). Phones join with the short pair code.
create table public.recording_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  pair_code   text not null default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at  timestamptz not null default now(),
  unique (user_id, pair_code)
);

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  exercise_id   text not null references public.exercises (id),
  rule_set_id   uuid references public.rule_sets (id),
  recording_group_id uuid references public.recording_groups (id) on delete set null,
  camera_view   text not null check (camera_view in ('front', 'side', 'diagonal')),
  started_at    timestamptz not null,
  ended_at      timestamptz,
  app_version   text,
  pose_model    text,                           -- e.g. 'mediapipe-pose-lite@0.10.14'
  frame_width   integer,                        -- needed to turn normalized x/y into real angles
  frame_height  integer,
  device        text,                           -- coarse, e.g. 'android-chrome'; no device identifiers
  calibration   jsonb,                          -- standing pose and derived baselines
  export_format_version integer not null default 1,
  notes         text,
  created_at    timestamptz not null default now()
);
create index sessions_user_started on public.sessions (user_id, started_at desc);
create index sessions_group on public.sessions (recording_group_id);

create table public.reps (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  n           integer not null,                 -- rep number within the session
  start_ms    integer not null,                 -- from session start; lines up reps across phones in a group
  end_ms      integer not null,
  down_time_s numeric(6, 2),
  up_time_s   numeric(6, 2),
  metrics     jsonb not null default '{}',      -- e.g. depthPct, kneeRatio, heelLiftPct, shiftPct
  issues      text[] not null default '{}',     -- error codes flagged by the rules
  tracking_ok boolean not null default true,    -- false = keypoints unreliable, don't use for scoring/training
  created_at  timestamptz not null default now(),
  unique (session_id, n)
);
create index reps_user on public.reps (user_id, created_at desc);

-- Per-frame keypoints, kept apart from reps so listing reps stays cheap.
create table public.rep_keypoints (
  rep_id     uuid primary key references public.reps (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  format     text not null default 'mediapipe-pose-33',
  -- [{ "t": seconds_from_rep_start, "lm": [[x,y,z,visibility] x33], "world": [[x,y,z] x33] (optional) }]
  frames     jsonb not null,
  created_at timestamptz not null default now()
);

-- Labels from the athlete and from coaches. Several labelers per rep, so coach agreement can be measured.
create table public.rep_labels (
  id          uuid primary key default gen_random_uuid(),
  rep_id      uuid not null references public.reps (id) on delete cascade,
  labeler_id  uuid not null references auth.users (id) on delete cascade,
  labeler_role text not null check (labeler_role in ('athlete', 'coach')),
  correct     boolean not null,
  error_codes text[] not null default '{}',
  note        text,
  created_at  timestamptz not null default now(),
  unique (rep_id, labeler_id)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.exercises        enable row level security;
alter table public.exercise_errors  enable row level security;
alter table public.rule_sets        enable row level security;
alter table public.recording_groups enable row level security;
alter table public.sessions         enable row level security;
alter table public.reps             enable row level security;
alter table public.rep_keypoints    enable row level security;
alter table public.rep_labels       enable row level security;

-- Profiles: you see and edit your own. Coaches see profiles of users who consented to training use.
create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "coach reads consenting profiles" on public.profiles for select
  using (consent_training and public.has_role(array['coach', 'admin']));
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Users can't change their own role: only these columns are updatable from the app.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_url, height_cm, consent_training) on public.profiles to authenticated;

-- Catalog: readable by any signed-in user; changed by coaches/admins.
create policy "read exercises" on public.exercises for select to authenticated using (true);
create policy "admin writes exercises" on public.exercises for all using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));
create policy "read errors" on public.exercise_errors for select to authenticated using (true);
create policy "admin writes errors" on public.exercise_errors for all using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));
create policy "read rule sets" on public.rule_sets for select to authenticated using (true);
create policy "coach writes rule sets" on public.rule_sets for insert with check (public.has_role(array['coach', 'admin']));
create policy "coach approves rule sets" on public.rule_sets for update using (public.has_role(array['coach', 'admin']));

-- Recording data: owner has full access.
create policy "own groups" on public.recording_groups for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sessions" on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own reps" on public.reps for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own keypoints" on public.rep_keypoints for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Coaches can read recordings of users who consented to training use.
create function public.user_consented(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select consent_training from public.profiles where id = uid), false);
$$;
create policy "coach reads consented sessions" on public.sessions for select
  using (public.has_role(array['coach', 'admin']) and public.user_consented(user_id));
create policy "coach reads consented reps" on public.reps for select
  using (public.has_role(array['coach', 'admin']) and public.user_consented(user_id));
create policy "coach reads consented keypoints" on public.rep_keypoints for select
  using (public.has_role(array['coach', 'admin']) and public.user_consented(user_id));

-- Labels: athletes label their own reps; coaches label reps they can see. Everyone sees labels on reps they can see.
create policy "read labels" on public.rep_labels for select
  using (exists (select 1 from public.reps r where r.id = rep_id));
create policy "athlete labels own reps" on public.rep_labels for insert
  with check (labeler_id = auth.uid() and labeler_role = 'athlete'
              and exists (select 1 from public.reps r where r.id = rep_id and r.user_id = auth.uid()));
create policy "coach labels visible reps" on public.rep_labels for insert
  with check (labeler_id = auth.uid() and labeler_role = 'coach' and public.has_role(array['coach', 'admin'])
              and exists (select 1 from public.reps r where r.id = rep_id));
create policy "edit own labels" on public.rep_labels for update using (labeler_id = auth.uid()) with check (labeler_id = auth.uid());
create policy "delete own labels" on public.rep_labels for delete using (labeler_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed: exercises, error types, first (placeholder) squat rule sets
-- ---------------------------------------------------------------------------
insert into public.exercises (id, name, description, status, doc_path) values
  ('squat', 'Bodyweight / goblet squat', 'Squat to at least parallel, bodyweight or holding one dumbbell/kettlebell at the chest.', 'active', 'docs/exercises/squat.md'),
  ('lunge', 'Lunge', null, 'draft', null),
  ('dumbbell_press', 'Standing dumbbell press', null, 'draft', null);

insert into public.exercise_errors (exercise_id, code, name, description, severity) values
  ('squat', 'knees_caving', 'Knees caving in', 'Knee moves inside the line from hip to foot', 'safety'),
  ('squat', 'heels_lifting', 'Heels lifting', 'Heels rise off the floor', 'technique'),
  ('squat', 'not_deep_enough', 'Not deep enough', 'Hip crease stays above the top of the knee', 'technique'),
  ('squat', 'shifting_sideways', 'Shifting sideways', 'Hips drift toward one foot', 'technique'),
  ('squat', 'hip_tilt', 'Hips tilting', 'One hip drops lower than the other', 'technique'),
  ('squat', 'too_fast', 'Too fast', 'Uncontrolled descent', 'style'),
  ('squat', 'excessive_lean', 'Excessive forward lean', 'Torso much more inclined than the shins (side view)', 'technique');

-- Placeholder values from docs/exercises/squat.md; not coach-approved.
insert into public.rule_sets (exercise_id, version, camera_view, rules, notes) values
  ('squat', 1, 'front', '{
    "depth":       {"metric": "hip_knee_gap_left", "max": 0.15, "tolerance": 0.05, "unit": "fraction of standing gap"},
    "knees":       {"metric": "knee_width_over_ankle_width", "min": 0.9, "unit": "ratio"},
    "knee_valgus": {"metric": "frontal_knee_angle_inward", "max": 10, "unit": "deg"},
    "shift":       {"metric": "hip_mid_minus_ankle_mid_over_hip_width", "max": 0.15, "unit": "ratio"},
    "hip_tilt":    {"metric": "hip_height_diff_over_hip_width", "max": 0.10, "unit": "ratio"},
    "heels":       {"metric": "heel_rise_over_leg_length", "max": 0.04, "unit": "ratio"},
    "tempo":       {"metric": "down_time", "min": 1.5, "unit": "s"}
  }', 'Draft v0 from docs/exercises/squat.md'),
  ('squat', 1, 'side', '{
    "depth":       {"metric": "thigh_angle_below_horizontal", "min": 0, "unit": "deg"},
    "trunk_lean":  {"metric": "trunk_minus_shin_angle", "max": 15, "unit": "deg"},
    "heels":       {"metric": "heel_rise_over_leg_length", "max": 0.04, "unit": "ratio"},
    "tempo":       {"metric": "down_time", "min": 1.5, "unit": "s"}
  }', 'Draft v0 from docs/exercises/squat.md');
