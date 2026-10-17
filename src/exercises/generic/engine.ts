// Coach for every exercise in the catalog: smoothing, framing check, rep (or hold) detection on the
// exercise's signal, and scoring each finished rep with the exercise's checks. No DOM.
import { PoseSmoother, type Pose, type WorldPose } from "../../pose/types";
import { Lifter, type BodyDims, type Lifted } from "../../pose/lift";
import { computeFeatures, computeFeatures3D, type BodyAxes, type Features } from "./features";
import type { CameraView, ExerciseDef, RepSeries } from "./types";

const AFTER_S = 0.6;     // frames kept after a rep for lockout checks
const MAX_REP_S = 15;
const MIN_FRAMES = 8;
const MIN_REST_S = 0.3;  // a rep only starts after being at rest this long (no phantom rep while walking up or setting up)
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r1 = (v: number) => Math.round(v * 10) / 10;

export interface GenericRep {
  n: number;
  start: number; end: number;
  /** Seconds from start to the deepest point, and from there back to rest. */
  downTime: number; upTime: number;
  metrics: Record<string, number | null>;
  issues: string[];
  trackingOk: boolean;
  trackingProblems: string[];
  frames: { t: number; lm: number[][]; world?: number[][] }[];
}

export type GenericState =
  | { phase: "no-person"; banner: string }
  | { phase: "tracking"; pose: Pose; banner: string | null; event: "start" | GenericRep | null;
      signal: number | null; features: Features | null; holdS: number | null; failing: string[];
      /** 3D skeleton and body axes when world landmarks were available (for the ghost). */
      lifted: Lifted | null; axes: BodyAxes | null };

interface Active {
  start: number; peak: number; peakIdx: number;
  t: number[]; f: Features[]; signal: number[]; frames: GenericRep["frames"];
  before: Features | null; after: Features[]; endT: number | null; lowVis: number;
}

export class GenericCoach {
  private smoother = new PoseSmoother(0.5);
  private active: Active | null = null;
  private restRef = NaN;   // signal value at rest (the extreme seen while resting)
  private restT = 0;       // last time the signal was at rest
  private lastRest: Features | null = null;
  private restSince: number | null = null;
  private lastRepEnd = -Infinity;   // touch-and-go: a rep right after the previous one needs no pause
  private count = 0;
  private outSince: number | null = null;   // hold mode: time the person left the position

  private lifter: Lifter;
  /** True while features come from the 3D skeleton (then side-view checks also run from the front or at 45°). */
  private lifted = false;

  constructor(public def: ExerciseDef, public aspect: number, public view: CameraView = def.defaultView, body: BodyDims | null = null) {
    this.lifter = new Lifter(body);
  }

  get repCount() { return this.count; }
  get inRep() { return this.active !== null && this.active.endT === null; }

  step(t: number, raw: Pose | null, world: WorldPose | null): GenericState {
    if (!raw) {
      this.smoother.reset();
      return { phase: "no-person", banner: "Step into the frame so the camera can see you." };
    }
    const pose = this.smoother.push(raw);
    const lifted = this.lifter.lift(pose, world, this.aspect);
    let f: Features, axes: BodyAxes | null = null;
    if (lifted) ({ f, axes } = computeFeatures3D(lifted.pts, pose));
    else f = computeFeatures(pose, this.aspect);
    this.lifted = lifted !== null;
    if (f.visibility < 0.5) {
      return { phase: "tracking", pose, banner: "Make sure your whole body is in view.", event: this.flushIfStale(t), signal: null, features: null, holdS: null, failing: [], lifted, axes };
    }
    const frame = {
      t: 0,
      lm: pose.map(q => [r4(q.x), r4(q.y), r4(q.z), r4(q.v)]),
      ...(world ? { world: world.map(q => [r4(q.x), r4(q.y), r4(q.z)]) } : {})
    };
    const ev = this.def.mode === "hold" ? this.stepHold(t, f, frame) : this.stepReps(t, f, frame);
    const signal = this.def.signal ? this.def.signal.feature(f) : null;
    const holdS = this.def.mode === "hold" && this.active && this.active.endT === null ? t - this.active.start : null;
    return { phase: "tracking", pose, banner: null, event: ev, signal, features: f, holdS, failing: this.liveFailing(), lifted, axes };
  }

  /** Checks failing on the rep so far (for live cues); only checks that make sense mid-rep. */
  private liveFailing(): string[] {
    const a = this.active;
    if (!a || a.endT !== null || a.f.length < MIN_FRAMES) return [];
    const series = this.series(a);
    return this.checksForView().filter(c => liveSafe.has(c.code))
      .filter(c => { const v = c.measure(series); return v !== null && fails(v, c.limit); }).map(c => c.code);
  }

  /** Checks for the camera view. With the 3D skeleton, side-view checks also run from the front and at 45°. */
  private checksForView() {
    return this.def.checks.filter(c => c.views.includes(this.view) || (this.lifted && c.views.includes("side") && this.view !== "side"));
  }

