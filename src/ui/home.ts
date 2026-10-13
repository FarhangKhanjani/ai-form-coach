import { listSessions, getProfile, getSession, setLabel, deleteSession, exportSession, type SessionDetail } from "../data/api";
import { h, mount, topbar, fmtDate, download, errorText } from "./dom";
import { labelEditor, issuesText, repDetails } from "./labels";
import { CATALOG, byId } from "../exercises/generic/catalog";

export async function homePage() {
  const list = h("div", { class: "list" }, h("p", { class: "muted" }, "Loading…"));
  const hello = h("p", { class: "muted" });
  mount(
    topbar("Home", h("a", { href: "#/profile", class: "btn quiet small" }, "Profile")),
    h("main", { class: "page" },
      hello,
      h("a", { class: "start-card", href: "#/workout/squat" },
        h("span", { class: "start-title" }, "Squat"),
        h("span", { class: "start-sub" }, "Bodyweight or goblet · front camera · with ghost"),
        h("span", { class: "start-go" }, "Start →")),
      h("h2", {}, "All exercises"),
      h("div", { class: "exercise-list" }, ...CATALOG.map(d => h("div", { class: "exercise-row" },
        h("div", {}, h("b", {}, d.short), h("span", { class: "muted small" }, ` · ${d.equipment} · ${d.defaultView} view`)),
        h("div", { class: "exercise-actions" },
          h("a", { class: "btn small", href: `#/workout/${d.id}` }, "Start"),
          h("a", { class: "btn quiet small", href: `#/import/${d.id}` }, "Video"))))),
      h("a", { class: "start-card secondary", href: "#/import/squat" },
        h("span", { class: "start-title small-title" }, "Import a video"),
        h("span", { class: "start-sub" }, "Analyze any exercise video on this device and label each rep"),
        h("span", { class: "start-go" }, "Open →")),
      h("h2", {}, "Your sessions"),
      list));

  getProfile().then(p => { hello.textContent = `Hi ${p.display_name ?? ""}`.trim() + "."; }).catch(() => {});
  try {
    const sessions = await listSessions();
    if (!sessions.length) { list.replaceChildren(h("p", { class: "muted" }, "No sessions yet. Do a set of squats and save it.")); return; }
    list.replaceChildren(...sessions.map(s => {
      const scored = s.reps.filter(r => r.tracking_ok);
      const clean = scored.filter(r => !r.issues.length).length;
      return h("a", { class: "row-link", href: `#/session/${s.id}` },
        h("span", {}, h("b", {}, byId(s.exercise_id)?.short ?? "Squat"), " · ", fmtDate(s.started_at),
          s.source === "video_import" ? h("span", { class: "tag" }, `video · ${s.camera_view}`) : null),
        h("span", { class: "muted" }, `${scored.length} reps · ${clean} clean`));
    }));
  } catch (e) {
    list.replaceChildren(h("p", { class: "error" }, "Couldn't load sessions: " + errorText(e)));
  }
}

export async function sessionPage(id: string) {
  const body = h("div", {}, h("p", { class: "muted" }, "Loading…"));
  mount(topbar("Session"), h("main", { class: "page" }, body));
  let s: SessionDetail;
  try { s = await getSession(id); } catch (e) { body.replaceChildren(h("p", { class: "error" }, errorText(e))); return; }
  const scored = s.reps.filter(r => r.tracking_ok);
  body.replaceChildren(
    h("p", { class: "muted" }, `${fmtDate(s.started_at)} · ${s.camera_view} view · ${s.pose_model ?? ""}` +
      (s.source === "video_import" ? ` · imported video "${String(s.source_meta?.fileName ?? "")}" (${String(s.source_meta?.origin ?? "")})` : "")),
    h("div", { class: "stats" },
      h("div", {}, h("b", {}, scored.length), h("span", {}, "Reps")),
      h("div", {}, h("b", {}, scored.filter(r => !r.issues.length).length), h("span", {}, "Clean")),
      h("div", {}, h("b", {}, s.reps.filter(r => r.rep_labels.length).length), h("span", {}, "Labeled"))),
    h("p", { class: "note" }, "Label each rep with what you think really happened. Your labels, not the app's flags, become the training data."),
    h("div", { class: "rep-cards" }, ...s.reps.map(r => h("div", { class: "rep-card" + (r.tracking_ok ? "" : " dim") },
      h("div", { class: "rep-head" },
        h("b", {}, `Rep ${r.n}`),
        r.tracking_ok ? issuesText(r.issues, s.exercise_id) : h("span", { class: "muted" }, "Tracking unreliable, not scored")),
      ...repDetails(s.exercise_id, r.metrics, Number(r.down_time_s), s.camera_view),
      labelEditor(r.rep_labels[0] ? { correct: r.rep_labels[0].correct, errors: r.rep_labels[0].error_codes } : null,
        l => l ? setLabel(r.id, { ...l, note: r.rep_labels[0]?.note ?? undefined }) : undefined, true, s.exercise_id),
      r.rep_labels[0]?.note ? h("p", { class: "rep-metrics" }, `Why: ${r.rep_labels[0].note}`) : null))),
    h("div", { class: "actions" },
      h("button", { class: "btn quiet", onclick: async () => download(`${s.exercise_id}-session-${s.started_at.slice(0, 16).replace(/[:T]/g, "")}.json`, await exportSession(s.id)) }, "Download JSON"),
      h("button", { class: "btn quiet danger", onclick: async () => {
        if (!confirm("Delete this session and all its reps?")) return;
        await deleteSession(s.id); location.hash = "#/";
      } }, "Delete session")));
}
