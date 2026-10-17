// End-to-end test of the built app: sign in → squat workout → label → save.
// The pose model is replaced by scripted squats and Supabase by an in-memory fake, so this runs offline.
// Usage: npm run build && npm run test:e2e   (CHROMIUM_PATH to use a preinstalled Chromium)
import { chromium } from "playwright";
import { build } from "esbuild";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SUPABASE = /^https:\/\/vxfglaogomdfyuscflnd\.supabase\.co\//;
const USER = { id: "11111111-1111-1111-1111-111111111111", email: "test@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { full_name: "Test User" }, created_at: "2026-10-13T00:00:00Z" };

// ---- scripted pose model, bundled from the same generator the unit tests use
const synth = await build({ entryPoints: [path.join(ROOT, "src/exercises/squat/synthetic.ts")], bundle: true, write: false, format: "iife", globalName: "Synth" });
const fakeModel = `${synth.outputFiles[0].text}
(() => {
  const script = [
    { kind: "hold", dur: 3 },
    { kind: "rep", dur: 4, down: 2.5 }, { kind: "hold", dur: 1 },
    { kind: "rep", dur: 4, down: 2.5, err: { caving: true } }, { kind: "hold", dur: 1.5 }
  ];
  const noise = Synth.seededNoise();
  let t0 = null, last = -1;
  window.__FAKE_LANDMARKER__ = {
    detectForVideo(v, ts) {
      if (t0 === null || ts < last) t0 = ts;   // timestamps restart for each imported video
      // The scripted squats are drawn for a 4:3 frame; keep their shape in whatever frame the camera gives.
      const sx = (4 / 3) / ((v && v.videoWidth / v.videoHeight) || 4 / 3);
      last = ts;
      const pose = Synth.scriptedPose(script, (ts - t0) / 1000, noise);
      window.__SCRIPT_DONE__ = !pose;
      const p = pose || Synth.scriptedPose(script.slice(0, 1), 0, noise);
      return { landmarks: [p.map(q => ({ x: 0.5 + (q.x - 0.5) * sx, y: q.y, z: q.z, visibility: q.v }))], worldLandmarks: [p.map(q => ({ x: q.x - 0.5, y: q.y - 0.5, z: 0 }))] };
    },
    close() {}
  };
})();`;

// ---- static server for dist/ under /ai-form-coach/
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/ai-form-coach\/?/, "");
  if (!rel) rel = "index.html";
  const f = path.join(DIST, rel);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(f)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/ai-form-coach/`;

// ---- fake Supabase
const db = { sessions: [], reps: [], rep_keypoints: [], rep_labels: [] };
const profile = { id: USER.id, display_name: "Test User", avatar_url: null, role: "athlete", height_cm: null, consent_training: false, body: null };
let nextId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, email: USER.email })}.sig`;
const authSession = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r1", user: USER };

async function fakeSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname, method = req.method();
  const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
  const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  if (method === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  if (p === "/auth/v1/token") return json(200, authSession);
  if (p === "/auth/v1/user") return json(200, USER);
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204 });
  const table = p.replace("/rest/v1/", "");
  const eqId = url.searchParams.get("id")?.replace(/^eq\./, "");
  if (table === "profiles") {
    if (method === "PATCH") Object.assign(profile, JSON.parse(req.postData()));
    return json(200, single ? profile : [profile]);
  }
  if (table === "rule_sets") return json(200, single ? { id: "rule-set-v2" } : [{ id: "rule-set-v2" }]);
  if (method === "POST" && table in db) {
    const rows = [].concat(JSON.parse(req.postData()));
    const saved = rows.map(r => ({ id: r.id ?? uuid(), ...r }));
    db[table].push(...saved);
    return json(201, single ? saved[0] : saved);
  }
  if (method === "GET" && table === "sessions") {
    const withReps = s => ({ ...s, reps: db.reps.filter(r => r.session_id === s.id).map(r => ({ ...r, rep_labels: db.rep_labels.filter(l => l.rep_id === r.id) })) });
    if (eqId) return json(200, withReps(db.sessions.find(s => s.id === eqId)));
    return json(200, db.sessions.map(withReps));
  }
  if (method === "DELETE") return route.fulfill({ status: 204 });
  return json(200, single ? {} : []);
}

