// End-to-end test of the built app: sign in → squat workout → label → save.
// The pose model is replaced by scripted squats and Supabase by an in-memory fake, so this runs offline.
// Usage: npm run build && npm run test:e2e   (CHROMIUM_PATH to use a preinstalled Chromium)
import { chromium } from "playwright";
import { build } from "esbuild";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  let t0 = null;
  window.__FAKE_LANDMARKER__ = {
    detectForVideo(_v, ts) {
      if (t0 === null) t0 = ts;
      const pose = Synth.scriptedPose(script, (ts - t0) / 1000, noise);
      window.__SCRIPT_DONE__ = !pose;
      const p = pose || Synth.scriptedPose(script.slice(0, 1), 0, noise);
      return { landmarks: [p.map(q => ({ x: q.x, y: q.y, z: q.z, visibility: q.v }))], worldLandmarks: [p.map(q => ({ x: q.x - 0.5, y: q.y - 0.5, z: 0 }))] };
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
  if (table === "profiles") return json(200, single ? { id: USER.id, display_name: "Test User", avatar_url: null, role: "athlete", height_cm: null, consent_training: false } : []);
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
  await real.close();
} catch (e) {
  check(false, `flow crashed: ${e.message}`);
  await page.screenshot({ path: path.join(ROOT, "test-results", "failure.png"), fullPage: true }).catch(() => {});
}

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
