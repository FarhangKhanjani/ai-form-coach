// Scripted side-view reps per catalog exercise (rest pose, good peak pose, and a faulty variant), for tests.
import type { PlanarSpec } from "./planar";

export interface Fixture {
  rest: PlanarSpec;
  peak: PlanarSpec;
  /**
   * Faulty reps: the error code they must trigger and how the rep moves.
   * keys = poses after the rest pose (default [peak, rest]); times = seconds per key (default [downS, upS]).
   * A fault may also replace the rest pose (e.g. a too-upright row).
   */
  faults: { code: string; peak?: PlanarSpec; rest?: PlanarSpec; keys?: PlanarSpec[]; times?: number[] }[];
  downS?: number; upS?: number;
}

const stand: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };
const bar: [number, number] = [0.5, 0.1];

export const FIXTURES: Record<string, Fixture> = {
  back_squat: {
    rest: { ...stand, upperArm: -40, forearm: 60 },
    peak: { shin: 25, thigh: -95, trunk: 40, upperArm: -10, forearm: 80 },
    faults: [
      { code: "not_deep_enough", peak: { shin: 20, thigh: -55, trunk: 30, upperArm: -10, forearm: 80 } },
      { code: "heels_lifting", peak: { shin: 25, thigh: -95, trunk: 40, upperArm: -10, forearm: 80, heelLift: 0.04 } },
      { code: "hips_rise_first", keys: [
        { shin: 25, thigh: -95, trunk: 40, upperArm: -10, forearm: 80 },
        { shin: 15, thigh: -40, trunk: 70, upperArm: -10, forearm: 80 },
        { ...stand, upperArm: -40, forearm: 60 }], times: [1.5, 0.8, 0.8] }
    ]
  },
  bench_press: {
    rest: { ...stand, upperArm: 90, forearm: 90, rotate: -90 },
    peak: { ...stand, upperArm: -30, forearm: 90, rotate: -90 },
    faults: [
      { code: "half_rep", peak: { ...stand, upperArm: 20, forearm: 90, rotate: -90 } },
      { code: "forearms_not_vertical", peak: { ...stand, upperArm: -30, forearm: 60, rotate: -90 } }
    ]
  },
  conventional_deadlift: {
    rest: { shin: 20, thigh: -70, trunk: 50, upperArm: 0, forearm: 0 },
    peak: { ...stand },
    faults: [
      { code: "no_lockout", peak: { shin: 5, thigh: -5, trunk: 30, upperArm: 0, forearm: 0 } },
      { code: "leaning_back", peak: { ...stand, trunk: -20 } }
    ]
  },
  pull_up: {
    rest: { ...stand, upperArm: 180, forearm: 180, anchor: { joint: "wrist", at: bar } },
    peak: { ...stand, upperArm: 20, forearm: 170, anchor: { joint: "wrist", at: bar } },
    faults: [
      { code: "chin_below_bar", peak: { ...stand, upperArm: 80, forearm: 175, anchor: { joint: "wrist", at: bar } } },
      { code: "fast_lowering", times: [1.2, 0.8] },
      { code: "swinging", keys: [
        { ...stand, trunk: -15, shin: 20, thigh: 25, upperArm: 160, forearm: 175, anchor: { joint: "wrist", at: bar } },
        { ...stand, trunk: 15, upperArm: 20, forearm: 170, anchor: { joint: "wrist", at: bar } },
        { ...stand, upperArm: 180, forearm: 180, anchor: { joint: "wrist", at: bar } }], times: [0.6, 0.8, 2.5] }
    ],
    downS: 1.2, upS: 2.5
  },
  barbell_bent_over_row: {
    rest: { shin: 10, thigh: -20, trunk: 60, upperArm: 0, forearm: 0 },
    peak: { shin: 10, thigh: -20, trunk: 60, upperArm: -60, forearm: 30 },
    faults: [
      { code: "torso_too_upright", rest: { shin: 10, thigh: -10, trunk: 20, upperArm: 0, forearm: 0 }, peak: { shin: 10, thigh: -10, trunk: 20, upperArm: -60, forearm: 30 } },
      { code: "torso_swing", peak: { shin: 10, thigh: -20, trunk: 35, upperArm: -60, forearm: 30 } }
    ]
  },
  overhead_press: {
    rest: { ...stand, upperArm: 30, forearm: 160 },
    peak: { ...stand, upperArm: 180, forearm: 180 },
    faults: [
      { code: "layback", peak: { ...stand, trunk: -20, upperArm: 160, forearm: 160 } },
      { code: "using_legs", keys: [
        { shin: 20, thigh: -25, trunk: 5, upperArm: 60, forearm: 165 },
        { ...stand, upperArm: 180, forearm: 180 },
        { ...stand, upperArm: 30, forearm: 160 }], times: [0.6, 0.8, 1.5] }
    ]
  },
  barbell_curl: {
    rest: { ...stand, upperArm: 0, forearm: 10 },
    peak: { ...stand, upperArm: 10, forearm: 150 },
    faults: [
      { code: "torso_swing", peak: { ...stand, trunk: -15, upperArm: 10, forearm: 150 } },
      { code: "elbows_forward", peak: { ...stand, upperArm: 45, forearm: 170 } }
    ]
  },
  parallel_bar_dip: {
    rest: { ...stand, trunk: 10, upperArm: 0, forearm: 0 },
    peak: { ...stand, trunk: 25, upperArm: -70, forearm: 15 },
    faults: [
      { code: "not_deep_enough", peak: { ...stand, trunk: 15, upperArm: -40, forearm: 15 } },
      { code: "fast_lowering", times: [0.5, 1.2] }
    ],
    downS: 1.6, upS: 1.2
  },
  forward_lunge: {
    rest: { ...stand, backLeg: { thighDown: 0, shinDown: 0 } },
    peak: { shin: 5, thigh: -85, trunk: 5, upperArm: 0, forearm: 0, backLeg: { thighDown: -10, shinDown: -95 } },
    faults: [
      { code: "not_deep_enough", peak: { shin: 5, thigh: -45, trunk: 5, upperArm: 0, forearm: 0, backLeg: { thighDown: -10, shinDown: -60 } } },
      { code: "torso_lean", peak: { shin: 5, thigh: -85, trunk: 35, upperArm: 0, forearm: 0, backLeg: { thighDown: -10, shinDown: -95 } } },
      { code: "knee_past_toes", peak: { shin: 40, thigh: -50, trunk: 5, upperArm: 0, forearm: 0, backLeg: { thighDown: -10, shinDown: -95 } } }
    ]
  },
  forearm_plank: {
    rest: { ...stand, upperArm: 90, forearm: 180, rotate: 90 },
    peak: { ...stand, upperArm: 90, forearm: 180, rotate: 90 },
    faults: [
      { code: "hips_sagging", peak: { shin: 0, thigh: 12, trunk: -12, upperArm: 102, forearm: 192, rotate: 90 } },
      { code: "hips_piked", peak: { shin: 0, thigh: -15, trunk: 15, upperArm: 75, forearm: 165, rotate: 90 } }
    ]
  }
};
