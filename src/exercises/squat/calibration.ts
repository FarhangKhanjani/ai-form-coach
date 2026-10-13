import { L, mid, type Pose } from "../../pose/types";
import type { CameraView } from "./config";

export interface Calibration {
  /** Averaged standing pose (normalized x/y). */
  pts: { x: number; y: number }[];
  /** Standing hip-to-knee vertical gap. */
  standGap: number;
  /** Standing hip-to-ankle vertical distance. */
  legLen: number;
  hipWidth: number;
  /** Standing (hip mid − ankle mid) ÷ hip width; later shift is measured as a change from this. */
  shift0: number;
  /** Standing left/right hip height difference ÷ hip width (camera roll, uneven hips); tilt is measured as a change from this. */
  tilt0: number;
  /** Standing knee position inside its ankle, fraction of hip width; inward knee movement is measured from this. */
  kneeIn0: { L: number; R: number };
  heelY: { L: number; R: number };
  ankleMid: { x: number; y: number };
}

export const CAL_FRAMES = 40;
const STILL = 0.006;          // mean landmark movement per frame, normalized units
const KEY = [L.shoulderL, L.shoulderR, L.hipL, L.hipR, L.kneeL, L.kneeR, L.ankleL, L.ankleR];
// Rejection limits for a usable standing pose (session 1: a bad baseline made every rep look shifted)
const MAX_SHIFT0 = 0.15;      // hips must sit over the feet, fraction of hip width
const MAX_FEET_TILT = 0.08;   // left vs right ankle height, fraction of leg length

/** Problems with the current frame that stop calibration or tracking, as a user-facing message. */
export function framingProblem(p: Pose, aspect: number, view: CameraView = "front"): string | null {
  if (view !== "front") {
    // From the side the far leg is often hidden behind the near one: one visible side is enough.
    const pairs: [number, number][] = [[L.shoulderL, L.shoulderR], [L.hipL, L.hipR], [L.kneeL, L.kneeR], [L.ankleL, L.ankleR]];
    return pairs.every(([a, b]) => Math.max(p[a].v, p[b].v) > 0.5) ? null : "Make sure the whole body, including the feet, is in view.";
  }
  if (!KEY.every(i => p[i].v > 0.5)) return "Step back until your whole body, including your feet, is in view.";
  const sw = Math.hypot((p[L.shoulderL].x - p[L.shoulderR].x) * aspect, p[L.shoulderL].y - p[L.shoulderR].y);
  const sm = mid(p[L.shoulderL], p[L.shoulderR]), hm = mid(p[L.hipL], p[L.hipR]);
  const torso = Math.hypot((sm.x - hm.x) * aspect, sm.y - hm.y);
  if (sw < 0.35 * torso) return "Turn to face the camera. This view reads you from the front.";
  if (p[L.ankleL].x - p[L.ankleR].x < 0.01) return "Face the camera with your feet apart.";
  return null;
}

export type CalStep =
  | { done: false; progress: number; message: string | null }
  | { done: true; cal: Calibration };

/** Collects still standing frames and turns them into a calibration. */
export class Calibrator {
  private samples: { x: number; y: number }[][] = [];
  private prev: { x: number; y: number }[] | null = null;
  private message: string | null = null;

  reset() { this.samples = []; this.prev = null; this.message = null; }

  push(p: Pose, aspect: number, view: CameraView = "front"): CalStep {
    const problem = framingProblem(p, aspect, view);
    if (problem) { this.samples = []; this.prev = null; return { done: false, progress: 0, message: problem }; }
    const cur = p.map(q => ({ x: q.x, y: q.y }));
    if (this.prev) {
      const prev = this.prev;
      const move = KEY.reduce((m, i) => m + Math.hypot(cur[i].x - prev[i].x, cur[i].y - prev[i].y), 0) / KEY.length;
      if (move > STILL) this.samples = [];
      else this.samples.push(cur);
    }
    this.prev = cur;
    if (this.samples.length < CAL_FRAMES) return { done: false, progress: this.samples.length / CAL_FRAMES, message: this.message };

    const n = this.samples.length;
    const pts = cur.map((_, i) => ({
      x: this.samples.reduce((a, f) => a + f[i].x, 0) / n,
      y: this.samples.reduce((a, f) => a + f[i].y, 0) / n
    }));
    this.samples = [];
    const result = buildCalibration(pts, aspect, view);
    if (typeof result === "string") { this.message = result; return { done: false, progress: 0, message: result }; }
    return { done: true, cal: result };
  }
}

/** Builds a calibration from an averaged standing pose, or returns why it can't be used. */
export function buildCalibration(pts: { x: number; y: number }[], aspect: number, view: CameraView = "front"): Calibration | string {
  const hip = mid(pts[L.hipL], pts[L.hipR]), knee = mid(pts[L.kneeL], pts[L.kneeR]), ankle = mid(pts[L.ankleL], pts[L.ankleR]);
  const standGap = knee.y - hip.y, legLen = ankle.y - hip.y;
  // From the side the hips overlap, so hip width is near zero; it is only used by front-view checks.
  const hipWidth = Math.max(Math.abs(pts[L.hipL].x - pts[L.hipR].x), view === "front" ? 0 : 0.01);
  if (standGap < 0.03 || hipWidth < 0.01) return "You're quite far away. Move a little closer and hold still.";
  const shift0 = (hip.x - ankle.x) / hipWidth;
  if (view === "front") {
    if (Math.abs(shift0) > MAX_SHIFT0) return "Stand centered over your feet, facing the camera straight on, and hold still.";
    if (Math.abs(pts[L.ankleL].y - pts[L.ankleR].y) > MAX_FEET_TILT * legLen)
      return "One foot looks higher than the other. Face the camera straight on, phone upright, and hold still.";
  }
  return {
    pts, standGap, legLen, hipWidth, shift0,
    tilt0: (pts[L.hipL].y - pts[L.hipR].y) / (hipWidth * aspect),
    kneeIn0: { L: (pts[L.ankleL].x - pts[L.kneeL].x) / hipWidth, R: (pts[L.kneeR].x - pts[L.ankleR].x) / hipWidth },
    heelY: { L: pts[L.heelL].y, R: pts[L.heelR].y },
    ankleMid: ankle
  };
}
