// The 10 exercises from docs/research/exercise_technique_dataset.json, as camera checks.
// Every check names the dataset checkpoint(s) it implements. Limits: where the dataset gives a number it is
// used (tagged "dataset"); everything else is a [Placeholder] starting value for testing (project rule:
// coaches set final values). Cues the camera can't see (grip, breathing, bar placement …) become setup tips.
import type { Features } from "./features";
import type { CheckDef, ExerciseDef, RepSeries } from "./types";

// ---- measurement helpers over one rep ----
type K = (f: Features) => number;
const atPeak = (k: K) => (r: RepSeries) => r.f[r.peakIdx] ? k(r.f[r.peakIdx]) : null;
const maxOf = (k: K) => (r: RepSeries) => r.f.length ? Math.max(...r.f.map(k)) : null;
const minOf = (k: K) => (r: RepSeries) => r.f.length ? Math.min(...r.f.map(k)) : null;
const rangeOf = (k: K) => (r: RepSeries) => r.f.length ? Math.max(...r.f.map(k)) - Math.min(...r.f.map(k)) : null;
/** Highest value just after the rep (lockout); falls back to the rep's last frames. */
const maxAfter = (k: K) => (r: RepSeries) => {
  const fs = r.after.length ? r.after : r.f.slice(-3);
  return fs.length ? Math.max(...fs.map(k)) : null;
};
/** Seconds from the peak back to rest (the lowering phase of a pull-up, the rise of a squat …). */
const fromPeakS = (r: RepSeries) => r.t.length ? r.end - r.t[r.peakIdx] : null;
const toPeakS = (r: RepSeries) => r.t.length ? r.t[r.peakIdx] - r.start : null;
/** p-th percentile of a feature over the rep (robust to single-frame glitches). */
const pct = (k: K, p: number) => (r: RepSeries) => {
  if (!r.f.length) return null;
  const v = r.f.map(k).filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
};

const SIDE = ["side"] as const;
const SIDE_DIAG = ["side", "diagonal"] as const;

// ---------------------------------------------------------------------------------------------
const backSquat: ExerciseDef = {
  id: "back_squat", datasetId: "back_squat", name: "Barbell Back Squat", short: "Back squat", equipment: "Barbell, power rack",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at hip height, 2–3 m to your side (side view) so the whole body and the bar are in frame. Front view only for knee tracking.",
  tips: [
    "Heels about shoulder-width, toes out about 30° (sq_01, sq_02).",
    "Bar high on the traps or low across the rear delts, centered (sq_04).",
    "Squeeze the shoulder blades and raise the chest before unracking (sq_07).",
    "Big breath at the top, hold it on the way down (SL).",
    "Safety pins just below your bottom position (sq_10)."
  ],
  signal: { feature: f => f.knee, label: "Knee angle", rest: "high", enter: 150, exit: 160, mustReach: 120 },
  checks: [
    { code: "knees_caving", name: "Knees caving in", cue: "Push your knees out over your toes", severity: "safety", views: ["front"],
      measure: minOf(f => f.kneeAnkleWidthRatio), limit: { min: 0.9 }, unit: "×",
      source: { checkpoints: ["sq_14"], limit: "[Placeholder] knee width ≥ 0.9 × ankle width" } },
    { code: "not_deep_enough", name: "Not deep enough", cue: "Go deeper: hip crease below the top of the knee", severity: "technique", views: [...SIDE_DIAG],
      measure: atPeak(f => f.hipBelowKnee * 100), limit: { min: -5 }, unit: "% leg",
      source: { checkpoints: ["sq_19"], limit: "[Placeholder] hip at least level with the knee (−5% thigh tolerance). Sources conflict: SL below parallel, LIFT/DYN parallel" } },
    { code: "hips_rise_first", name: "Hips rise before the chest", cue: "Raise hips and chest together", severity: "technique", views: [...SIDE],
      measure: r => { // trunk lean halfway up minus trunk lean at the bottom
        const mid = r.signal.findIndex((s, i) => i > r.peakIdx && s >= (r.signal[r.peakIdx] + r.signal[r.signal.length - 1]) / 2);
        return mid > 0 ? r.f[mid].trunkFromVertical - r.f[r.peakIdx].trunkFromVertical : null;
      }, limit: { max: 15 }, unit: "°",
      source: { checkpoints: ["sq_22"], limit: "[Placeholder] trunk may lean ≤ 15° more halfway up than at the bottom" } },
    { code: "heels_lifting", name: "Heels lifting", cue: "Keep your heels down", severity: "technique", views: [...SIDE],
      measure: r => r.before ? Math.max(...r.f.map(f => (f.heelAboveToe - r.before!.heelAboveToe) * 100)) : null, limit: { max: 4 }, unit: "% leg",
      source: { checkpoints: ["sq_03"], limit: "[Placeholder] heel rises ≤ 4% of leg length" } },
    { code: "shins_vertical", name: "Shins kept vertical", cue: "Let the knees come forward", severity: "style", views: [...SIDE],
      measure: atPeak(f => f.shinFromVertical), limit: { min: 10 }, unit: "°",
      source: { checkpoints: ["sq_15"], limit: "[Placeholder] shin ≥ 10° from vertical at the bottom (SL: never vertical)" } }
  ]
};