  private stepReps(t: number, f: Features, frame: GenericRep["frames"][number]): "start" | GenericRep | null {
    const sig = this.def.signal!;
    const s = sig.feature(f);
    if (!Number.isFinite(s)) return null;
    const high = sig.rest === "high";
    const atRestSide = (v: number) => high ? v > sig.enter : v < sig.enter;
    let out: "start" | GenericRep | null = null;

    // Collecting the frames after a finished rep (lockout), then score it.
    if (this.active && this.active.endT !== null) {
      const a = this.active;
      const leftRest = !atRestSide(s);
      if (t - a.endT! < AFTER_S && !leftRest) { a.after.push(f); return null; }
      out = this.finish(a);
      this.active = null;
      if (!leftRest) { this.trackRest(t, s, f); return out; }
    }

    if (!this.active) {
      if (atRestSide(s)) { this.trackRest(t, s, f); return out; }
      // Away from rest without having been at rest first (walking up, unracking, setting up): not a rep.
      const rested = this.restSince !== null && (t - this.restSince >= MIN_REST_S || t - this.lastRepEnd < 3);
      if (!rested) { this.restSince = null; this.restRef = NaN; return out; }
      this.restSince = null;
      this.active = {
        start: t - this.restT < 3 ? this.restT : t, peak: s, peakIdx: 0,
        t: [], f: [], signal: [], frames: [], before: this.lastRest, after: [], endT: null, lowVis: 0
      };
      this.restRef = NaN;
      if (!out) out = "start";
    }

    const a = this.active;
    a.t.push(t); a.f.push(f); a.signal.push(s);
    a.frames.push({ ...frame, t: r4(t - a.start) });
    if (f.visibility < 0.6) a.lowVis++;
    if (high ? s < a.peak : s > a.peak) { a.peak = s; a.peakIdx = a.f.length - 1; }
    if (t - a.start > MAX_REP_S) { this.active = null; return out === "start" ? null : out; }
    const backToRest = high ? s > sig.exit : s < sig.exit;
    if (backToRest) { a.endT = t; this.lastRepEnd = t; this.restSince = t; }
    return out;
  }

  private trackRest(t: number, s: number, f: Features) {
    const high = this.def.signal!.rest === "high";
    if (this.restSince === null) this.restSince = t;
    if (!Number.isFinite(this.restRef) || (high ? s > this.restRef - 3 : s < this.restRef + 3)) {
      this.restT = t;
      this.restRef = Number.isFinite(this.restRef) ? (high ? Math.max(this.restRef, s) : Math.min(this.restRef, s)) : s;
      this.lastRest = f;   // baseline = a frame at the true rest position, not just before the rep threshold
    }
  }

  private stepHold(t: number, f: Features, frame: GenericRep["frames"][number]): GenericRep | "start" | null {
    const hold = this.def.hold!;
    const inPos = hold.inPosition(f);
    if (!this.active) {
      if (!inPos) return null;
      this.active = { start: t, peak: 0, peakIdx: 0, t: [], f: [], signal: [], frames: [], before: null, after: [], endT: null, lowVis: 0 };
      this.outSince = null;
      return "start";
    }
    const a = this.active;
    if (inPos) {
      this.outSince = null;
      a.t.push(t); a.f.push(f); a.signal.push(0);
      // Keep keypoints at ~5 per second for holds: enough for analysis, small enough to store.
      if (!a.frames.length || t - a.start - a.frames[a.frames.length - 1].t >= 0.2) a.frames.push({ ...frame, t: r4(t - a.start) });
      return null;
    }
    if (this.outSince === null) this.outSince = t;
    if (t - this.outSince < 1) return null;
    const rep = a.f.length >= MIN_FRAMES ? this.finish(a) : null;
    this.active = null;
    return rep;
  }

  /** A rep that ended but whose after-window never closed (e.g. the person walked out) is still scored. */
  private flushIfStale(t: number): GenericRep | null {
    const a = this.active;
    if (a && a.endT !== null && t - a.endT >= AFTER_S) { this.active = null; return this.finish(a); }
    return null;
  }

  private series(a: Active): RepSeries {
    return { t: a.t, f: a.f, signal: a.signal, peakIdx: a.peakIdx, after: a.after, before: a.before, start: a.start, end: a.endT ?? a.t[a.t.length - 1] };
  }

  private finish(a: Active): GenericRep | null {
    const sig = this.def.signal;
    const hold = this.def.mode === "hold";
    if (!hold && sig) {
      const reached = sig.rest === "high" ? a.peak <= sig.mustReach : a.peak >= sig.mustReach;
      if (!reached) return null;
    }
    const end = a.endT ?? a.t[a.t.length - 1];
    const problems: string[] = [];
    if (a.f.length < MIN_FRAMES) problems.push(`only ${a.f.length} frames`);
    if (a.lowVis > 0.3 * a.f.length) problems.push("body partly out of view");
    const series = this.series(a);
    const metrics: Record<string, number | null> = {};
    const issues: string[] = [];
    for (const c of this.checksForView()) {
      const v = c.measure(series);
      metrics[c.code] = v === null || !Number.isFinite(v) ? null : r1(v);
      if (!problems.length && v !== null && Number.isFinite(v) && fails(v, c.limit)) issues.push(c.code);
    }
    const peakT = a.t[a.peakIdx] ?? a.start;
    if (sig) metrics.peakSignal = r1(a.peak);
    if (hold) metrics.holdS = r1(end - a.start);
    return {
      n: ++this.count,
      start: a.start, end,
      downTime: hold ? end - a.start : peakT - a.start, upTime: hold ? 0 : end - peakT,
      metrics, issues, trackingOk: problems.length === 0, trackingProblems: problems, frames: a.frames
    };
  }
}

export const fails = (v: number, lim: { min?: number; max?: number }) =>
  (lim.min !== undefined && v < lim.min) || (lim.max !== undefined && v > lim.max);

/** Checks whose value over a partial rep already means the error happened (safe to cue live). */
const liveSafe = new Set(["knees_caving", "hips_sagging", "hips_piked", "heels_lifting", "swinging", "torso_swing", "leaning_back", "elbows_forward"]);
