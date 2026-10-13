-- The 10 exercises from docs/research/exercise_technique_dataset.json and their camera-checkable errors.
-- Generated from src/exercises/generic/catalog.ts (src/exercises/generic/catalog.test.ts checks they stay in sync).
-- Limits live in the app catalog and are saved per session in sessions.thresholds; they are placeholders until a coach reviews them.

insert into public.exercises (id, name, description, status, doc_path) values
  ('back_squat', 'Barbell Back Squat', 'Barbell, power rack. Reps. Default camera: side.', 'active', 'docs/exercises/back_squat.md'),
  ('bench_press', 'Barbell Bench Press (flat)', 'Barbell, flat bench, rack with safety pins. Reps. Default camera: side.', 'active', 'docs/exercises/bench_press.md'),
  ('conventional_deadlift', 'Conventional Barbell Deadlift', 'Barbell with plates, flat shoes. Reps. Default camera: side.', 'active', 'docs/exercises/conventional_deadlift.md'),
  ('pull_up', 'Pull-Up (overhand grip)', 'Pull-up bar. Reps. Default camera: front.', 'active', 'docs/exercises/pull_up.md'),
  ('barbell_bent_over_row', 'Barbell Bent-Over Row', 'Barbell with plates. Reps. Default camera: side.', 'active', 'docs/exercises/barbell_bent_over_row.md'),
  ('overhead_press', 'Barbell Overhead (Standing) Press', 'Barbell, rack. Reps. Default camera: side.', 'active', 'docs/exercises/overhead_press.md'),
  ('barbell_curl', 'Standing Barbell Biceps Curl', 'Barbell or EZ bar. Reps. Default camera: side.', 'active', 'docs/exercises/barbell_curl.md'),
  ('parallel_bar_dip', 'Parallel-Bar Dip', 'Parallel bars. Reps. Default camera: side.', 'active', 'docs/exercises/parallel_bar_dip.md'),
  ('forward_lunge', 'Forward Lunge (bodyweight)', 'None. Reps. Default camera: side.', 'active', 'docs/exercises/forward_lunge.md'),
  ('forearm_plank', 'Forearm Plank', 'Mat. Timed hold. Default camera: side.', 'active', 'docs/exercises/forearm_plank.md')
on conflict (id) do nothing;

