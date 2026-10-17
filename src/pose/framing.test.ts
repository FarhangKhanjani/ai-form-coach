import { describe, expect, it } from "vitest";
import { framingHint } from "./framing";
import type { Pose } from "./types";

/** A standing person, normalized: head at `top`, feet at `bottom`, centred at `cx`. */
function person(top: number, bottom: number, cx = 0.5): Pose {
  const H = bottom - top, y = (f: number) => top + f * H, w = 0.12 * H;
  const p = Array.from({ length: 33 }, () => ({ x: cx, y: y(0.05), z: 0, v: 0.95 }));
  const set = (i: number, dx: number, fy: number) => { p[i] = { x: cx + dx * w, y: y(fy), z: 0, v: 0.95 }; };
  set(0, 0, 0.07); set(11, 1, 0.18); set(12, -1, 0.18); set(13, 1.2, 0.33); set(14, -1.2, 0.33); set(15, 1.2, 0.47); set(16, -1.2, 0.47);
  set(23, 0.6, 0.52); set(24, -0.6, 0.52); set(25, 0.6, 0.74); set(26, -0.6, 0.74); set(27, 0.6, 0.95); set(28, -0.6, 0.95);
  set(29, 0.6, 0.97); set(30, -0.6, 0.97); set(31, 0.8, 0.99); set(32, -0.8, 0.99);
  return p;
}

describe("framing hints", () => {
  it("is quiet for a well-framed person", () => expect(framingHint(person(0.1, 0.9))).toBeNull());
  it("feet out of the picture", () => expect(framingHint(person(0.2, 1.1))).toMatch(/feet/));
  it("head out of the picture", () => expect(framingHint(person(-0.05, 0.85))).toMatch(/head/));
  it("too small", () => expect(framingHint(person(0.4, 0.75))).toMatch(/closer/));
  it("near the edge", () => expect(framingHint(person(0.1, 0.9, 0.85))).toMatch(/middle/));
});