// ---- run
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
});
const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));
await page.route(SUPABASE, fakeSupabase);
await page.addInitScript(fakeModel);

try {
  await page.goto(base);
  await page.waitForURL(/#\/login$/);
  check(true, "signed-out user lands on sign-in");
  check(await page.getByRole("button", { name: "Continue with Google" }).isVisible(), "Google sign-in button shown");
  await page.screenshot({ path: path.join(ROOT, "test-results", "login.png") });

  await page.fill('input[name="email"]', USER.email);
  await page.fill('input[name="password"]', "correct-horse");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".start-card");
  check(true, "email sign-in reaches home");

  await page.click(".start-card");
  await page.click("text=Start camera");
  await page.waitForTimeout(5200);
  await page.screenshot({ path: path.join(ROOT, "test-results", "workout.png") });
  await page.waitForFunction(() => window.__SCRIPT_DONE__, null, { timeout: 60000 });
  const shown = await page.textContent(".reps b");
  check(shown === "2", `rep counter shows 2 (got ${shown})`);

  await page.click("text=Finish & review");
  await page.waitForURL(/#\/summary$/);
  await page.waitForSelector(".rep-head");
  const heads = await page.locator(".rep-head").allTextContents();
  check(heads.length === 2 && /Clean/.test(heads[0]) && /Knees caving/.test(heads[1]), `review lists both reps: ${JSON.stringify(heads)}`);
  await page.locator(".rep-card").nth(0).getByRole("button", { name: "Correct" }).click();
  await page.locator(".rep-card").nth(1).getByRole("button", { name: "Knees caving" }).click();
  await page.click("text=Save to my account");
  await page.waitForURL(/#\/session\//);
  check(true, "save navigates to the session page");

  const s = db.sessions[0];
  check(db.sessions.length === 1 && s.user_id === USER.id && s.exercise_id === "squat" && s.rule_set_id === "rule-set-v2", "session row saved with user, exercise, rule set");
  check(s.frame_width > 0 && s.frame_height > 0 && s.thresholds?.depthGap === 0.15 && s.calibration?.history?.length === 1, "session has frame size, thresholds, calibration");
  check(db.reps.length === 2 && db.reps[0].issues.length === 0 && db.reps[1].issues[0] === "knees_caving", "two reps saved with their issues");
  const ang = db.reps[0].metrics.anglesAtBottom;
  check(ang && Number.isFinite(ang.kneeFlex.L) && Number.isFinite(ang.trunkLean), `bottom-of-rep 3D angles saved: ${JSON.stringify(ang)}`);
  check(db.rep_keypoints.length === 2 && db.rep_keypoints[0].frames.length > 20 && db.rep_keypoints[0].frames[0].lm.length === 33 && db.rep_keypoints[0].frames[0].world?.length === 33, "keypoints (2D + world) saved per rep");
  check(db.rep_labels.length === 2 && db.rep_labels[0].correct === true && db.rep_labels[1].error_codes[0] === "knees_caving" && db.rep_labels.every(l => l.labeler_role === "athlete"), "user labels saved");
  await page.waitForSelector("text=Labeled");
  const sessionHeads = await page.locator(".rep-head").allTextContents();
  check(sessionHeads.length === 2, "session page shows the saved reps");
  await page.screenshot({ path: path.join(ROOT, "test-results", "session.png"), fullPage: true }).catch(() => {});

  // Import a video: same scripted poses, played back by video time
  const videoFile = path.join(ROOT, "test-results", "squat-test.webm");
  if (!fs.existsSync(videoFile)) execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "14", "-c:v", "libvpx", "-b:v", "200k", "-g", "15", videoFile]);
  await page.goto(base + "#/");
  await page.click("text=Import a video");
  await page.setInputFiles('input[type="file"]', videoFile);
  await page.locator("label", { hasText: "Where the video comes from" }).locator("select").selectOption("coach");
  await page.fill('input[placeholder^="e.g. Coach A, permission"]', "Coach A, permission by email");
  await page.locator(".check").last().locator("input").check();
  await page.screenshot({ path: path.join(ROOT, "test-results", "import-form.png"), fullPage: true });
  await page.click("text=Analyze video");
  await page.waitForSelector("text=Label the reps", { timeout: 120000 });
  await page.screenshot({ path: path.join(ROOT, "test-results", "import-review.png"), fullPage: true });
  const importHeads = await page.locator(".rep-head").allTextContents();
  check(importHeads.length === 2 && /Clean/.test(importHeads[0]) && /Knees caving/.test(importHeads[1]), `import finds both reps: ${JSON.stringify(importHeads)}`);
  await page.locator(".rep-card").nth(1).getByRole("button", { name: "Knees caving" }).click();
  await page.locator(".rep-card").nth(1).locator("textarea").fill("left knee drifts in at the bottom");
  await page.click("text=Save to my account");
  await page.waitForURL(/#\/session\//);
  const imp = db.sessions[1];
  check(imp?.source === "video_import" && imp.source_meta?.consentConfirmed === true && imp.source_meta?.origin === "coach" && imp.camera_view === "front", "imported session saved with source, origin and consent");
  const impReps = db.reps.filter(r => r.session_id === imp?.id);
  const impLabels = db.rep_labels.filter(l => impReps.some(r => r.id === l.rep_id));
  check(impReps.length === 2 && impLabels.length === 1 && impLabels[0].note === "left knee drifts in at the bottom", "imported reps and the labeled rep's note saved");

  // Real pose model, served by the app itself: no requests to jsDelivr or Google.
  const real = await page.context().newPage();
  const outside = [];
  real.on("request", r => { const u = new URL(r.url()); if (!["localhost", "vxfglaogomdfyuscflnd.supabase.co", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.hostname)) outside.push(u.hostname); });
  real.on("pageerror", e => errors.push(String(e)));
  await real.route(SUPABASE, fakeSupabase);
  await real.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));
  await real.goto(base + "#/workout/squat");
  await real.click("text=Start camera");
  await real.waitForFunction(() => /frames per second/.test(document.querySelector(".fps:last-of-type")?.textContent || "") || document.querySelector(".error")?.textContent, null, { timeout: 90000 });
  const err = await real.textContent(".intro .error");
  check(!err, `real model loads from the app's own files${err ? ": " + err : ""}`);
  check(outside.length === 0, `no requests to outside hosts${outside.length ? ": " + [...new Set(outside)].join(", ") : ""}`);
  const shortVideo = path.join(ROOT, "test-results", "empty-2s.webm");
  if (!fs.existsSync(shortVideo)) execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "2", "-c:v", "libvpx", "-b:v", "200k", "-g", "15", shortVideo]);
  await real.goto(base + "#/import/squat");
  await real.setInputFiles('input[type="file"]', shortVideo);
  await real.locator(".check").last().locator("input").check();
  await real.click("text=Analyze video");
  await real.waitForSelector("text=Label the reps", { timeout: 240000 });
  check(await real.locator("text=0 reps found").count() === 1, "real model analyzes a video file end to end (no person: 0 reps)");
  await real.close();
} catch (e) {
  check(false, `flow crashed: ${e.message}`);
  await page.screenshot({ path: path.join(ROOT, "test-results", "failure.png"), fullPage: true }).catch(() => {});
}