const benchPress: ExerciseDef = {
  id: "bench_press", datasetId: "bench_press", name: "Barbell Bench Press (flat)", short: "Bench press", equipment: "Barbell, flat bench, rack with safety pins",
  mode: "reps", defaultView: "side", views: ["side"],
  filming: "Phone on the floor or a box 2 m to your side, level with the bench, whole body and the bar in frame. You won't see the screen while lying: turn on spoken cues.",
  tips: [
    "Eyes under the bar, head neutral (bp_01).",
    "Shoulder blades squeezed together and down, chest up (bp_02).",
    "Bar low in the palm, wrists straight, thumbs around the bar (bp_05, bp_06).",
    "Feet flat on the floor, about shoulder-width (bp_04).",
    "Elbows about 75° from the torso, not flared to 90° (bp_12, SL). Not checked: needs a camera above you."
  ],
  signal: { feature: f => f.elbow, label: "Elbow angle", rest: "high", enter: 150, exit: 155, mustReach: 115 },
  checks: [
    { code: "half_rep", name: "Bar not lowered to the chest", cue: "Touch your chest every rep", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.elbow), limit: { max: 95 }, unit: "°",
      source: { checkpoints: ["bp_14"], limit: "[Placeholder] elbow ≤ 95° at the bottom as a proxy for touching the chest" } },
    { code: "no_lockout", name: "Elbows not locked out", cue: "Lock your elbows at the top", severity: "style", views: [...SIDE],
      measure: maxAfter(f => f.elbow), limit: { min: 160 }, unit: "°",
      source: { checkpoints: ["bp_20"], limit: "[Placeholder] elbow ≥ 160° after the press" } },
    { code: "forearms_not_vertical", name: "Forearms not vertical", cue: "Keep your forearms vertical", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.forearmFromVertical), limit: { max: 20 }, unit: "°",
      source: { checkpoints: ["bp_13"], limit: "[Placeholder] forearm ≤ 20° from vertical at the bottom" } },
    { code: "butt_off_bench", name: "Butt off the bench", cue: "Keep your butt on the bench", severity: "technique", views: [...SIDE],
      measure: r => r.before ? Math.max(...r.f.map(f => (r.before!.hipMid.y - f.hipMid.y) / f.torsoLen * 100)) : null, limit: { max: 8 }, unit: "% torso",
      source: { checkpoints: ["bp_19"], limit: "[Placeholder] hips rise ≤ 8% of torso length" } }
  ]
};

