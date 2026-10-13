// Browser tests for squat-coach.html.
//   node tests/run-tests.mjs logic   scripted squats through a fake pose model; checks reps and flags
//   node tests/run-tests.mjs model   real MediaPipe model on Chromium's fake camera; checks it loads cleanly
// Needs: playwright, and for "model" the MediaPipe files in tests/vendor (see README).
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "tests", "vendor");
const mode = process.argv[2] || "logic";

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = f.endsWith(".html") ? "text/html" : f.endsWith(".mjs") || f.endsWith(".js") ? "text/javascript" : "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
});
const page = await browser.newPage({ acceptDownloads: true });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };

if (mode === "logic") {
  // A session: stand still, then one rep per error type plus clean reps.
  const script = [
    { kind: "hold", dur: 3 },
    { kind: "rep", dur: 4, down: 2.5, label: "good" },
    { kind: "hold", dur: 1 },
    { kind: "rep", dur: 1.6, down: 0.7, label: "fast" },
    { kind: "hold", dur: 1 },
    { kind: "rep", dur: 4, down: 2.5, err: { caving: true }, label: "knees" },
    { kind: "hold", dur: 1 },
    { kind: "rep", dur: 4, down: 2.5, err: { shallow: true }, label: "shallow" },
    { kind: "hold", dur: 1 },
    { kind: "rep", dur: 4, down: 2.5, err: { heels: true }, label: "heels" },
    { kind: "hold", dur: 1 },
    { kind: "rep", dur: 4, down: 2.5, err: { shift: true }, label: "shift" },
    { kind: "hold", dur: 1 },
    { kind: "rep", dur: 4, down: 2.5, label: "good" },
    { kind: "hold", dur: 1.5 }
  ];
  const expected = script.filter(s => s.kind === "rep").map(s => s.label);

  await page.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/vision_bundle\.mjs/,
    r => r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(path.join(ROOT, "tests", "fake-pose.mjs")) }));
  await page.addInitScript(s => { window.__POSE_SCRIPT__ = s; localStorage.clear(); }, script);
  await page.goto(`${base}/squat-coach.html`);
  await page.click("#startBtn");
  await page.waitForFunction(() => document.getElementById("calib").hidden, null, { timeout: 8000 })
    .then(() => check(true, "calibration finishes"), () => check(false, "calibration finishes"));
  await page.waitForFunction(() => window.__POSE_DONE__, null, { timeout: 60000 });

  const dl = page.waitForEvent("download");
  await page.click("#exportBtn");
  const data = JSON.parse(fs.readFileSync(await (await dl).path(), "utf8"));
  const got = data.reps;
  check(got.length === expected.length, `rep count ${got.length} (expected ${expected.length})`);
  got.forEach((r, i) => {
    const want = expected[i];
    const ok = want === "good" ? r.issues.length === 0 : r.issues[0] === want;
    check(ok, `rep ${r.n} [${want}] -> issues=${JSON.stringify(r.issues)} depth=${r.depthPct}% knees=${r.kneeRatio} heel=${r.heelLiftPct}% shift=${r.shiftPct}% down=${r.downTime}s frames=${r.frames.length}`);
  });
  check(data.version === 1 && data.calibration && data.calibration.standingPose.length === 33, "export format v1 with calibration");
} else {
  // Real model, fake camera (test pattern, no person): the page must load the model and run without errors.
  await page.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.14\/(.*)/, (r) => {
    const rel = r.request().url().match(/tasks-vision@0\.10\.14\/(.*)/)[1];
    const f = path.join(VENDOR, "package", rel);
    const type = f.endsWith(".mjs") || f.endsWith(".js") ? "text/javascript" : f.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
    return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) }) : r.fulfill({ status: 404 });
  });
  await page.route(/storage\.googleapis\.com\/mediapipe-models\/.*\/(pose_landmarker_\w+)\.task/, (r) => {
    const name = r.request().url().match(/(pose_landmarker_\w+)\.task/)[1];
    const f = path.join(VENDOR, name + ".task");
    return fs.existsSync(f) ? r.fulfill({ status: 200, body: fs.readFileSync(f) }) : r.continue();
  });
  await page.goto(`${base}/squat-coach.html`);
  await page.click("#startBtn");
  await page.waitForFunction(() => document.getElementById("intro").hidden || document.getElementById("error").textContent, null, { timeout: 60000 });
  const err = await page.textContent("#error");
  check(!err, `model loads and camera starts ${err ? "(" + err + ")" : ""}`);
  await page.waitForTimeout(5000);
  const fps = await page.textContent("#fps");
  check(/frames per second/.test(fps), `frame loop runs: "${fps}"`);
  const status = await page.textContent("#status");
  check(status === "No one in view", `status with empty scene: "${status}"`);
}

const real = errors.filter(e => !/favicon/.test(e));
check(real.length === 0, `no console errors${real.length ? ": " + real.join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