// ---- a catalog exercise (barbell curl), live: scripted stick-figure reps from the unit-test fixtures
try {
  const gen = await build({ stdin: { contents: `export { planarPose, blend } from "./src/exercises/generic/planar"; export { FIXTURES } from "./src/exercises/generic/fixtures";`, resolveDir: ROOT, loader: "ts" }, bundle: true, write: false, format: "iife", globalName: "Gen" });
  const curlModel = `${gen.outputFiles[0].text}
  (() => {
    const fx = Gen.FIXTURES.barbell_curl, swing = fx.faults.find(f => f.code === "torso_swing").peak;
    const keys = [[fx.rest, 1.5], [fx.peak, 1.5], [fx.rest, 1.5], [fx.rest, 1], [swing, 1.5], [fx.rest, 1.5], [fx.rest, 1]];
    let t0 = null;
    window.__FAKE_LANDMARKER__ = { detectForVideo(v, ts) {
      if (t0 === null) t0 = ts;
      const aspect = v.videoWidth / v.videoHeight;
      let t = (ts - t0) / 1000, prev = keys[0][0], spec = fx.rest;
      window.__SCRIPT_DONE__ = true;
      for (const [k, d] of keys) { if (t < d) { spec = Gen.blend(prev, k, t / d); window.__SCRIPT_DONE__ = false; break; } t -= d; prev = k; }
      const p = Gen.planarPose(spec);
      // The fixtures assume square pixels; scale x to the camera's frame shape to keep the angles.
      return { landmarks: [p.map(q => ({ x: 0.5 + (q.x - 0.5) / aspect, y: q.y, z: 0, visibility: q.v }))], worldLandmarks: [] };
    }, close() {} };
  })();`;
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", e => errors.push(String(e)));
  await p2.route(SUPABASE, fakeSupabase);
  await p2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));
  await p2.addInitScript(curlModel);
  await p2.goto(base);
  await p2.fill('input[name="email"]', USER.email);
  await p2.fill('input[name="password"]', "correct-horse");
  await p2.click('button[type="submit"]');
  await p2.waitForSelector(".exercise-list");
  check(await p2.locator(".exercise-row").count() === 10, "home lists the 10 catalog exercises");
  await p2.locator(".exercise-row", { hasText: "Barbell curl" }).getByRole("link", { name: "Start" }).click();
  await p2.click("text=Start camera");
  await p2.waitForFunction(() => window.__SCRIPT_DONE__, null, { timeout: 60000 });
  check(await p2.textContent(".reps b") === "2", "curl: 2 reps counted");
  await p2.click("text=Finish & review");
  await p2.waitForURL(/#\/summary$/);
  await p2.waitForSelector(".rep-head");
  const heads = await p2.locator(".rep-head").allTextContents();
  check(heads.length === 2 && /Clean/.test(heads[0]) && /Swinging the torso/.test(heads[1]), `curl review: ${JSON.stringify(heads)}`);
  await p2.locator(".rep-card").nth(1).getByRole("button", { name: "Swinging the torso" }).click();
  await p2.click("text=Save to my account");
  await p2.waitForURL(/#\/session\//);
  const cs = db.sessions.find(x => x.exercise_id === "barbell_curl");
  check(cs && cs.camera_view === "side" && cs.rule_set_id === null && cs.thresholds?.torso_swing?.max === 8, "curl session saved with exercise, view and limits");
  const cr = db.reps.filter(r => r.session_id === cs?.id);
  check(cr.length === 2 && cr[1].issues[0] === "torso_swing" && typeof cr[1].metrics.torso_swing === "number", "curl reps saved with issues and measured values");
  await p2.waitForSelector("text=Labeled");
  await p2.screenshot({ path: path.join(ROOT, "test-results", "curl-session.png"), fullPage: true });
  await ctx2.close();
} catch (e) {
  check(false, `catalog flow crashed: ${e.message}`);
}

// ---- back squat filmed from the FRONT: 3D skeleton (world landmarks) and the ghost
const gen3d = await build({ stdin: { contents: `export { shoot } from "./src/exercises/generic/fixtures3d"; export { blend } from "./src/exercises/generic/planar"; export { FIXTURES } from "./src/exercises/generic/fixtures";`, resolveDir: ROOT, loader: "ts" }, bundle: true, write: false, format: "iife", globalName: "G3" });
try {
  const squatFront = `${gen3d.outputFiles[0].text}
  (() => {
    const fx = G3.FIXTURES.back_squat, shallow = fx.faults.find(f => f.code === "not_deep_enough").peak;
    const stand = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };
    const keys = [[stand, 1], [fx.rest, 1.5], [fx.peak, 2], [fx.rest, 1.5], [fx.rest, 1], [shallow, 2], [fx.rest, 1.5], [fx.rest, 1]];
    let t0 = null;
    window.__FAKE_LANDMARKER__ = { detectForVideo(v, ts) {
      if (t0 === null) t0 = ts;
      const aspect = v.videoWidth / v.videoHeight;
      let t = (ts - t0) / 1000, prev = keys[0][0], spec = fx.rest;
      window.__SCRIPT_DONE__ = true;
      for (const [k, d] of keys) { if (t < d) { spec = G3.blend(prev, k, t / d); window.__SCRIPT_DONE__ = false; break; } t -= d; prev = k; }
      const { pose, world } = G3.shoot("back_squat", spec, 0);
      return { landmarks: [pose.map(q => ({ x: 0.5 + (q.x - 0.5) / aspect, y: q.y, z: 0, visibility: q.v }))], worldLandmarks: [world] };
    }, close() {} };
  })();`;
  const ctx3 = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p3 = await ctx3.newPage();
  p3.on("pageerror", e => errors.push(String(e)));
  p3.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await p3.route(SUPABASE, fakeSupabase);
  await p3.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));
  await p3.addInitScript(squatFront);
  await p3.goto(base);
  await p3.fill('input[name="email"]', USER.email);
  await p3.fill('input[name="password"]', "correct-horse");
  await p3.click('button[type="submit"]');
  await p3.waitForSelector(".exercise-list");
  await p3.locator(".exercise-row", { hasText: "Back squat" }).getByRole("link", { name: "Start" }).click();
  await p3.getByLabel("View").selectOption("front");
  await p3.click("text=Start camera");
  await p3.waitForTimeout(3600);
  await p3.screenshot({ path: path.join(ROOT, "test-results", "back-squat-front-ghost.png") });
  await p3.waitForFunction(() => window.__SCRIPT_DONE__, null, { timeout: 60000 });
  check(await p3.textContent(".reps b") === "2", "back squat from the front: 2 reps counted (3D)");
  await p3.click("text=Finish & review");
  await p3.waitForURL(/#\/summary$/);
  await p3.waitForSelector(".rep-head");
  const sq = await p3.locator(".rep-head").allTextContents();
  check(sq.length === 2 && /Clean/.test(sq[0]) && /Not deep enough/.test(sq[1]), `back squat from the front: depth judged in 3D: ${JSON.stringify(sq)}`);
  await ctx3.close();
} catch (e) {
  check(false, `front-view flow crashed: ${e.message}`);
}