const deadlift: ExerciseDef = {
  id: "conventional_deadlift", datasetId: "conventional_deadlift", name: "Conventional Barbell Deadlift", short: "Deadlift", equipment: "Barbell with plates, flat shoes",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at knee-to-hip height, 2–3 m to your side, whole body and the bar in frame.",
  tips: [
    "Feet hip-width, bar over the middle of the foot (dl_01, dl_02).",
    "Grip about hip-width, arms straight and vertical (dl_03).",
    "Brace before the pull: breath in, get tight (dl_07).",
    "Neutral spine the whole lift (dl_06). Not checked: the camera has no spine points.",
    "Lower by pushing the hips back first, bend the knees once the bar passes them (dl_11)."
  ],
  signal: { feature: f => f.hip, label: "Hip angle", rest: "low", enter: 120, exit: 110, mustReach: 140 },
  checks: [
    { code: "bar_far_from_body", name: "Bar too far in front", cue: "Keep the bar over mid-foot, close to your legs", severity: "safety", views: [...SIDE],
      measure: r => r.f.length ? Math.max(...r.f.slice(0, Math.max(1, r.peakIdx)).map(f => f.wristAheadOfMidfoot * 100)) : null, limit: { max: 12 }, unit: "% leg",
      source: { checkpoints: ["dl_02", "dl_08"], limit: "[Placeholder] hands (bar proxy) ≤ 12% of leg length in front of mid-foot during the pull" } },
    { code: "hips_shoot_up", name: "Hips shoot up first", cue: "Raise hips and chest together", severity: "safety", views: [...SIDE],
      measure: r => { // how much the knees straighten before the trunk rises 10°
        const f0 = r.f[0];
        const i = r.f.findIndex(f => f.trunkFromVertical < f0.trunkFromVertical - 10);
        return i > 0 ? r.f[i].knee - f0.knee : null;
      }, limit: { max: 40 }, unit: "°",
      source: { checkpoints: ["dl_09"], limit: "[Placeholder] knees straighten ≤ 40° before the trunk rises 10°" } },
    { code: "no_lockout", name: "Not locked out", cue: "Stand tall: hips and knees locked", severity: "technique", views: [...SIDE],
      measure: atPeak(f => Math.min(f.hip, f.knee)), limit: { min: 160 }, unit: "°",
      source: { checkpoints: ["dl_10"], limit: "[Placeholder] hip and knee ≥ 160° at the top" } },
    { code: "leaning_back", name: "Leaning back at lockout", cue: "Finish tall, don't lean back", severity: "technique", views: [...SIDE],
      measure: minOf(f => f.trunkLeanSigned), limit: { min: -10 }, unit: "°",
      source: { checkpoints: ["dl_10"], limit: "[Placeholder] trunk leans back ≤ 10° past vertical" } }
  ]
};

const pullUp: ExerciseDef = {
  id: "pull_up", datasetId: "pull_up", name: "Pull-Up (overhand grip)", short: "Pull-up", equipment: "Pull-up bar",
  mode: "reps", defaultView: "front", views: ["front", "side", "diagonal"],
  filming: "Phone 2–3 m in front of (or behind) you, low and tilted up so hands on the bar and feet are both in frame.",
  tips: [
    "Overhand grip, about shoulder-width or slightly wider (pu_01, pu_02).",
    "Start each rep from a full hang, arms straight (pu_03).",
    "Pull the shoulder blades down first; don't shrug (pu_04).",
    "Body straight, no swinging; don't cross the ankles (pu_06)."
  ],
  signal: { feature: f => f.elbow, label: "Elbow angle", rest: "high", enter: 145, exit: 150, mustReach: 100 },
  checks: [
    { code: "chin_below_bar", name: "Chin not over the bar", cue: "Pull until your chin clears the bar", severity: "technique", views: ["front", "side"],
      measure: atPeak(f => f.noseAboveWrist * 100), limit: { min: 0 }, unit: "% torso",
      source: { checkpoints: ["pu_05"], limit: "Dataset hint: nose above the hands (bar) at the top" } },
    { code: "no_full_hang", name: "No full hang at the bottom", cue: "Straighten your arms fully at the bottom", severity: "technique", views: ["front", "side"],
      measure: r => r.before ? r.before.elbow : maxAfter(f => f.elbow)(r), limit: { min: 160 }, unit: "°",
      source: { checkpoints: ["pu_03"], limit: "[Placeholder] elbow ≥ 160° before the pull (dataset hint: near 180°)" } },
    { code: "swinging", name: "Swinging / kipping", cue: "Stay still, no swinging", severity: "technique", views: ["side", "front"],
      measure: rangeOf(f => f.trunkLeanSigned), limit: { max: 20 }, unit: "°",
      source: { checkpoints: ["pu_06"], limit: "[Placeholder] body tilts ≤ 20° back and forth during the rep" } },
    { code: "fast_lowering", name: "Lowering too fast", cue: "Lower slowly, about 2–3 seconds", severity: "style", views: ["front", "side"],
      measure: fromPeakS, limit: { min: 1.5 }, unit: "s",
      source: { checkpoints: ["pu_07"], limit: "Dataset: 2–3 s lowering (BB); flagged under 1.5 s ([Placeholder] tolerance)" } },
    { code: "shrugging", name: "Shrugging at the start", cue: "Shoulders down, away from your ears", severity: "technique", views: ["front"],
      measure: r => r.before && r.f.length > 3 ? (1 - r.f[Math.min(3, r.f.length - 1)].earShoulderGap / r.before.earShoulderGap) * 100 : null, limit: { max: 30 }, unit: "% torso",
      source: { checkpoints: ["pu_04"], limit: "[Placeholder] ear–shoulder gap shrinks ≤ 30% at the start of the pull" } }
  ]
};

