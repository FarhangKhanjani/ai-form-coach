import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getLandmarker, poseModelId, type ModelName } from "../pose/landmarker";
import type { Pose, WorldPose } from "../pose/types";
import { byId } from "../exercises/generic/catalog";
import { GenericCoach, type GenericRep } from "../exercises/generic/engine";
import type { CameraView, CheckDef, ExerciseDef } from "../exercises/generic/types";
import { drawUser } from "../exercises/squat/draw";
import { drawGhostPose, ghostPose, ghostSpec, repProgress, tempoProgress } from "../exercises/generic/ghost";
import { REFERENCE } from "../exercises/generic/reference";
import { FramingCoach } from "../pose/framing";
import type { BodyDims } from "../pose/lift";
import { getProfile } from "../data/api";
import { openCamera, syncCanvas } from "./camera";
import { setPendingWorkout } from "./pending";
import { h, mount, topbar } from "./dom";

const PREF_KEY = "formcoach.prefs.v1";
const limitsKey = (id: string) => `formcoach.limits.${id}.v1`;
const VIEW_NAMES: Record<CameraView, string> = { front: "Front", side: "Side", diagonal: "Diagonal (45°)" };

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); if (raw) return { ...fallback, ...JSON.parse(raw) }; } catch { /* storage unavailable */ }
  return fallback;
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }
function speak(on: boolean, text: string) {
  if (!on || !("speechSynthesis" in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* unavailable */ }
}

/** Live coaching for a catalog exercise (#/workout/<id>). */
export function exerciseWorkoutPage(id: string): () => void {
  const found = byId(id);
  if (!found) { location.hash = "#/"; return () => {}; }
  const base: ExerciseDef = found;
  const prefs = load(PREF_KEY, { model: "lite" as ModelName, facing: "user", voice: true, ghost: "follow" });
  const ref = REFERENCE[id];
  // Body profile (Profile → Body measurements): exact segment lengths for the 3D skeleton and the ghost.
  let body: BodyDims | null = null;
  getProfile().then(p => { body = p.body?.dims ?? null; }).catch(() => { /* not signed in or no profile: lengths are learned live */ });
  const limits: Record<string, CheckDef["limit"]> = load(limitsKey(id), Object.fromEntries(base.checks.map(c => [c.code, { ...c.limit }])));
  const defWithLimits = (): ExerciseDef => ({ ...base, checks: base.checks.map(c => ({ ...c, limit: limits[c.code] ?? c.limit })) });

  const video = h("video", { playsinline: true, muted: true });
  const canvas = h("canvas");
  const ctx = canvas.getContext("2d")!;
  const count = h("b", {}, base.mode === "hold" ? "0 s" : "0");
  const status = h("div", { class: "status" }, "Camera off");
  const meterFill = h("i");
  const meter = h("div", { class: "meter", "aria-hidden": "true" }, meterFill);
  const banner = h("div", { class: "banner", hidden: true });
  const cue = h("div", { class: "cue", hidden: true, "aria-live": "assertive" });
  const error = h("p", { class: "error", role: "alert" });
  const viewSel = h("select", {}, ...base.views.map(v => h("option", { value: v }, VIEW_NAMES[v])));
  viewSel.value = base.defaultView;
  const modelSel = h("select", {}, h("option", { value: "lite" }, "Lite (faster)"), h("option", { value: "full" }, "Full (more accurate)"));
  const camSel = h("select", {}, h("option", { value: "user" }, "Front camera"), h("option", { value: "environment" }, "Back camera"));
  modelSel.value = prefs.model; camSel.value = prefs.facing;
  const startBtn = h("button", { class: "btn" }, "Start camera");
  const intro = h("div", { class: "overlay" },
    h("div", { class: "intro" },
      h("h2", {}, base.short),
      h("p", { class: "muted" }, base.equipment),
      h("p", {}, h("b", {}, "Camera: "), base.filming),
      h("p", { class: "small muted" }, "Before you start (the camera can't check these):"),
      h("ul", { class: "small" }, ...base.tips.map(t => h("li", {}, t))),
      h("div", { class: "row" },
        h("label", { class: "field" }, "View", viewSel),
        h("label", { class: "field" }, "Model", modelSel),
        h("label", { class: "field" }, "Camera", camSel)),
      startBtn, error));

  const live = h("p", { class: "fps" });
  const fps = h("p", { class: "fps" });
  const finishBtn = h("button", { class: "btn", disabled: true }, "Finish & review");
  const voice = h("input", { type: "checkbox" }); voice.checked = prefs.voice;
  voice.addEventListener("change", () => { prefs.voice = voice.checked; save(PREF_KEY, prefs); });
  const ghostRadios = ([["follow", "Ghost follows you"], ["lead", "Ghost leads the tempo"], ["off", "No ghost"]] as const).map(([v, label]) => {
    const r = h("input", { type: "radio", name: "ghost", value: v });
    r.checked = prefs.ghost === v;
    r.addEventListener("change", () => { prefs.ghost = v; save(PREF_KEY, prefs); tempoStart = performance.now() / 1000; });
    return h("label", {}, r, " ", label);
  });
  const framing = new FramingCoach();

  const limitRows = base.checks.map(c => {
    const key = c.limit.min !== undefined ? "min" : "max";
    const input = h("input", { type: "number", step: "any", value: String(limits[c.code]?.[key] ?? c.limit[key]), class: "limit-input", "aria-label": `${c.name} limit` });
    input.addEventListener("change", () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) { limits[c.code] = { [key]: v }; save(limitsKey(id), limits); coach && (coach.def = defWithLimits()); }
    });
    return h("li", {},
      h("span", {}, `${c.name} `, h("span", { class: "muted small" }, `(${c.views.map(v => VIEW_NAMES[v].toLowerCase()).join("/")})`)),
      h("span", { class: "limit" }, key === "min" ? "≥ " : "≤ ", input, ` ${c.unit}`),
      h("span", { class: "muted small source" }, `${c.source.checkpoints.join(", ")}: ${c.source.limit}`));
  });

  mount(
    topbar(base.short, h("a", { href: "#/", class: "btn quiet small" }, "Exit")),
    h("main", { class: "workout" },
      h("div", { class: "stage" }, video, canvas,
        h("div", { class: "reps", "aria-live": "polite" }, count, h("span", {}, base.mode === "hold" ? `of ${base.hold!.targetS} s` : "reps")),
        status, meter, banner, cue, intro),
      h("section", { class: "panel" },
        h("div", { class: "actions" }, finishBtn),
        live, fps,
        h("div", { class: "choice" }, ...(ref && base.mode === "reps" ? ghostRadios : ref ? ghostRadios.filter((_, i) => i !== 1) : []), h("label", {}, voice, " Speak cues")),
        h("ul", { class: "legend" },
          h("li", {}, h("span", { class: "sw ghost" }), "Ghost: correct form, built to your body"),
          h("li", {}, h("span", { class: "sw you" }), "You")),
        h("details", { class: "rules" },
          h("summary", {}, "Checks and limits"),
          h("p", { class: "note" }, "From docs/research/exercise_technique_dataset.json. Limits marked [Placeholder] are starting values; a coach sets the final ones. Changes are kept on this device."),
          h("ul", { class: "limits" }, ...limitRows),
          h("button", { class: "btn quiet small", onclick: () => {
            for (const c of base.checks) limits[c.code] = { ...c.limit };
            save(limitsKey(id), limits); location.reload();
          } }, "Reset to defaults")))));

  let landmarker: PoseLandmarker | null = null;
  let stream: MediaStream | null = null;
  let running = false, lastVideoTime = -1, raf = 0, t0 = 0, tempoStart = 0, frames = 0, fpsT = performance.now(), lastLiveCue = 0;
  let coach: GenericCoach | null = null;
  let startedAt = "";
  let modelName: ModelName = "lite";
  let wakeLock: { release(): Promise<void> } | null = null;
  const reps: GenericRep[] = [];

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
    catch { startBtn.disabled = false; startBtn.textContent = "Start camera"; setStatus("Camera off"); error.textContent = "The pose model couldn't load. Check your connection and try again."; return; }
    try {
      stream = await openCamera(prefs.facing);
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      stop();
      startBtn.disabled = false; startBtn.textContent = "Start camera"; setStatus("Camera off");
      error.textContent = (e as Error)?.name === "NotAllowedError"
        ? "Camera access was blocked. Allow the camera in your browser's site settings, then try again."
        : "No camera could be opened. Check that no other app is using it, then try again.";
      return;
    }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const mirror = prefs.facing === "user";
    video.classList.toggle("mirror", mirror); canvas.classList.toggle("mirror", mirror);
    coach = new GenericCoach(defWithLimits(), video.videoWidth / video.videoHeight, viewSel.value as CameraView, body);
    startBtn.disabled = false; startBtn.textContent = "Start camera";
    intro.hidden = true;
    t0 = performance.now() / 1000; tempoStart = t0;
    if (!startedAt) startedAt = new Date().toISOString();
    finishBtn.disabled = false;
    running = true; lastVideoTime = -1;
    try { wakeLock = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen"); } catch { /* not supported */ }
    setCue(base.mode === "hold" ? "Get into position" : "Start when ready");
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false; cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
    wakeLock?.release().catch(() => {}); wakeLock = null;
  }

  function loop() {
    if (!running || !landmarker || !coach) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      if (syncCanvas(video, canvas)) coach.aspect = video.videoWidth / video.videoHeight;
      const now = performance.now();
      let pose: Pose | null = null, world: WorldPose | null = null;
      try {
        const res = landmarker.detectForVideo(video, now);
        if (res.landmarks?.length) {
          pose = res.landmarks[0].map(p => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 }));
          world = res.worldLandmarks?.[0]?.map(p => ({ x: p.x, y: p.y, z: p.z })) ?? null;
        }
      } catch (e) { console.error("Pose detection failed:", e); }
      onFrame(now / 1000 - t0, pose, world);
      frames++;
      if (now - fpsT > 1000) { fps.textContent = `${frames} frames per second · model: ${modelName}`; frames = 0; fpsT = now; }
    }
    raf = requestAnimationFrame(loop);
  }

  function onFrame(t: number, raw: Pose | null, world: WorldPose | null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const st = coach!.step(t, raw, world);
    if (st.phase === "no-person") { setStatus("No one in view"); setBanner(st.banner); setMeter(0); framing.update(null); return; }
    setStatus("Tracking", true);
    setBanner(framing.update(st.pose) ?? st.banner);
    if (ref && prefs.ghost !== "off" && st.lifted && st.axes && st.features) {
      const phase = prefs.ghost === "lead" ? tempoProgress(ref, performance.now() / 1000 - tempoStart) : repProgress(base, st.signal);
      drawGhostPose(ctx, ghostPose(ref, ghostSpec(ref, base, phase), st.lifted, st.axes, st.features.facing, coach!.aspect));
    }
    drawUser(ctx, st.pose, {});
    const sig = base.signal;
    if (sig && st.signal !== null) {
      const p = sig.rest === "high" ? (sig.exit - st.signal) / (sig.exit - sig.mustReach) : (st.signal - sig.exit) / (sig.mustReach - sig.exit);
      setMeter(p);
      live.textContent = `Live: ${sig.label.toLowerCase()} ${Math.round(st.signal)}°`;
    }
    if (base.mode === "hold") {
      const s = st.holdS ?? 0;
      count.textContent = `${Math.floor(s)} s`;
      setMeter(s / base.hold!.targetS);
      live.textContent = st.holdS === null ? "Live: not in position" : `Live: holding ${s.toFixed(0)} s`;
    }
    if (st.failing.length && t - lastLiveCue > 2) {
      const c = base.checks.find(x => x.code === st.failing[0])!;
      setCue(c.cue, c.severity === "safety" ? "bad" : "warn");
      lastLiveCue = t;
    }
    if (st.event === "start" && base.mode === "reps") setCue(null);
    else if (st.event && typeof st.event === "object") onRep(st.event);
  }

  function onRep(rep: GenericRep) {
    reps.push(rep);
    if (!rep.trackingOk) { setCue("Lost tracking on that one. Not counted.", "warn"); return; }
    const scored = reps.filter(r => r.trackingOk).length;
    if (base.mode === "reps") count.textContent = String(scored);
    if (!rep.issues.length) {
      const msg = base.mode === "hold" ? `Good hold: ${Math.round(rep.downTime)} seconds` : "Good rep";
      setCue(msg, "good"); speak(voice.checked, base.mode === "hold" ? msg : String(scored)); return;
    }
    const c = base.checks.find(x => x.code === rep.issues[0])!;
    setCue(c.cue, c.severity === "safety" ? "bad" : "warn");
    speak(voice.checked, base.mode === "hold" ? c.cue : `${scored}. ${c.cue}`);
  }

  startBtn.addEventListener("click", start);
  finishBtn.addEventListener("click", () => {
    stop();
    setPendingWorkout({
      exercise: base.id, view: (coach?.view ?? base.defaultView), source: "live",
      startedAt, endedAt: new Date().toISOString(),
      poseModel: poseModelId(modelName), frameWidth: canvas.width, frameHeight: canvas.height,
      device: /android/i.test(navigator.userAgent) ? "android" : /iphone|ipad/i.test(navigator.userAgent) ? "ios" : "desktop",
      thresholds: { ...limits }, calibrations: [], reps
    });
    location.hash = "#/summary";
  });

  return stop;
}
