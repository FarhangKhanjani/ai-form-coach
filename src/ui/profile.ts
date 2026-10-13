import { supabase } from "../supabase";
import { getProfile, updateProfile, deleteAllMySessions } from "../data/api";
import { h, mount, topbar, errorText } from "./dom";

export async function profilePage() {
  const body = h("div", {}, h("p", { class: "muted" }, "Loading…"));
  mount(topbar("Profile"), h("main", { class: "page" }, body));
  try {
    const p = await getProfile();
    const { data } = await supabase.auth.getUser();
    const name = h("input", { type: "text", value: p.display_name ?? "", autocomplete: "name" });
    const height = h("input", { type: "number", min: 50, max: 260, step: 0.5, value: p.height_cm ?? "", inputmode: "decimal" });
    const consent = h("input", { type: "checkbox" }); consent.checked = p.consent_training;
    const status = h("p", { class: "form-status", role: "status" });
    const form = h("form", { class: "auth-form" },
      h("label", { class: "field" }, "Name", name),
      h("label", { class: "field" }, "Height (cm, optional)", height),
      h("label", { class: "check" }, consent,
        h("span", {}, "Use my reps to improve the coach. Coaches on the team can then see my keypoints and labels to build and check the rules. Never video. You can switch this off any time.")),
      h("button", { class: "btn", type: "submit" }, "Save"), status);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      status.className = "form-status";
      try {
        await updateProfile({ display_name: name.value || null, height_cm: height.value ? Number(height.value) : null, consent_training: consent.checked });
        status.className = "form-status ok"; status.textContent = "Saved.";
      } catch (err) { status.textContent = errorText(err); }
    });
    body.replaceChildren(
      h("p", { class: "muted" }, `Signed in as ${data.user?.email ?? ""}${p.role !== "athlete" ? ` · ${p.role}` : ""}`),
      form,
      h("div", { class: "actions" },
        h("button", { class: "btn quiet", onclick: async () => { await supabase.auth.signOut(); location.hash = "#/login"; } }, "Sign out"),
        h("button", { class: "btn quiet danger", onclick: async () => {
          if (!confirm("Delete all your saved sessions, reps and keypoints? This can't be undone.")) return;
          await deleteAllMySessions(); alert("All your sessions were deleted.");
        } }, "Delete all my data")),
      h("p", { class: "fineprint" }, "To delete your account itself, ask the team; it removes everything linked to it."));
  } catch (e) {
    body.replaceChildren(h("p", { class: "error" }, errorText(e)));
  }
}