// ---- body measurements from two photos (pose model faked; a tiny PNG stands in for each photo)
try {
  const photoModel = `${gen3d.outputFiles[0].text}
  (() => {
    let n = 0;
    window.__FAKE_LANDMARKER__ = { detect() {
      const stand = { shin: 0, thigh: 0, trunk: 0, upperArm: 8, forearm: 0 };
      return { landmarks: [G3.shoot("barbell_curl", stand, n++ === 0 ? 0 : 90).pose.map(q => ({ x: q.x, y: q.y, z: 0, visibility: q.v }))] };
    }, close() {} };
  })();`;
  const ctx4 = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p4 = await ctx4.newPage();
  p4.on("pageerror", e => errors.push(String(e)));
  await p4.route(SUPABASE, fakeSupabase);
  await p4.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));
  await p4.addInitScript(photoModel);
  await p4.goto(base);
  await p4.fill('input[name="email"]', USER.email);
  await p4.fill('input[name="password"]', "correct-horse");
  await p4.click('button[type="submit"]');
  await p4.waitForSelector(".exercise-list");
  await p4.goto(base + "#/profile");
  await p4.getByLabel("Height (cm, optional)").fill("180");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await p4.getByLabel("front photo").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
  await p4.waitForSelector("text=Looks good.");
  await p4.getByLabel("side photo").setInputFiles({ name: "side.png", mimeType: "image/png", buffer: png });
  await p4.waitForFunction(() => document.querySelectorAll(".scan-photo .ok").length === 2);
  await p4.click("text=Save measurements");
  await p4.waitForSelector("text=Workouts now use your measurements");
  const b = profile.body;
  check(b && b.heightCm === 180 && b.dims.thigh > 30 && b.dims.thigh < 60 && b.photos.length === 2 && profile.height_cm === 180,
    `body measurements saved (numbers only): thigh ${b?.dims.thigh} cm, foot ${b?.dims.foot} cm, photos ${JSON.stringify(b?.photos)}`);
  check(!JSON.stringify(profile).includes("data:image"), "no photo data sent to the database");
  await p4.screenshot({ path: path.join(ROOT, "test-results", "body-scan.png"), fullPage: true });
  await ctx4.close();
} catch (e) {
  check(false, `body scan flow crashed: ${e.message}`);
}

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
