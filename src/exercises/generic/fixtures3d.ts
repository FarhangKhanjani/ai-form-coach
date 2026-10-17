// Test poses in 3D: a reference pose seen with the person turned `yaw` degrees, as MediaPipe would report it.
import type { Pose, WorldPose } from "../../pose/types";
import { sagittal, type PlanarSpec } from "./planar";
import { AVERAGE_DIMS, REFERENCE, bodyPose, toCamera } from "./reference";

const D = AVERAGE_DIMS;

/** Image landmarks and world landmarks of `spec` seen with the person turned `yaw` degrees (0 = facing the camera, 90 = side-on). */
export function shoot(id: string, spec: PlanarSpec, yaw: number, worldDepth = 0.6): { pose: Pose; world: WorldPose } {
  const y = yaw * Math.PI / 180;
  const fwd = { x: Math.sin(y), y: 0, z: -Math.cos(y) }, left = { x: Math.cos(y), y: 0, z: Math.sin(y) };
  const b = bodyPose(spec, D, REFERENCE[id]);
  const g = sagittal(spec, { torso: D.torso, thigh: D.thigh, shin: D.shin, upperArm: D.upperArm, forearm: D.forearm, neck: D.neck, foot: D.foot, heel: D.heel });
  const [hip] = toCamera([{ u: g.hip[0] - 0.5, v: g.hip[1], w: 0 }], fwd, left);
  const cam = toCamera(b, fwd, left).map(p => ({ x: p.x + hip.x, y: p.y + hip.y, z: p.z + hip.z }));
  return {
    pose: cam.map(p => ({ x: 0.5 + p.x, y: p.y, z: 0, v: 0.9 })),
    world: cam.map(p => ({ x: p.x - hip.x, y: p.y - hip.y, z: (p.z - hip.z) * worldDepth }))
  };
}

