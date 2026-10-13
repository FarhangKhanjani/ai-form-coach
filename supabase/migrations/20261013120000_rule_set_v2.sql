-- Thresholds the app actually used for a session (the user can adjust them while thresholds are placeholders).
alter table public.sessions add column thresholds jsonb;

-- Squat front-view rules as implemented in app v0.2 (src/exercises/squat/config.ts).
-- Changes from v1: shift and knees measured against hip width, knee movement measured from standing,
-- depth tolerance band. Placeholders from docs/exercises/squat.md; not coach-approved.
insert into public.rule_sets (exercise_id, version, camera_view, rules, notes) values
  ('squat', 2, 'front', '{
    "depth":    {"metric": "hip_knee_gap_left", "max": 0.15, "tolerance": 0.05, "unit": "fraction of standing gap"},
    "knees":    {"metric": "knee_width_over_ankle_width", "min": 0.9, "unit": "ratio"},
    "knee_in":  {"metric": "knee_inward_since_standing_over_hip_width", "max": 0.15, "unit": "ratio"},
    "shift":    {"metric": "hip_mid_minus_ankle_mid_over_hip_width_change", "max": 0.15, "unit": "ratio"},
    "hip_tilt": {"metric": "hip_height_diff_over_hip_width_change", "max": 0.10, "unit": "ratio"},
    "heels":    {"metric": "heel_rise_over_leg_length", "max": 0.04, "unit": "ratio"},
    "tempo":    {"metric": "down_time", "min": 1.5, "unit": "s"}
  }', 'Draft v0.2: matches app v0.2 (session 1 fixes)');
