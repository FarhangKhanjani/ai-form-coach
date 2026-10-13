import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getLandmarker, poseModelId, type ModelName } from "../pose/landmarker";
import type { Pose, WorldPose } from "../pose/types";
import { SquatCoach } from "../exercises/squat/coach";
import { DEFAULTS, ERROR_TEXT, type SquatThresholds } from "../exercises/squat/config";
import { drawGhost, drawUser, tempoPhase } from "../exercises/squat/draw";
import type { Rep } from "../exercises/squat/reps";
import type { WorkoutRecord } from "../data/api";
import { h, mount, topbar } from "./dom";

const TH_KEY = "formcoach.squat.thresholds.v2";
const PREF_KEY = "formcoach.prefs.v1";

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); if (raw) return { ...fallback, ...JSON.parse(raw) }; } catch { /* storage unavailable */ }
  return fallback;
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }

/** The finished workout waiting on the review screen. */
export let pendingWorkout: WorkoutRecord | null = null;
export function clearPendingWorkout() { pendingWorkout = null; }

function speak(on: boolean, text: string) {
  if (!on || !("speechSynthesis" in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* unavailable */ }
}

const SLIDERS: { key: keyof SquatThresholds; label: string; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { key: "depthGap", label: "Depth target: hip-to-knee gap left", min: 0, max: 0.4, step: 0.01, fmt: v => Math.round(v * 100) + "%" },
  { key: "kneeMin", label: "Knee width at bottom, min (× ankle width)", min: 0.6, max: 1.2, step: 0.01, fmt: v => v.toFixed(2) + "×" },
  { key: "kneeInMax", label: "Knee moving inward, max (% of hip width)", min: 0.05, max: 0.4, step: 0.01, fmt: v => Math.round(v * 100) + "%" },
  { key: "heelMax", label: "Heel lift, max (% of leg length)", min: 0.01, max: 0.1, step: 0.005, fmt: v => (v * 100).toFixed(1) + "%" },
  { key: "shiftMax", label: "Side shift, max (% of hip width)", min: 0.05, max: 0.4, step: 0.01, fmt: v => Math.round(v * 100) + "%" },
  { key: "hipTiltMax", label: "Hip tilt, max (% of hip width)", min: 0.03, max: 0.3, step: 0.01, fmt: v => Math.round(v * 100) + "%" },
  { key: "minDown", label: "Time going down, min", min: 0.5, max: 3, step: 0.1, fmt: v => v.toFixed(1) + " s" }
];

export function workoutPage(): () => void {
  const th: SquatThresholds = load(TH_KEY, { ...DEFAULTS });
  const prefs = load(PREF_KEY, { model: "lite" as ModelName, facing: "user", ghost: "follow", voice: true });

  const video = h("video", { playsinline: true, muted: true });
  const canvas = h("canvas");
  const ctx = canvas.getContext("2d")!;
  const repCount = h("b", {}, "0");
  const status = h("div", { class: "status" }, "Camera off");
  const meterFill = h("i");
  const meter = h("div", { class: "meter", "aria-hidden": "true" }, meterFill);
  const banner = h("div", { class: "banner", hidden: true });
  const cue = h("div", { class: "cue", hidden: true, "aria-live": "assertive" });
  const calibBar = h("i");
  const calibMsg = h("p", {}, "Feet about shoulder-width apart, facing the camera, arms relaxed, whole body in view.");
  const calib = h("div", { class: "overlay", hidden: true },
    h("div", { class: "calib" }, h("h2", {}, "Stand tall and hold still"), calibMsg, h("div", { class: "bar" }, calibBar)));
  const error = h("p", { class: "error", role: "alert" });
  const modelSel = h("select", {}, h("option", { value: "lite" }, "Lite (faster)"), h("option", { value: "full" }, "Full (more accurate)"));
  const camSel = h("select", {}, h("option", { value: "user" }, "Front camera"), h("option", { value: "environment" }, "Back camera"));
  modelSel.value = prefs.model; camSel.value = prefs.facing;
  const startBtn = h("button", { class: "btn" }, "Start camera");
  const intro = h("div", { class: "overlay" },
    h("div", { class: "intro" },
      h("h2", {}, "Squat"),
      h("ul", {},
        h("li", {}, "Phone 2–3 m away at about hip height, upright, facing you straight on."),
        h("li", {}, "Whole body in the frame, including your feet."),
        h("li", {}, "Fitted clothes, good light."),
        h("li", {}, "Video stays on this phone. Only keypoints are saved, when you choose to.")),
      h("div", { class: "row" },
        h("label", { class: "field" }, "Model", modelSel),
        h("label", { class: "field" }, "Camera", camSel)),
      startBtn, error));

  const live = h("p", { class: "fps" });
  const fps = h("p", { class: "fps" });
  const finishBtn = h("button", { class: "btn", disabled: true }, "Finish & review");
  const recalBtn = h("button", { class: "btn quiet" }, "Recalibrate");
  const voice = h("input", { type: "checkbox" }); voice.checked = prefs.voice;
  const ghostRadios = (["follow", "lead"] as const).map(v => {
    const r = h("input", { type: "radio", name: "ghost", value: v }); r.checked = prefs.ghost === v;
    r.addEventListener("change", () => { prefs.ghost = v; save(PREF_KEY, prefs); tempoStart = performance.now() / 1000; });
    return h("label", {}, r, v === "follow" ? " Ghost follows your depth" : " Ghost leads the tempo");
  });
  voice.addEventListener("change", () => { prefs.voice = voice.checked; save(PREF_KEY, prefs); });

  const sliderEls = SLIDERS.map(s => {
    const out = h("output");
    const input = h("input", { type: "range", min: s.min, max: s.max, step: s.step });
    const sync = () => { input.value = String(th[s.key]); out.textContent = s.fmt(th[s.key]); };
    input.addEventListener("input", () => { th[s.key] = Number(input.value); out.textContent = s.fmt(th[s.key]); save(TH_KEY, th); });
    sync();
    return { el: h("div", { class: "slider" }, h("label", {}, s.label, out), input), sync };
  });

  mount(
    topbar("Squat", h("a", { href: "#/", class: "btn quiet small" }, "Exit")),
    h("main", { class: "workout" },
      h("div", { class: "stage" }, video, canvas,
        h("div", { class: "reps", "aria-live": "polite" }, repCount, h("span", {}, "reps")),
        status, meter, h("div", { class: "meter-label", "aria-hidden": "true" }, "Depth"), banner, cue, intro, calib),
      h("section", { class: "panel" },
        h("div", { class: "actions" }, finishBtn, recalBtn),
        live, fps,
        h("div", { class: "choice" }, ...ghostRadios, h("label", {}, voice, " Speak cues")),
        h("ul", { class: "legend" },
          h("li", {}, h("span", { class: "sw ghost" }), "Ghost: target movement"),
          h("li", {}, h("span", { class: "sw you" }), "You"),
          h("li", {}, h("span", { class: "sw bad" }), "Joint breaking a rule"),
          h("li", {}, h("span", { class: "sw dash" }), "Depth target for your hips")),
        h("details", { class: "rules" },
          h("summary", {}, "Rules (placeholder values)"),
          h("p", { class: "note" }, "Starting values for testing, from docs/exercises/squat.md. Your coach sets the final ones."),
          ...sliderEls.map(s => s.el),
          h("button", { class: "btn quiet small", onclick: () => { Object.assign(th, DEFAULTS); save(TH_KEY, th); sliderEls.forEach(s => s.sync()); } }, "Reset to defaults")))));

  // ----- state
  let landmarker: PoseLandmarker | null = null;
  let stream: MediaStream | null = null;
  let running = false, lastVideoTime = -1, raf = 0;
  let coach: SquatCoach | null = null;
  let t0 = 0, tempoStart = 0, frames = 0, fpsT = performance.now(), detectErrors = 0;
  let startedAt = "";
  let wakeLock: { release(): Promise<void> } | null = null;
  const reps: Rep[] = [];
  const calibrations: WorkoutRecord["calibrations"] = [];
  let modelName: ModelName = "lite";

  const setBanner = (t: string | null) => { banner.hidden = !t; if (t) banner.textContent = t; };
  const setCue = (t: string | null, kind = "") => { cue.hidden = !t; if (t) { cue.textContent = t; cue.className = "cue" + (kind ? " " + kind : ""); } };
  const setStatus = (t: string, isLive = false) => { status.textContent = t; status.classList.toggle("live", isLive); };
  const setMeter = (p: number) => { meterFill.style.height = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%"; meter.classList.toggle("reached", p >= 1); };

  async function start() {
    error.textContent = "";
    if (!navigator.mediaDevices?.getUserMedia) { error.textContent = "The camera needs a secure (https) page."; return; }
    prefs.model = modelSel.value as ModelName; prefs.facing = camSel.value; save(PREF_KEY, prefs);
    startBtn.disabled = true; startBtn.textContent = "Loading model…"; setStatus("Loading model");
    try { landmarker = await getLandmarker(prefs.model); modelName = prefs.model; }
    catch { startBtn.disabled = false; startBtn.textContent = "Start camera"; setStatus("Camera off"); error.textContent = "The pose model couldn't load. Check your internet connection and try again."; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: prefs.facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      stopCamera();
      startBtn.disabled = false; startBtn.textContent = "Start camera"; setStatus("Camera off");
      error.textContent = (e as Error)?.name === "NotAllowedError"
        ? "Camera access was blocked. Allow the camera in your browser's site settings, then try again."
        : "No camera could be opened. Check that no other app is using it, then try again.";
      return;
    }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const mirror = prefs.facing === "user";
    video.classList.toggle("mirror", mirror); canvas.classList.toggle("mirror", mirror);
    coach = new SquatCoach(th, video.videoWidth / video.videoHeight);
    startBtn.disabled = false; startBtn.textContent = "Start camera";
    intro.hidden = true; calib.hidden = false;
    t0 = performance.now() / 1000; tempoStart = t0;
    if (!startedAt) startedAt = new Date().toISOString();
    finishBtn.disabled = false;
    running = true; lastVideoTime = -1;
    try { wakeLock = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen"); } catch { /* not supported */ }
    raf = requestAnimationFrame(loop);
  }

  function stopCamera() {
    running = false; cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
    wakeLock?.release().catch(() => {}); wakeLock = null;
  }

  function loop() {
    if (!running || !landmarker || !coach) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      let pose: Pose | null = null, world: WorldPose | null = null;
      try {
        const res = landmarker.detectForVideo(video, now);
        detectErrors = 0;
        if (res.landmarks?.length) {
          pose = res.landmarks[0].map(p => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 }));
          world = res.worldLandmarks?.[0]?.map(p => ({ x: p.x, y: p.y, z: p.z })) ?? null;
        }
      } catch (e) {
        if (++detectErrors === 1) console.error("Pose detection failed:", e);
        if (detectErrors === 30) setBanner("Pose detection keeps failing. Try the other model or Chrome.");
      }
      onFrame(now / 1000 - t0, pose, world);
      frames++;
      if (now - fpsT > 1000) { fps.textContent = `${frames} frames per second · model: ${modelName}`; frames = 0; fpsT = now; }
    }
    raf = requestAnimationFrame(loop);
  }

  function onFrame(t: number, raw: Pose | null, world: WorldPose | null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const st = coach!.step(t, raw, world);
    if (st.phase === "no-person") { setStatus("No one in view"); setBanner(st.banner); setMeter(0); return; }
    if (st.phase === "calibrating") {
      calib.hidden = false; setStatus("Calibrating"); setBanner(null);
      calibBar.style.width = Math.round(st.progress * 100) + "%";
      if (st.message) calibMsg.textContent = st.message;
      drawUser(ctx, st.pose, {});
      return;
    }
    setStatus("Tracking", true);
    setBanner(st.banner);
    if (st.event === "calibrated") {
      calib.hidden = true;
      calibrations.push({ t, cal: st.cal });
      setCue("Ready. Start squatting.", "good"); speak(voice.checked, "Ready");
    }
    if (!st.metrics) { drawUser(ctx, st.pose, {}); setMeter(0); return; }
    const m = st.metrics;
    live.textContent = `Live: depth ${Math.round(m.p * 100)}% · knees ${m.kneeRatio.toFixed(2)}× · knee in ${Math.round(Math.max(m.kneeInside.L, m.kneeInside.R) * 100)}% · ` +
      `heel ${m.heelLift === null ? "–" : (m.heelLift * 100).toFixed(1) + "%"} · shift ${Math.round(m.shift * 100)}% · tilt ${Math.round(m.hipTilt * 100)}%`;
    const gp = prefs.ghost === "lead" ? tempoPhase(performance.now() / 1000 - tempoStart, th.minDown) : m.p;
    drawGhost(ctx, st.pose, st.cal, gp, th.depthGap);
    drawUser(ctx, st.pose, st.flags ?? {});
    setMeter(m.p);
    if (coach!.reps.inRep && st.flags) {
      if (st.flags.knees) setCue("Knees out", "bad");
      else if (st.flags.heels) setCue("Heels down", "bad");
    }
    if (st.event === "start") setCue("Down slowly");
    else if (st.event && typeof st.event === "object") onRep(st.event);
  }

  function onRep(rep: Rep) {
    reps.push(rep);
    if (!rep.trackingOk) { setCue("Lost tracking on that one. Not counted.", "warn"); return; }
    const scored = reps.filter(r => r.trackingOk).length;
    repCount.textContent = String(scored);
    if (!rep.issues.length) { setCue("Good rep", "good"); speak(voice.checked, String(scored)); return; }
    const first = rep.issues[0];
    let text = ERROR_TEXT[first].cue;
    if (first === "shifting_sideways") text = `You drift to your ${rep.metrics.shiftPct > 0 ? "left" : "right"}. Keep your weight centered`;
    setCue(text, first === "knees_caving" || first === "heels_lifting" ? "bad" : "warn");
    speak(voice.checked, `${scored}. ${text}`);
  }

  startBtn.addEventListener("click", start);
  recalBtn.addEventListener("click", () => { if (coach) { coach.recalibrate(); calib.hidden = false; calibBar.style.width = "0%"; setCue(null); } });
  finishBtn.addEventListener("click", () => {
    stopCamera();
    pendingWorkout = {
      exercise: "squat", view: "front",
      startedAt, endedAt: new Date().toISOString(),
      poseModel: poseModelId(modelName),
      frameWidth: canvas.width, frameHeight: canvas.height,
      device: /android/i.test(navigator.userAgent) ? "android" : /iphone|ipad/i.test(navigator.userAgent) ? "ios" : "desktop",
      thresholds: { ...th },
      calibrations, reps
    };
    location.hash = "#/summary";
  });

  return stopCamera;
}
