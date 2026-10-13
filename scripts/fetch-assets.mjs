// Puts the MediaPipe runtime and pose models into public/mediapipe/ so the app serves them itself
// (no requests to jsDelivr or Google at runtime). Runs before dev and build.
// WASM comes from the pinned npm package; models are downloaded once and checked against pinned SHA-256 hashes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "mediapipe");
const WASM_SRC = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const MODELS = {
  "pose_landmarker_lite.task": {
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    sha256: "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
  },
  "pose_landmarker_full.task": {
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    sha256: "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"
  }
};

const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");

fs.mkdirSync(path.join(OUT, "wasm"), { recursive: true });
for (const f of fs.readdirSync(WASM_SRC)) fs.copyFileSync(path.join(WASM_SRC, f), path.join(OUT, "wasm", f));

for (const [name, { url, sha256: want }] of Object.entries(MODELS)) {
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest) && sha256(fs.readFileSync(dest)) === want) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== want) throw new Error(`${name}: SHA-256 mismatch. The published model changed; review before updating the pinned hash.`);
  fs.writeFileSync(dest, buf);
  console.log(`fetched ${name} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
console.log("MediaPipe assets ready in public/mediapipe/");
