import { describe, expect, it } from "vitest";
import { SquatCoach } from "./coach";
import { DEFAULTS, type CameraView } from "./config";
import type { Rep } from "./reps";
import { scriptedPose, seededNoise, type Segment } from "./synthetic";

const FPS = 30, ASPECT = 4 / 3;

function run(script: Segment[], view: CameraView = "front") {
  const coach = new SquatCoach({ ...DEFAULTS }, ASPECT, view);
  const noise = seededNoise();
  const reps: Rep[] = [];
  const messages = new Set<string>();
  let calibrations = 0;
  for (let f = 0; ; f++) {
    const t = f / FPS;
    const pose = scriptedPose(script, t, noise);
    if (!pose) break;
    const st = coach.step(t, pose, null);
    if (st.phase === "calibrating" && st.message) messages.add(st.message);
    if (st.phase === "tracking" && st.event === "calibrated") calibrations++;
    if (st.phase === "tracking" && st.event && typeof st.event === "object") reps.push(st.event);
  }
  return { reps, messages, calibrations, coach };
}

const hold = (dur: number, extra: Partial<Segment> = {}): Segment => ({ kind: "hold", dur, ...extra });
const rep = (label: string, extra: Partial<Segment> = {}): Segment => ({ kind: "rep", dur: 4, down: 2.5, label, ...extra });

describe("squat coach on scripted front-view squats", () => {
  it("scores a clean rep and one rep per error", () => {
    const script = [
      hold(3), rep("good"), hold(1),
      rep("fast", { dur: 1.6, down: 0.7 }), hold(1),
      rep("knees", { err: { caving: true } }), hold(1),
      rep("shallow", { err: { shallow: true } }), hold(1),
      rep("heels", { err: { heels: true } }), hold(1),
      rep("shift", { err: { shift: true } }), hold(1),
      rep("tilt", { err: { tilt: true } }), hold(1),
      rep("good"), hold(1.5)
    ];
    const want: Record<string, string[]> = {
      good: [], fast: ["too_fast"], knees: ["knees_caving"], shallow: ["not_deep_enough"],
      heels: ["heels_lifting"], shift: ["shifting_sideways"], tilt: ["hip_tilt"]
    };
    const { reps } = run(script);
    const labels = script.filter(s => s.kind === "rep").map(s => s.label!);
    expect(reps.map(r => r.trackingOk)).toEqual(labels.map(() => true));
    expect(reps.map(r => r.issues)).toEqual(labels.map(l => want[l]));
  });

  it("measures down time from the start of the descent", () => {
    const { reps } = run([hold(3), rep("good", { down: 2.5 }), hold(1)]);
    expect(reps[0].downTime).toBeGreaterThan(2.3);
    expect(reps[0].downTime).toBeLessThan(2.7);
  });

  it("refuses to calibrate when standing turned away from the camera (session 1 bug)", () => {
    const { messages, calibrations } = run([hold(4, { turned: true })]);
    expect(calibrations).toBe(0);
    expect([...messages].some(m => /centered|straight on/.test(m))).toBe(true);
  });

  it("recalibrates when the user moves after calibrating (session 1 bug)", () => {
    const { reps, calibrations, messages } = run([
      hold(3), hold(4, { offset: [0, -0.12] }), rep("good", { offset: [0, -0.12] }), hold(1, { offset: [0, -0.12] })
    ]);
    expect(calibrations).toBe(2);
    expect(messages.has("You moved. Stand still for a moment to recalibrate.")).toBe(true);
    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toEqual([]);
  });

  it("does not score tracking glitches as reps (session 1 bug)", () => {
    const { reps } = run([hold(3), rep("good"), hold(0.5), { kind: "hold", dur: 0.4, glitch: true }, hold(1.5)]);
    const scored = reps.filter(r => r.trackingOk);
    expect(scored).toHaveLength(1);
    expect(scored[0].issues).toEqual([]);
    expect(reps.filter(r => !r.trackingOk).every(r => r.issues.length === 0)).toBe(true);
  });

  it("side view: calibrates without facing the camera and only scores what the side can see", () => {
    const { reps, calibrations } = run([
      hold(3, { turned: true }), rep("knees", { turned: true, err: { caving: true } }), hold(1, { turned: true }),
      rep("shallow", { turned: true, err: { shallow: true } }), hold(1, { turned: true })
    ], "side");
    expect(calibrations).toBe(1);
    expect(reps.map(r => r.issues)).toEqual([[], ["not_deep_enough"]]);
  });
});