const row: ExerciseDef = {
  id: "barbell_bent_over_row", datasetId: "barbell_bent_over_row", name: "Barbell Bent-Over Row", short: "Bent-over row", equipment: "Barbell with plates",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at hip height, 2–3 m to your side, whole body and the bar in frame.",
  tips: [
    "Feet about shoulder-width, knees slightly bent (row_02).",
    "Overhand grip, medium to slightly wider than shoulders (row_03).",
    "Back flat, core braced, neck neutral (row_05). Spine shape isn't checked.",
    "Pull to the lower chest / lower ribs, squeeze the shoulder blades (row_06, row_08)."
  ],
  signal: { feature: f => f.elbow, label: "Elbow angle", rest: "high", enter: 150, exit: 155, mustReach: 115 },
  checks: [
    { code: "torso_too_upright", name: "Torso too upright", cue: "Hinge further forward", severity: "technique", views: [...SIDE],
      measure: atPeak(f => 90 - f.trunkFromVertical), limit: { max: 60 }, unit: "°",
      source: { checkpoints: ["row_04"], limit: "Dataset: 0–60° above horizontal across sources (SL ~0–20°, most 45°, WM 60°); flagged above 60°" } },
    { code: "torso_swing", name: "Torso rises / swings", cue: "Keep your torso still", severity: "technique", views: [...SIDE],
      measure: rangeOf(f => f.trunkFromVertical), limit: { max: 10 }, unit: "°",
      source: { checkpoints: ["row_04", "row_09"], limit: "[Placeholder] trunk angle changes ≤ 10° during a rep (sources: keep it constant)" } },
    { code: "short_pull", name: "Bar not pulled high enough", cue: "Pull the bar to your lower chest", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.elbow), limit: { max: 100 }, unit: "°",
      source: { checkpoints: ["row_06", "row_07"], limit: "[Placeholder] elbow ≤ 100° at the top of the pull" } },
    { code: "no_full_extension", name: "Arms not fully lowered", cue: "Lower until your arms are straight", severity: "style", views: [...SIDE],
      measure: r => r.before ? r.before.elbow : maxAfter(f => f.elbow)(r), limit: { min: 155 }, unit: "°",
      source: { checkpoints: ["row_09"], limit: "[Placeholder] elbow ≥ 155° between reps" } }
  ]
};

const overheadPress: ExerciseDef = {
  id: "overhead_press", datasetId: "overhead_press", name: "Barbell Overhead (Standing) Press", short: "Overhead press", equipment: "Barbell, rack",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at chest height, 2–3 m to your side, whole body and the bar at lockout in frame.",
  tips: [
    "Grip just outside the shoulders, forearms vertical, wrists stacked (oh_01, oh_02).",
    "Bar on the front of the shoulders to start (oh_04).",
    "Squeeze glutes and abs, ribs down (oh_06). Breathe in and brace before each rep (oh_13).",
    "Move the head back as the bar passes, then 'through the window' (oh_08)."
  ],
  signal: { feature: f => f.elbow, label: "Elbow angle", rest: "low", enter: 110, exit: 100, mustReach: 150 },
  checks: [
    { code: "layback", name: "Leaning back", cue: "Squeeze glutes, ribs down, don't lean back", severity: "safety", views: [...SIDE],
      measure: minOf(f => f.trunkLeanSigned), limit: { min: -10 }, unit: "°",
      source: { checkpoints: ["oh_12", "oh_06"], limit: "[Placeholder] trunk leans back ≤ 10° (sources: slight arch tolerated, notable not)" } },
    { code: "no_lockout", name: "Not locked out overhead", cue: "Lock the elbows, arms vertical", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.elbow), limit: { min: 160 }, unit: "°",
      source: { checkpoints: ["oh_09"], limit: "[Placeholder] elbow ≥ 160° at the top" } },
    { code: "bar_forward", name: "Bar ends in front", cue: "Finish with the bar over mid-foot", severity: "technique", views: [...SIDE],
      measure: atPeak(f => Math.abs(f.wristAheadOfMidfoot) * 100), limit: { max: 12 }, unit: "% leg",
      source: { checkpoints: ["oh_07"], limit: "[Placeholder] hands ≤ 12% of leg length from mid-foot at lockout" } },
    { code: "using_legs", name: "Using the legs", cue: "Keep your legs straight: strict press", severity: "style", views: [...SIDE],
      measure: minOf(f => f.knee), limit: { min: 160 }, unit: "°",
      source: { checkpoints: ["oh_05"], limit: "[Placeholder] knees stay ≥ 160° (SL: legs straight)" } }
  ]
};

