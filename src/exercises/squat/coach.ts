import { PoseSmoother, type Pose, type WorldPose } from "../../pose/types";
import { Calibrator, framingProblem, type Calibration } from "./calibration";
import { liveFlags, squatMetrics, type SquatMetrics } from "./metrics";
import { RepDetector, type Rep } from "./reps";
import type { SquatThresholds } from "./config";

const FEET_MOVED = 0.25;      // feet moved this far (fraction of leg length) → recalibrate
const FEET_MOVED_FRAMES = 15;

export type CoachState =
  | { phase: "no-person"; banner: string }
  | { phase: "calibrating"; pose: Pose; progress: number; banner: string | null; message: string | null }
  | { phase: "tracking"; pose: Pose; cal: Calibration; metrics: SquatMetrics | null; flags: ReturnType<typeof liveFlags> | null; banner: string | null; event: "calibrated" | "start" | Rep | null };

/**
 * Squat coach without any DOM: feed it pose frames, get back what to show.
 * Calibrates, recalibrates when the feet move, measures each frame, and detects and scores reps.
 */
export class SquatCoach {
  readonly smoother = new PoseSmoother(0.5);
  readonly calibrator = new Calibrator();
  readonly reps = new RepDetector();
  cal: Calibration | null = null;
  private movedFrames = 0;

  constructor(public th: SquatThresholds, public aspect: number) {}

  recalibrate() {
    this.cal = null; this.calibrator.reset(); this.smoother.reset(); this.reps.reset(); this.movedFrames = 0;
  }

  /** t: seconds. raw: landmarks of the first detected person, or null. */
  step(t: number, raw: Pose | null, world: WorldPose | null): CoachState {
    if (!raw) { this.smoother.reset(); return { phase: "no-person", banner: "Step into the frame so the camera can see you." }; }
    const pose = this.smoother.push(raw);

    if (!this.cal) {
      const st = this.calibrator.push(pose, this.aspect);
      if (st.done) {
        this.cal = st.cal; this.reps.reset(); this.movedFrames = 0;
        return { phase: "tracking", pose, cal: st.cal, metrics: null, flags: null, banner: null, event: "calibrated" };
      }
      return { phase: "calibrating", pose, progress: st.progress, banner: null, message: st.message };
    }

    const problem = framingProblem(pose, this.aspect);
    if (problem) return { phase: "tracking", pose, cal: this.cal, metrics: null, flags: null, banner: problem, event: null };

    const m = squatMetrics(pose, this.cal, this.th, this.aspect);
    if (!this.reps.inRep && m.feetMoved > FEET_MOVED) {
      if (++this.movedFrames >= FEET_MOVED_FRAMES) {
        this.recalibrate();
        this.smoother.push(raw);
        return { phase: "calibrating", pose, progress: 0, banner: null, message: "You moved. Stand still for a moment to recalibrate." };
      }
    } else this.movedFrames = 0;

    const flags = liveFlags(m, this.th);
    const ev = this.reps.step(t, m, pose, world, this.th);
    return { phase: "tracking", pose, cal: this.cal, metrics: m, flags, banner: null, event: ev };
  }
}
