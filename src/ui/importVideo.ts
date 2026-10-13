import { getLandmarker, poseModelId, resetImportLandmarker, type ModelName } from "../pose/landmarker";
import type { Pose, WorldPose } from "../pose/types";
import { SquatCoach } from "../exercises/squat/coach";
import { DEFAULTS, type CameraView } from "../exercises/squat/config";
import { drawUser } from "../exercises/squat/draw";
import type { Rep } from "../exercises/squat/reps";
import { saveWorkout, type RepLabel, type WorkoutRecord } from "../data/api";
import { h, mount, topbar, download, errorText } from "./dom";
import { anglesText, issuesText, labelEditor } from "./labels";

const FPS = 30;                 // frames analyzed per second of video, same as the live camera
const CONSENT_TEXT_VERSION = 1; // bump when the consent wording below changes

const ORIGINS = {
  own: "My own recording",
  coach: "Video from a coach, with their permission",
  dataset: "Public dataset whose license allows it",
  other: "Other, with permission from the person filmed"
} as const;

/**
 * Analyze a squat video on this device, label each rep, save keypoints and labels.
 * The video never leaves the phone or computer (project rule: video stays on the device).
 */
export function importVideoPage(): () => void {
  let cancelled = false;
  let objectUrl: string | null = null;

  const file = h("input", { type: "file", accept: "video/*", required: true });
  const view = h("select", {}, h("option", { value: "front" }, "Front"), h("option", { value: "side" }, "Side"), h("option", { value: "diagonal" }, "Diagonal (45°)"));
  const origin = h("select", {}, ...Object.entries(ORIGINS).map(([v, t]) => h("option", { value: v }, t)));
  const originDetail = h("input", { type: "text", placeholder: "e.g. Coach A, permission by email 13 Oct · or dataset name + license" });
  const person = h("input", { type: "text", placeholder: "e.g. Coach A, Subject 3 (no full names needed)" });
  const coachCorrect = h("input", { type: "checkbox" });
  const consent = h("input", { type: "checkbox", required: true });
  const model = h("select", {}, h("option", { value: "full" }, "Full (more accurate, recommended)"), h("option", { value: "lite" }, "Lite (faster)"));
  const status = h("p", { class: "form-status", role: "alert" });
  const go = h("button", { class: "btn", type: "submit" }, "Analyze video");

  const form = h("form", { class: "auth-form" },
    h("label", { class: "field" }, "Video file", file),
    h("label", { class: "field" }, "Camera view", view),
    h("label", { class: "field" }, "Where the video comes from", origin),
    h("label", { class: "field" }, "Details (who gave permission, or dataset and license)", originDetail),
    h("label", { class: "field" }, "Person in the video (optional)", person),
    h("label", { class: "check" }, coachCorrect, h("span", {}, "Every rep in this video is correct form, confirmed by a coach.")),
    h("label", { class: "field" }, "Pose model", model),
    h("label", { class: "check" }, consent, h("span", {},
      "The person in this video agreed to it being used to build the coach, and I am allowed to use this video. Only body keypoints and labels are saved; the video stays on this device.")),
    go, status);

  mount(
    topbar("Import video", h("a", { href: "#/", class: "btn quiet small" }, "Exit")),
    h("main", { class: "page", id: "import-main" },
      h("p", { class: "note" }, "Analyze a squat video with the same pose model and rep detection as the live camera, then label each rep. Use only videos you have permission for (see docs/datasets.md)."),
      form));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = file.files?.[0];
    if (!f) { status.textContent = "Choose a video file."; return; }
    if (!consent.checked) { status.textContent = "Confirm you have permission to use this video."; return; }
    go.disabled = true; status.textContent = "";
    try {
      await analyze(f, {
        view: view.value as CameraView, model: model.value as ModelName,
        sourceMeta: {
          fileName: f.name, origin: origin.value, originDetail: originDetail.value || null, person: person.value || null,
          coachConfirmedCorrect: coachCorrect.checked, consentConfirmed: true, consentTextVersion: CONSENT_TEXT_VERSION
        }
      });
    } catch (err) {
      go.disabled = false;
      status.textContent = errorText(err);
    }
  });

  async function analyze(f: File, opt: { view: CameraView; model: ModelName; sourceMeta: Record<string, unknown> }) {
    objectUrl = URL.createObjectURL(f);
    const video = h("video", { muted: true, playsinline: true, preload: "auto", class: "import-video" });
    video.src = objectUrl;
    await new Promise<void>((ok, fail) => {
      video.addEventListener("loadeddata", () => ok(), { once: true });
      video.addEventListener("error", () => fail(new Error("This video format can't be opened in this browser. Try an MP4 (H.264) or WebM file.")), { once: true });
    });
    const W = video.videoWidth, H = video.videoHeight, duration = video.duration;
    if (!W || !isFinite(duration)) throw new Error("Couldn't read the video's size or length.");

    const canvas = h("canvas", { width: W, height: H, class: "import-canvas" });
    const ctx = canvas.getContext("2d")!;
    const bar = h("i");
    const progress = h("p", { class: "muted" }, "Loading pose model…");
    const cancel = h("button", { class: "btn quiet", onclick: () => { cancelled = true; } }, "Cancel");
    document.getElementById("import-main")!.replaceChildren(
      h("h2", {}, "Analyzing"), progress, h("div", { class: "bar" }, bar),
      h("div", { class: "import-stage" }, video, canvas), h("div", { class: "actions" }, cancel));

    resetImportLandmarker();
    const lm = await getLandmarker(opt.model, "import");
    const coach = new SquatCoach({ ...DEFAULTS }, W / H, opt.view);
    const reps: Rep[] = [];
    const calibrations: WorkoutRecord["calibrations"] = [];
    let lastMessage: string | null = null;
    const frames = Math.floor(duration * FPS);

    for (let i = 0; i < frames; i++) {
      if (cancelled) { location.hash = "#/"; return; }
      const t = i / FPS;
      await seek(video, t);
      let pose: Pose | null = null, world: WorldPose | null = null;
      const res = lm.detectForVideo(video, Math.round(t * 1000) + 1);
      if (res.landmarks?.length) {
        pose = res.landmarks[0].map(p => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 }));
        world = res.worldLandmarks?.[0]?.map(p => ({ x: p.x, y: p.y, z: p.z })) ?? null;
      }
      const st = coach.step(t, pose, world);
      if (st.phase === "calibrating" && st.message) lastMessage = st.message;
      if (st.phase === "tracking" && st.event === "calibrated") calibrations.push({ t, cal: st.cal });
      if (st.phase === "tracking" && st.event && typeof st.event === "object") reps.push(st.event);
      if (i % 5 === 0) {
        ctx.clearRect(0, 0, W, H);
        if (st.phase !== "no-person") drawUser(ctx, st.pose, st.phase === "tracking" ? st.flags ?? {} : {});
        bar.style.width = Math.round(100 * i / frames) + "%";
        progress.textContent = `Analyzing ${t.toFixed(1)} s of ${duration.toFixed(1)} s · ${reps.length} reps so far`;
      }
    }

    const record: WorkoutRecord = {
      exercise: "squat", view: opt.view, source: "video_import",
      sourceMeta: { ...opt.sourceMeta, durationS: Math.round(duration * 10) / 10, fpsAnalyzed: FPS },
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
      poseModel: poseModelId(opt.model), frameWidth: W, frameHeight: H, device: "video-import",
      thresholds: { ...DEFAULTS }, calibrations, reps
    };
    review(video, record, !calibrations.length ? lastMessage : null);
  }

  function review(video: HTMLVideoElement, w: WorkoutRecord, calibrationProblem: string | null) {
    video.controls = true;
    const labels = new Map<number, RepLabel>();
    const notes = new Map<number, string>();
    const status = h("p", { class: "form-status", role: "alert" });
    const saveBtn = h("button", { class: "btn" }, "Save to my account");
    let stopAt = Infinity;
    video.addEventListener("timeupdate", () => { if (video.currentTime >= stopAt) { video.pause(); stopAt = Infinity; } });
    const playRep = (r: Rep) => { video.currentTime = Math.max(0, r.start - 0.3); stopAt = r.end + 0.3; video.play().catch(() => {}); };

    const coachCorrect = w.sourceMeta?.coachConfirmedCorrect === true;
    const cards = w.reps.map(r => {
      const note = h("textarea", { rows: 2, placeholder: "Why? (optional)", class: "note-input" });
      note.addEventListener("input", () => notes.set(r.n, note.value));
      const editor = labelEditor(coachCorrect && r.trackingOk ? { correct: true, errors: [] } : null,
        l => { if (l) labels.set(r.n, l); else labels.delete(r.n); }, false);
      if (coachCorrect && r.trackingOk) labels.set(r.n, { correct: true, errors: [] });
      return h("div", { class: "rep-card" + (r.trackingOk ? "" : " dim") },
        h("div", { class: "rep-head" },
          h("b", {}, `Rep ${r.n}`), h("span", { class: "muted small" }, `${r.start.toFixed(1)}–${r.end.toFixed(1)} s`),
          r.trackingOk ? issuesText(r.issues) : h("span", { class: "muted" }, "Tracking unreliable: " + r.trackingProblems.join(", "))),
        h("p", { class: "rep-metrics" }, `Depth ${r.metrics.depthPct}% · down ${r.downTime.toFixed(1)} s` + (w.view === "front" ? ` · knees ${Number(r.metrics.kneeRatio).toFixed(2)}×` : "")),
        anglesText(r.metrics.anglesAtBottom),
        h("button", { class: "btn quiet small", type: "button", onclick: () => playRep(r) }, "▶ Play this rep"),
        editor, note);
    });

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true; saveBtn.textContent = "Saving…"; status.textContent = "";
      for (const [n, text] of notes) { const l = labels.get(n); if (l) l.note = text.trim() || undefined; }
      try {
        const id = await saveWorkout(w, labels);
        location.hash = `#/session/${id}`;
      } catch (e) {
        saveBtn.disabled = false; saveBtn.textContent = "Try again";
        status.textContent = `Couldn't save: ${errorText(e)}`;
      }
    });

    const scored = w.reps.filter(r => r.trackingOk);
    document.getElementById("import-main")!.replaceChildren(
      h("h2", {}, "Label the reps"),
      h("div", { class: "import-stage" }, video),
      calibrationProblem
        ? h("p", { class: "error" }, `No reps found: the person never stood still long enough to calibrate. Last message: "${calibrationProblem}"`)
        : h("p", { class: "muted" }, `${w.reps.length} reps found, ${scored.length} with reliable tracking.` +
            (w.view !== "front" ? ` ${w.view === "side" ? "Side" : "Diagonal"} view: only depth${w.view === "side" ? ", heels" : ""} and tempo are checked.` : "")),
      h("p", { class: "note" }, coachCorrect
        ? "Marked as coach-confirmed correct: every reliable rep starts labeled \"Correct\". Change any that aren't."
        : "Play each rep and label what really happened. Add why if it isn't obvious."),
      h("div", { class: "rep-cards" }, ...cards),
      h("div", { class: "actions sticky" }, saveBtn,
        h("button", { class: "btn quiet", onclick: () => download(`squat-import-${Date.now()}.json`, {
          app: "ai-form-coach", version: 2, exportedAt: new Date().toISOString(), ...w,
          reps: w.reps.map(r => ({ ...r, label: labels.get(r.n) ?? null, note: notes.get(r.n) ?? null }))
        }) }, "Download JSON")),
      status);
  }

  return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
}

function seek(video: HTMLVideoElement, t: number) {
  return new Promise<void>(ok => {
    if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) return ok();
    video.addEventListener("seeked", () => ok(), { once: true });
    video.currentTime = t;
  });
}
