import { L, clamp, type Pose, type WorldPose } from "../../pose/types";
import type { SquatMetrics } from "./metrics";
import { ERROR_ORDER, type SquatError, type SquatThresholds } from "./config";

const START_R = 0.78, TOP_R = 0.85;   // hip-to-knee gap ratios that start and finish a rep
const MIN_DEPTH_R = 0.6;              // a movement that never gets below this isn't a squat
const MAX_REP_S = 12;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

export interface RepFrame { t: number; lm: number[][]; world?: number[][] }

export interface Rep {
  n: number;
  /** Seconds since the session started. */
  start: number;
  end: number;
  downTime: number;
  upTime: number;
  metrics: {
    depthPct: number; minR: number; kneeRatio: number; kneeInMax: number;
    heelLiftPct: number | null; shiftPct: number; hipTiltPct: number;
  };
  issues: SquatError[];
  trackingOk: boolean;
  trackingProblems: string[];
  frames: RepFrame[];
}

interface Active {
  start: number; minR: number; bottomT: number;
  minKr: number; maxKneeIn: number; maxHl: number | null; maxShift: number; maxTilt: number;
  frames: RepFrame[];
}

/** Finds reps in the stream of frame metrics and scores each one when it finishes. */
export class RepDetector {
  private active: Active | null = null;
  private topT = 0;
  private topR = -Infinity;
  private count = 0;

  reset() { this.active = null; this.topR = -Infinity; }
  get inRep() { return this.active !== null; }
  get repCount() { return this.count; }

  /** Feed one frame. Returns "start" when a rep begins, a Rep when one ends, or null. */
  step(t: number, m: SquatMetrics, pose: Pose, world: WorldPose | null, th: SquatThresholds): "start" | Rep | null {
    if (!this.active) {
      // Remember when the hips were last at their highest so down time includes the start of the descent.
      if (m.r > this.topR - 0.03) { this.topT = t; this.topR = Math.max(this.topR, m.r); }
      if (m.r < START_R) {
        this.active = {
          start: t - this.topT < 3 ? this.topT : t, minR: m.r, bottomT: t,
          minKr: Infinity, maxKneeIn: -Infinity, maxHl: null, maxShift: 0, maxTilt: 0, frames: []
        };
        return "start";
      }
      return null;
    }
    const a = this.active;
    a.frames.push({
      t: r4(t - a.start),
      lm: pose.map(q => [r4(q.x), r4(q.y), r4(q.z), r4(q.v)]),
      ...(world ? { world: world.map(q => [r4(q.x), r4(q.y), r4(q.z)]) } : {})
    });
    if (m.r < a.minR) { a.minR = m.r; a.bottomT = t; }
    if (m.p > 0.4) {
      a.minKr = Math.min(a.minKr, m.kneeRatio);
      a.maxKneeIn = Math.max(a.maxKneeIn, m.kneeInside.L, m.kneeInside.R);
      if (m.heelLift !== null) a.maxHl = Math.max(a.maxHl ?? -Infinity, m.heelLift);
      if (Math.abs(m.shift) > Math.abs(a.maxShift)) a.maxShift = m.shift;
      if (Math.abs(m.hipTilt) > Math.abs(a.maxTilt)) a.maxTilt = m.hipTilt;
    }
    if (t - a.start > MAX_REP_S) { this.active = null; this.topR = -Infinity; return null; }
    if (m.r <= TOP_R) return null;

    this.active = null;
    this.topR = m.r; this.topT = t;
    if (a.minR > MIN_DEPTH_R) return null;
    const problems = trackingProblems(a.frames);
    const rep: Rep = {
      n: ++this.count,
      start: a.start, end: t,
      downTime: a.bottomT - a.start, upTime: t - a.bottomT,
      metrics: {
        depthPct: Math.round(clamp((1 - a.minR) / (1 - th.depthGap), 0, 1.5) * 100),
        minR: r4(a.minR),
        kneeRatio: r4(isFinite(a.minKr) ? a.minKr : 1),
        kneeInMax: r4(isFinite(a.maxKneeIn) ? a.maxKneeIn : 0),
        heelLiftPct: a.maxHl === null ? null : Math.round(a.maxHl * 1000) / 10,
        shiftPct: Math.round(a.maxShift * 1000) / 10,
        hipTiltPct: Math.round(a.maxTilt * 1000) / 10
      },
      issues: [],
      trackingOk: problems.length === 0,
      trackingProblems: problems,
      frames: a.frames
    };
    if (rep.trackingOk) rep.issues = scoreRep(a, rep.downTime, th);
    return rep;
  }
}

function scoreRep(a: Active, downTime: number, th: SquatThresholds): SquatError[] {
  const found = new Set<SquatError>();
  if (a.minKr < th.kneeMin || a.maxKneeIn > th.kneeInMax) found.add("knees_caving");
  if (a.maxHl !== null && a.maxHl > th.heelMax) found.add("heels_lifting");
  if (a.minR > th.depthGap + th.depthTol) found.add("not_deep_enough");
  if (Math.abs(a.maxTilt) > th.hipTiltMax) found.add("hip_tilt");
  if (Math.abs(a.maxShift) > th.shiftMax) found.add("shifting_sideways");
  if (downTime < th.minDown) found.add("too_fast");
  return ERROR_ORDER.filter(e => found.has(e));
}

/** Reasons a rep's keypoints can't be trusted (session 1: glitches were scored as reps). */
export function trackingProblems(frames: RepFrame[]): string[] {
  const out: string[] = [];
  if (frames.length < 10) out.push(`only ${frames.length} frames`);
  const legs = [L.hipL, L.hipR, L.kneeL, L.kneeR, L.ankleL, L.ankleR];
  const off = frames.filter(f => legs.some(i => f.lm[i][0] < -0.02 || f.lm[i][0] > 1.02 || f.lm[i][1] < -0.02 || f.lm[i][1] > 1.02)).length;
  if (off) out.push(`legs outside the frame in ${off} frames`);
  const crossed = frames.filter(f => f.lm[L.ankleL][0] - f.lm[L.ankleR][0] <= 0.01).length;
  if (crossed) out.push(`left/right feet swapped or overlapping in ${crossed} frames`);
  const lowVis = frames.filter(f => f.lm[L.ankleL][3] < 0.5 || f.lm[L.ankleR][3] < 0.5).length;
  if (frames.length && lowVis > 0.3 * frames.length) out.push("feet poorly visible");
  return out;
}