insert into public.exercise_errors (exercise_id, code, name, description, severity) values
  ('back_squat', 'knees_caving', 'Knees caving in', 'Push your knees out over your toes. Dataset sq_14', 'safety'),
  ('back_squat', 'not_deep_enough', 'Not deep enough', 'Go deeper: hip crease below the top of the knee. Dataset sq_19', 'technique'),
  ('back_squat', 'hips_rise_first', 'Hips rise before the chest', 'Raise hips and chest together. Dataset sq_22', 'technique'),
  ('back_squat', 'heels_lifting', 'Heels lifting', 'Keep your heels down. Dataset sq_03', 'technique'),
  ('back_squat', 'shins_vertical', 'Shins kept vertical', 'Let the knees come forward. Dataset sq_15', 'style'),
  ('bench_press', 'half_rep', 'Bar not lowered to the chest', 'Touch your chest every rep. Dataset bp_14', 'technique'),
  ('bench_press', 'no_lockout', 'Elbows not locked out', 'Lock your elbows at the top. Dataset bp_20', 'style'),
  ('bench_press', 'forearms_not_vertical', 'Forearms not vertical', 'Keep your forearms vertical. Dataset bp_13', 'technique'),
  ('bench_press', 'butt_off_bench', 'Butt off the bench', 'Keep your butt on the bench. Dataset bp_19', 'technique'),
  ('conventional_deadlift', 'bar_far_from_body', 'Bar too far in front', 'Keep the bar over mid-foot, close to your legs. Dataset dl_02, dl_08', 'safety'),
  ('conventional_deadlift', 'hips_shoot_up', 'Hips shoot up first', 'Raise hips and chest together. Dataset dl_09', 'safety'),
  ('conventional_deadlift', 'no_lockout', 'Not locked out', 'Stand tall: hips and knees locked. Dataset dl_10', 'technique'),
  ('conventional_deadlift', 'leaning_back', 'Leaning back at lockout', 'Finish tall, don''t lean back. Dataset dl_10', 'technique'),
  ('pull_up', 'chin_below_bar', 'Chin not over the bar', 'Pull until your chin clears the bar. Dataset pu_05', 'technique'),
  ('pull_up', 'no_full_hang', 'No full hang at the bottom', 'Straighten your arms fully at the bottom. Dataset pu_03', 'technique'),
  ('pull_up', 'swinging', 'Swinging / kipping', 'Stay still, no swinging. Dataset pu_06', 'technique'),
  ('pull_up', 'fast_lowering', 'Lowering too fast', 'Lower slowly, about 2–3 seconds. Dataset pu_07', 'style'),
  ('pull_up', 'shrugging', 'Shrugging at the start', 'Shoulders down, away from your ears. Dataset pu_04', 'technique'),
  ('barbell_bent_over_row', 'torso_too_upright', 'Torso too upright', 'Hinge further forward. Dataset row_04', 'technique'),
  ('barbell_bent_over_row', 'torso_swing', 'Torso rises / swings', 'Keep your torso still. Dataset row_04, row_09', 'technique'),
  ('barbell_bent_over_row', 'short_pull', 'Bar not pulled high enough', 'Pull the bar to your lower chest. Dataset row_06, row_07', 'technique'),
  ('barbell_bent_over_row', 'no_full_extension', 'Arms not fully lowered', 'Lower until your arms are straight. Dataset row_09', 'style'),
  ('overhead_press', 'layback', 'Leaning back', 'Squeeze glutes, ribs down, don''t lean back. Dataset oh_12, oh_06', 'safety'),
  ('overhead_press', 'no_lockout', 'Not locked out overhead', 'Lock the elbows, arms vertical. Dataset oh_09', 'technique'),
  ('overhead_press', 'bar_forward', 'Bar ends in front', 'Finish with the bar over mid-foot. Dataset oh_07', 'technique'),
  ('overhead_press', 'using_legs', 'Using the legs', 'Keep your legs straight: strict press. Dataset oh_05', 'style'),
  ('barbell_curl', 'torso_swing', 'Swinging the torso', 'No swinging: keep your torso still. Dataset cu_07', 'technique'),
  ('barbell_curl', 'elbows_forward', 'Elbows drift forward', 'Pin your elbows to your sides. Dataset cu_04', 'technique'),
  ('barbell_curl', 'partial_curl', 'Partial curl', 'Curl all the way up. Dataset cu_05', 'style'),
  ('parallel_bar_dip', 'not_deep_enough', 'Not deep enough', 'Lower until your elbows reach about 90°. Dataset dp_07', 'technique'),
  ('parallel_bar_dip', 'fast_lowering', 'Dropping too fast', 'Lower slowly, under control. Dataset dp_08', 'safety'),
  ('parallel_bar_dip', 'torso_swing', 'Torso angle changes', 'Keep the same torso angle. Dataset dp_04', 'style'),
  ('forward_lunge', 'not_deep_enough', 'Not deep enough', 'Lower until both knees are about 90°. Dataset lu_05', 'technique'),
  ('forward_lunge', 'knee_past_toes', 'Front knee past the toes', 'Keep the front knee over the ankle. Dataset lu_04', 'technique'),
  ('forward_lunge', 'torso_lean', 'Leaning forward', 'Keep your torso upright. Dataset lu_08', 'technique'),
  ('forearm_plank', 'hips_sagging', 'Hips sagging', 'Lift your hips into a straight line. Dataset pl_03, pl_04', 'safety'),
  ('forearm_plank', 'hips_piked', 'Hips piked up', 'Lower your hips into a straight line. Dataset pl_03, pl_04', 'technique'),
  ('forearm_plank', 'elbows_not_under_shoulders', 'Elbows not under the shoulders', 'Elbows directly under your shoulders. Dataset pl_01', 'technique'),
  ('forearm_plank', 'head_not_neutral', 'Head not neutral', 'Look at the floor just ahead of your hands. Dataset pl_05', 'style')
on conflict (exercise_id, code) do nothing;