const curl: ExerciseDef = {
  id: "barbell_curl", datasetId: "barbell_curl", name: "Standing Barbell Biceps Curl", short: "Barbell curl", equipment: "Barbell or EZ bar",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at chest height, 2–3 m to your side, upper body and hips in frame.",
  tips: [
    "Feet shoulder-width, standing tall (cu_01).",
    "Underhand grip about shoulder-width (cu_02).",
    "Glutes and core tight, shoulder blades slightly together (cu_03).",
    "Exhale as you curl, inhale as you lower (PF; sources disagree)."
  ],
  signal: { feature: f => f.elbow, label: "Elbow angle", rest: "high", enter: 135, exit: 145, mustReach: 90 },
  checks: [
    { code: "torso_swing", name: "Swinging the torso", cue: "No swinging: keep your torso still", severity: "technique", views: [...SIDE],
      measure: rangeOf(f => f.trunkLeanSigned), limit: { max: 8 }, unit: "°",
      source: { checkpoints: ["cu_07"], limit: "[Placeholder] trunk angle changes ≤ 8° during a rep" } },
    { code: "elbows_forward", name: "Elbows drift forward", cue: "Pin your elbows to your sides", severity: "technique", views: [...SIDE],
      measure: maxOf(f => f.upperArmFromTorso), limit: { max: 25 }, unit: "°",
      source: { checkpoints: ["cu_04"], limit: "[Placeholder] upper arm ≤ 25° from the torso" } },
    { code: "partial_curl", name: "Partial curl", cue: "Curl all the way up", severity: "style", views: [...SIDE],
      measure: atPeak(f => f.elbow), limit: { max: 65 }, unit: "°",
      source: { checkpoints: ["cu_05"], limit: "[Placeholder] elbow ≤ 65° at the top" } }
  ]
};

const dip: ExerciseDef = {
  id: "parallel_bar_dip", datasetId: "parallel_bar_dip", name: "Parallel-Bar Dip", short: "Dip", equipment: "Parallel bars",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at hip height, 2–3 m to your side, the bars and your whole body in frame.",
  tips: [
    "Neutral grip, palms facing each other (dp_01).",
    "Brace core and glutes (dp_03).",
    "Shoulders down and back, no shrugging (dp_05).",
    "Elbows track back, don't flare (dp_06)."
  ],
  signal: { feature: f => f.elbow, label: "Elbow angle", rest: "high", enter: 150, exit: 155, mustReach: 135 },
  checks: [
    { code: "not_deep_enough", name: "Not deep enough", cue: "Lower until your elbows reach about 90°", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.elbow), limit: { max: 100 }, unit: "°",
      source: { checkpoints: ["dp_07"], limit: "Dataset: elbows 90° (FB); flagged above 100° ([Placeholder] tolerance). Sources conflict on depth" } },
    { code: "fast_lowering", name: "Dropping too fast", cue: "Lower slowly, under control", severity: "safety", views: [...SIDE],
      measure: toPeakS, limit: { min: 1.0 }, unit: "s",
      source: { checkpoints: ["dp_08"], limit: "[Placeholder] lowering takes ≥ 1 s" } },
    { code: "torso_swing", name: "Torso angle changes", cue: "Keep the same torso angle", severity: "style", views: [...SIDE],
      measure: rangeOf(f => f.trunkFromVertical), limit: { max: 15 }, unit: "°",
      source: { checkpoints: ["dp_04"], limit: "[Placeholder] trunk angle changes ≤ 15° in a rep (GF: keep it constant)" } }
  ]
};

