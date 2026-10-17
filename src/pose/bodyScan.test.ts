import { describe, expect, it } from "vitest";
import { combine, measurePhoto } from "./bodyScan";
import { shoot } from "../exercises/generic/fixtures3d";
import { AVERAGE_DIMS as D } from "../exercises/generic/reference";

const STAND = { shin: 0, thigh: 0, trunk: 0, upperArm: 8, forearm: 0 };

describe("body measurements from photos", () => {
  const front = { pose: shoot("barbell_curl", STAND, 0).pose, width: 1000, height: 1000, view: "front" as const };
  const side = { pose: shoot("barbell_curl", STAND, 90).pose, width: 1000, height: 1000, view: "side" as const };

  it("keeps the body's proportions and fills in nothing measured", () => {
    const r = [measurePhoto(front, 180), measurePhoto(side, 180)];
    expect(r.flatMap(x => x.problems)).toEqual([]);
    const { dims, estimated } = combine(r, 180);
    expect(estimated).toEqual([]);
    expect(dims.thigh / dims.shin).toBeCloseTo(D.thigh / D.shin, 1);
    expect(dims.shoulderWidth / dims.hipWidth).toBeCloseTo(D.shoulderWidth / D.hipWidth, 1);
    expect(dims.foot / dims.shin).toBeCloseTo(D.foot / D.shin, 1);
  });

  it("estimates the feet from typical proportions without a side photo", () => {
    const { estimated } = combine([measurePhoto(front, 180)], 180);
    expect(estimated).toEqual(["heel", "foot"]);
  });

  it("rejects a side-on photo used as the front one, and a bent-knee photo", () => {
    expect(measurePhoto({ ...side, view: "front" }, 180).problems.join(" ")).toMatch(/face the camera/);
    const squat = { pose: shoot("back_squat", { shin: 25, thigh: -60, trunk: 30, upperArm: 0, forearm: 0 }, 0).pose, width: 1000, height: 1000, view: "front" as const };
    expect(measurePhoto(squat, 180).problems.join(" ")).toMatch(/straight/);
  });
});
