// Squat thresholds. All are starting values for testing ([Placeholder] in docs/exercises/squat.md)
// except where that document cites a source. The coach sets final values; keep them editable.

export interface SquatThresholds {
  /** Depth target: hip-to-knee vertical gap left at the bottom, fraction of the standing gap. */
  depthGap: number;
  /** Extra allowance before a rep counts as too shallow (fraction of the standing gap). */
  depthTol: number;
  /** Min knee width ÷ ankle width at the bottom. */
  kneeMin: number;
  /** Max inward movement of either knee since standing, fraction of hip width (based on the [S1] criterion). */
  kneeInMax: number;
  /** Max left/right hip height difference, fraction of hip width. */
  hipTiltMax: number;
  /** Max heel rise, fraction of leg length. */
  heelMax: number;
  /** Max sideways drift of hips vs feet, fraction of hip width (change from standing). */
  shiftMax: number;
  /** Min time from top to bottom, seconds. */
  minDown: number;
}

export const DEFAULTS: SquatThresholds = {
  depthGap: 0.15, depthTol: 0.05, kneeMin: 0.9, kneeInMax: 0.15,
  hipTiltMax: 0.1, heelMax: 0.04, shiftMax: 0.15, minDown: 1.5
};

/** Matches the 'squat'/'front'/version 2 row in rule_sets (supabase/migrations). */
export const RULE_SET = { exercise: "squat", view: "front", version: 2 } as const;

export type SquatError =
  | "knees_caving" | "heels_lifting" | "not_deep_enough" | "shifting_sideways" | "hip_tilt" | "too_fast";

/** Priority for the spoken cue: safety first (docs/exercises/squat.md §4). */
export const ERROR_ORDER: SquatError[] = ["knees_caving", "heels_lifting", "not_deep_enough", "hip_tilt", "shifting_sideways", "too_fast"];

export const ERROR_TEXT: Record<SquatError, { name: string; cue: string }> = {
  knees_caving: { name: "Knees caving", cue: "Push your knees out over your toes" },
  heels_lifting: { name: "Heels lifting", cue: "Keep your heels down" },
  not_deep_enough: { name: "Not deep enough", cue: "Go a bit deeper" },
  hip_tilt: { name: "Hips tilting", cue: "Keep your hips level" },
  shifting_sideways: { name: "Shifting sideways", cue: "Keep your weight centered" },
  too_fast: { name: "Too fast", cue: "Slow down on the way down" }
};