const lunge: ExerciseDef = {
  id: "forward_lunge", datasetId: "forward_lunge", name: "Forward Lunge (bodyweight)", short: "Forward lunge", equipment: "None",
  mode: "reps", defaultView: "side", views: ["side", "front", "diagonal"],
  filming: "Phone at hip height, 2–3 m to your side; step toward or away from it is fine as long as both feet stay in frame.",
  tips: [
    "Start with feet hip- to shoulder-width (lu_01).",
    "Step long enough for a 90° front knee (lu_02).",
    "Land heel first, front heel stays down (lu_03).",
    "Front and back knee point straight forward (lu_07)."
  ],
  signal: { feature: f => Math.min(f.kneeL, f.kneeR), label: "Knee angle", rest: "high", enter: 150, exit: 155, mustReach: 135 },
  checks: [
    { code: "not_deep_enough", name: "Not deep enough", cue: "Lower until both knees are about 90°", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.frontKnee), limit: { max: 100 }, unit: "°",
      source: { checkpoints: ["lu_05"], limit: "Dataset: knees about 90° (consensus); flagged above 100° ([Placeholder] tolerance)" } },
    { code: "knee_past_toes", name: "Front knee past the toes", cue: "Keep the front knee over the ankle", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.frontKneePastToes * 100), limit: { max: 2 }, unit: "% leg",
      source: { checkpoints: ["lu_04"], limit: "[Placeholder] front knee ≤ 2% of leg length past the toes" } },
    { code: "torso_lean", name: "Leaning forward", cue: "Keep your torso upright", severity: "technique", views: [...SIDE],
      measure: atPeak(f => f.trunkFromVertical), limit: { max: 15 }, unit: "°",
      source: { checkpoints: ["lu_08"], limit: "[Placeholder] trunk ≤ 15° from vertical at the bottom" } }
  ]
};

const plank: ExerciseDef = {
  id: "forearm_plank", datasetId: "forearm_plank", name: "Forearm Plank", short: "Plank", equipment: "Mat",
  mode: "hold", defaultView: "side", views: ["side"],
  filming: "Phone on the floor 2 m to your side, whole body from head to heels in frame.",
  tips: [
    "Toes tucked under, feet about hip-width (pl_02).",
    "Squeeze glutes, pull the belly in (pl_06).",
    "Breathe steadily, never hold your breath (pl_07).",
    "Stop if your lower back hurts (pl_09)."
  ],
  hold: {
    inPosition: f => f.bodyFromHorizontal < 30 && f.upperArmFromVertical < 45,
    targetS: 60, targetSource: "pl_08: about 60 s is a good goal (IH, SH); sources disagree"
  },
  checks: [
    { code: "hips_sagging", name: "Hips sagging", cue: "Lift your hips into a straight line", severity: "safety", views: [...SIDE],
      measure: pct(f => f.hipOffLine * 100, 0.8), limit: { max: 5 }, unit: "% line",
      source: { checkpoints: ["pl_03", "pl_04"], limit: "[Placeholder] hips ≤ 5% of body length below the shoulder–ankle line (80th percentile of the hold)" } },
    { code: "hips_piked", name: "Hips piked up", cue: "Lower your hips into a straight line", severity: "technique", views: [...SIDE],
      measure: pct(f => -f.hipOffLine * 100, 0.8), limit: { max: 7 }, unit: "% line",
      source: { checkpoints: ["pl_03", "pl_04"], limit: "[Placeholder] hips ≤ 7% of body length above the line" } },
    { code: "elbows_not_under_shoulders", name: "Elbows not under the shoulders", cue: "Elbows directly under your shoulders", severity: "technique", views: [...SIDE],
      measure: pct(f => Math.abs(f.elbowAheadOfShoulder) * 100, 0.5), limit: { max: 35 }, unit: "% torso",
      source: { checkpoints: ["pl_01"], limit: "[Placeholder] elbow ≤ 35% of upper-arm length from under the shoulder" } },
    { code: "head_not_neutral", name: "Head not neutral", cue: "Look at the floor just ahead of your hands", severity: "style", views: [...SIDE],
      measure: pct(f => f.headOffTrunk, 0.5), limit: { max: 25 }, unit: "°",
      source: { checkpoints: ["pl_05"], limit: "[Placeholder] head ≤ 25° out of line with the trunk" } }
  ]
};

export const CATALOG: ExerciseDef[] = [backSquat, benchPress, deadlift, pullUp, row, overheadPress, curl, dip, lunge, plank];
export const byId = (id: string) => CATALOG.find(e => e.id === id);
/** Error code → display name/cue across all catalog exercises. */
export function checkInfo(exerciseId: string, code: string): CheckDef | undefined {
  return byId(exerciseId)?.checks.find(c => c.code === code);
}
