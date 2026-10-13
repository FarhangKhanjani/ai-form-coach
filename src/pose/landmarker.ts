import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Pinned to the npm package version (project rule: exact versions).
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
export const MODELS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
};
export type ModelName = keyof typeof MODELS;

let cached: { model: ModelName; lm: PoseLandmarker } | null = null;

export async function getLandmarker(model: ModelName): Promise<PoseLandmarker> {
  // Test seam: e2e tests replace the model with scripted poses.
  const fake = (window as unknown as { __FAKE_LANDMARKER__?: PoseLandmarker }).__FAKE_LANDMARKER__;
  if (fake) return fake;
  if (cached?.model === model) return cached.lm;
  cached?.lm.close();
  cached = null;
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODELS[model], delegate },
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  let lm: PoseLandmarker;
  try { lm = await PoseLandmarker.createFromOptions(fileset, opts("GPU")); }
  catch { lm = await PoseLandmarker.createFromOptions(fileset, opts("CPU")); }
  cached = { model, lm };
  return lm;
}

export const poseModelId = (model: ModelName) => `mediapipe-pose-${model}@0.10.14`;
