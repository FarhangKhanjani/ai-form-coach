import type { CameraView } from "../squat/config";
import type { Features } from "./features";

export type { CameraView };

/** Everything recorded for one rep (or one plank hold), as passed to each check. */
export interface RepSeries {
  t: number[];             // seconds since session start, one per frame of the rep
  f: Features[];           // features per frame of the rep
  signal: number[];        // the rep signal per frame
  peakIdx: number;         // index of the deepest point (bottom of a squat, top of a pull-up …)
  after: Features[];       // up to 0.6 s of frames after the rep returned to rest (lockout checks)
  before: Features | null; // last rest frame before the rep started
  start: number;           // when the movement left rest (seconds)
  end: number;             // when it came back to rest
}

export interface CheckDef {
  /** Error code stored in reps.issues and exercise_errors.code. */
  code: string;
  name: string;
  /** Short spoken/on-screen correction. */
  cue: string;
  severity: "safety" | "technique" | "style";
  /** Camera views that can measure this check. */
  views: CameraView[];
  /** The measured value for a rep, or null if it can't be measured. */
  measure: (r: RepSeries) => number | null;
  /** Flag when the value is below min or above max. */
  limit: { min?: number; max?: number };
  unit: "°" | "s" | "×" | "% leg" | "% torso" | "% line" | "";
  /** Dataset checkpoint ids this check implements, and where the limit comes from. */
  source: { checkpoints: string[]; limit: string };
}

export interface RepCriterion {
  /** Short text shown when the movement isn't counted, e.g. "hips dropped". */
  name: string;
  /** true = passed, false = failed, null = couldn't be measured (left out of the share). */
  test: (r: RepSeries) => boolean | null;
}

export interface RepSignalDef {
  /** Feature that goes away from rest and back once per rep. */
  feature: (f: Features) => number;
  label: string;
  /** Where the person is between reps: at the high or the low end of the signal. */
  rest: "high" | "low";
  /** Leaving rest past this value starts a rep. */
  enter: number;
  /** Coming back past this value ends it. */
  exit: number;
  /** The rep only counts if the signal gets at least this far (below it for rest=high, above for rest=low). */
  mustReach: number;
}

export interface ExerciseDef {
  id: string;
  name: string;
  short: string;
  equipment: string;
  mode: "reps" | "hold";
  defaultView: CameraView;
  views: CameraView[];
  /** Where to put the phone. */
  filming: string;
  /** Cues from the dataset the camera can't check (grip, breathing, bar placement …), shown before starting. */
  tips: string[];
  signal?: RepSignalDef;
  /**
   * What makes a movement a real rep of this exercise (not form checks). A movement is counted when at least
   * `countShare` of the criteria that could be measured pass. Without criteria, a rep counts when the signal
   * reaches `mustReach`.
   */
  countIf?: RepCriterion[];
  countShare?: number;
  hold?: { inPosition: (f: Features) => boolean; targetS: number; targetSource: string };
  checks: CheckDef[];
  /** Dataset exercise id (docs/research/exercise_technique_dataset.json). */
  datasetId: string;
}
