import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Served by this app (scripts/fetch-assets.mjs copies the WASM from the pinned npm package and downloads
// the models with pinned SHA-256 hashes), so the phone never contacts jsDelivr or Google at runtime.
const ASSETS = `${import.meta.env.BASE_URL}mediapipe`;
export const MODELS = {
  lite: `${ASSETS}/pose_landmarker_lite.task`,
  full: `${ASSETS}/pose_landmarker_full.task`
};
export type ModelName = keyof typeof MODELS;
/**
 * "live" for the camera, "import" for video files: separate instances because VIDEO mode needs increasing
 * timestamps per instance. "image" for still photos (body measurements).
 */
export type Purpose = "live" | "import" | "image";

const cache = new Map<Purpose, { model: ModelName; lm: PoseLandmarker }>();

export async function getLandmarker(model: ModelName, purpose: Purpose = "live"): Promise<PoseLandmarker> {
  // Test seam: e2e tests replace the model with scripted poses.
  const fake = (window as unknown as { __FAKE_LANDMARKER__?: PoseLandmarker }).__FAKE_LANDMARKER__;
  if (fake) return fake;
  const hit = cache.get(purpose);
  if (hit?.model === model) return hit.lm;
  hit?.lm.close();
  cache.delete(purpose);
  const fileset = await FilesetResolver.forVisionTasks(`${ASSETS}/wasm`);
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODELS[model], delegate },
    runningMode: purpose === "image" ? "IMAGE" as const : "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  let lm: PoseLandmarker;
  try { lm = await PoseLandmarker.createFromOptions(fileset, opts("GPU")); }
  catch { lm = await PoseLandmarker.createFromOptions(fileset, opts("CPU")); }
  cache.set(purpose, { model, lm });
  return lm;
}

/** Throw away the import instance so the next video starts with fresh timestamps. */
export function resetImportLandmarker() {
  cache.get("import")?.lm.close();
  cache.delete("import");
}

export const poseModelId = (model: ModelName) => `mediapipe-pose-${model}@0.10.14`;
