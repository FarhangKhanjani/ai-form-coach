import { describe, expect, it } from "vitest";
import { squatAngles, fromVertical } from "./angles";
import type { WorldPose } from "./types";

/** A side-symmetric pose built from joint positions in metres (y down, z toward the camera). */
function pose(p: { shoulder: [number, number]; hip: [number, number]; knee: [number, number]; ankle: [number, number] }): WorldPose {
  const w: WorldPose = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  // [y, z] per joint: sagittal-plane positions, mirrored left/right at x = ±0.1
  const put = (iL: number, iR: number, [y, z]: [number, number]) => { w[iL] = { x: 0.1, y, z }; w[iR] = { x: -0.1, y, z }; };
  put(11, 12, p.shoulder); put(23, 24, p.hip); put(25, 26, p.knee); put(27, 28, p.ankle);
  return w;
}

describe("squat joint angles from world landmarks", () => {
  it("standing tall: everything near 0", () => {
    const a = squatAngles(pose({ shoulder: [-0.5, 0], hip: [0, 0], knee: [0.45, 0], ankle: [0.9, 0] }));
    expect(a.kneeFlex.L).toBeCloseTo(0, 5);
    expect(a.hipFlex.R).toBeCloseTo(0, 5);
    expect(a.trunkLean).toBeCloseTo(0, 5);
    expect(a.shinLean.L).toBeCloseTo(0, 5);
  });

  it("thigh horizontal, shin vertical, trunk 45° forward", () => {
    // hip at origin, knee 0.45 m forward (toward camera = +z), ankle straight below the knee
    const a = squatAngles(pose({ shoulder: [-0.354, 0.354], hip: [0, 0], knee: [0, 0.45], ankle: [0.45, 0.45] }));
    expect(a.kneeFlex.L).toBeCloseTo(90, 5);
    expect(a.hipFlex.L).toBeCloseTo(135, 1);   // trunk 45° forward + thigh 90° forward
    expect(a.trunkLean).toBeCloseTo(45, 1);
    expect(a.shinLean.R).toBeCloseTo(0, 5);
    expect(a.trunkMinusShin).toBeCloseTo(45, 1);
  });

  it("lean is measured the same whichever way the y axis points", () => {
    expect(fromVertical({ x: 0, y: -1, z: 1 })).toBeCloseTo(45, 5);
    expect(fromVertical({ x: 0, y: 1, z: 1 })).toBeCloseTo(45, 5);
  });
});
