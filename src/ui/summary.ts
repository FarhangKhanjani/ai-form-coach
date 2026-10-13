import { saveWorkout, type RepLabel, type WorkoutRecord } from "../data/api";
import { h, mount, topbar, download, errorText } from "./dom";
import { anglesText, issuesText, labelEditor } from "./labels";
import { pendingWorkout, clearPendingWorkout } from "./workout";

/** JSON export of an unsaved workout (format version 2). */
function exportJson(w: WorkoutRecord, labels: Map<number, RepLabel>) {
  return {
    app: "ai-form-coach", version: 2, exportedAt: new Date().toISOString(),
    landmarkFormat: "MediaPipe Pose 33 landmarks: lm = [x, y, z, visibility] normalized to the frame; world = [x, y, z] meters, hip-centered",
    ...w,
    reps: w.reps.map(r => ({ ...r, label: labels.get(r.n) ?? null }))
  };
}

export function summaryPage() {
  const w = pendingWorkout;
  if (!w) { location.hash = "#/"; return; }
  const labels = new Map<number, RepLabel>();
  const scored = w.reps.filter(r => r.trackingOk);
  const status = h("p", { class: "form-status", role: "alert" });
  const saveBtn = h("button", { class: "btn" }, "Save to my account");
  const fileName = `squat-session-${w.startedAt.slice(0, 16).replace(/[:T-]/g, "")}.json`;

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true; saveBtn.textContent = "Saving…"; status.textContent = "";
    try {
      const id = await saveWorkout(w, labels);
      clearPendingWorkout();
      location.hash = `#/session/${id}`;
    } catch (e) {
      saveBtn.disabled = false; saveBtn.textContent = "Try again";
      status.textContent = `Couldn't save: ${errorText(e)}. Your reps are still here; you can also download them as a file.`;
    }
  });

  mount(
    topbar("Review"),
    h("main", { class: "page" },
      h("div", { class: "stats" },
        h("div", {}, h("b", {}, scored.length), h("span", {}, "Reps")),
        h("div", {}, h("b", {}, scored.filter(r => !r.issues.length).length), h("span", {}, "Clean")),
        h("div", {}, h("b", {}, scored.length ? (scored.reduce((a, r) => a + r.downTime, 0) / scored.length).toFixed(1) + " s" : "–"), h("span", {}, "Avg down time"))),
      w.reps.length
        ? h("p", { class: "note" }, "Optional: tag each rep with what you think really happened. You can also do this later from the session page.")
        : h("p", { class: "muted" }, "No reps were recorded."),
      h("div", { class: "rep-cards" }, ...w.reps.map(r => h("div", { class: "rep-card" + (r.trackingOk ? "" : " dim") },
        h("div", { class: "rep-head" }, h("b", {}, `Rep ${r.n}`),
          r.trackingOk ? issuesText(r.issues) : h("span", { class: "muted" }, "Tracking unreliable: " + r.trackingProblems.join(", "))),
        h("p", { class: "rep-metrics" }, `Depth ${r.metrics.depthPct}% · knees ${Number(r.metrics.kneeRatio).toFixed(2)}× · down ${r.downTime.toFixed(1)} s`),
        anglesText(r.metrics.anglesAtBottom),
        labelEditor(null, l => { if (l) labels.set(r.n, l); else labels.delete(r.n); }, false)))),
      h("div", { class: "actions sticky" },
        saveBtn,
        h("button", { class: "btn quiet", onclick: () => download(fileName, exportJson(w, labels)) }, "Download JSON"),
        h("button", { class: "btn quiet danger", onclick: () => { if (confirm("Discard this workout?")) { clearPendingWorkout(); location.hash = "#/"; } } }, "Discard")),
      status));
}
