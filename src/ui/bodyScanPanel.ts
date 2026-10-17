// Profile → Body measurements: height plus a front and a side photo, analyzed on this phone.
// Only the lengths are saved (profiles.body); the photos are never uploaded or stored.
import { getLandmarker } from "../pose/landmarker";
import { combine, measurePhoto, type PhotoView, type ScanPhoto } from "../pose/bodyScan";
import { BONES, type Pose } from "../pose/types";
import type { BodyDims } from "../pose/lift";
import { updateProfile, type BodyProfile, type Profile } from "../data/api";
import { h, errorText } from "./dom";

const NAMES: Record<keyof BodyDims, string> = {
  hipWidth: "Hip width (hip joints)", shoulderWidth: "Shoulder width (joints)", torso: "Hip to shoulder", upperArm: "Upper arm",
  forearm: "Forearm", thigh: "Thigh", shin: "Shin", heel: "Ankle to heel", foot: "Ankle to toe", neck: "Shoulders to nose"
};

async function poseFromImage(file: File): Promise<{ pose: Pose; img: HTMLImageElement } | null> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    img.src = url;
    await img.decode();
    const lm = await getLandmarker("full", "image");
    const res = lm.detect(img);
    if (!res.landmarks?.length) return null;
    return { pose: res.landmarks[0].map(p => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 })), img };
  } finally { URL.revokeObjectURL(url); }
}

function preview(img: HTMLImageElement, pose: Pose): HTMLCanvasElement {
  const c = h("canvas", { class: "scan-preview" });
  const scale = Math.min(1, 480 / img.naturalHeight);
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.strokeStyle = "#8FD3FF"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath();
  for (const [a, b] of BONES) { ctx.moveTo(pose[a].x * c.width, pose[a].y * c.height); ctx.lineTo(pose[b].x * c.width, pose[b].y * c.height); }
  ctx.stroke();
  return c;
}

export function bodyScanPanel(p: Profile, heightInput: HTMLInputElement): HTMLElement {
  // Photos found so far (pose and size only); measured again whenever the height changes.
  const photos: Partial<Record<PhotoView, ScanPhoto>> = {};
  const status = h("p", { class: "form-status", role: "status" });
  const table = h("div");
  const saveBtn = h("button", { class: "btn", disabled: true }, "Save measurements");
  let pending: BodyProfile | null = null;

  const showDims = (dims: BodyDims, estimated: (keyof BodyDims)[], when?: string) => {
    table.replaceChildren(
      h("table", { class: "dims" }, ...(Object.keys(NAMES) as (keyof BodyDims)[]).map(k =>
        h("tr", {}, h("td", {}, NAMES[k]), h("td", {}, `${dims[k].toFixed(1)} cm`), h("td", { class: "muted small" }, estimated.includes(k) ? "typical value (no side photo)" : "")))),
      when ? h("p", { class: "muted small" }, when) : h("span"));
  };
  if (p.body) showDims(p.body.dims, [], `Saved ${new Date(p.body.measuredAt).toLocaleDateString()} from ${p.body.photos.map(x => x.view).join(" + ")} photo, height ${p.body.heightCm} cm.`);

  const recompute = () => {
    saveBtn.disabled = true;
    const height = Number(heightInput.value);
    const views = (Object.keys(photos) as PhotoView[]).filter(v => !measurePhoto(photos[v]!, 175).problems.length);
    if (!views.includes("front")) return;
    if (!(height >= 100 && height <= 230)) { status.className = "form-status"; status.textContent = "Enter your height (cm) above first."; return; }
    status.textContent = "";
    const { dims, estimated } = combine(views.map(v => measurePhoto(photos[v]!, height)), height);
    pending = { dims, heightCm: height, photos: views.map(view => ({ view })), measuredAt: new Date().toISOString(), method: "photos" };
    showDims(dims, estimated, "Not saved yet.");
    saveBtn.disabled = false;
  };

  const photoInput = (view: PhotoView) => {
    const input = h("input", { type: "file", accept: "image/*", "aria-label": `${view} photo` });
    const out = h("div", { class: "scan-photo" });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      out.replaceChildren(h("p", { class: "muted small" }, "Finding your joints…"));
      try {
        delete photos[view];
        const found = await poseFromImage(file);
        if (!found) { out.replaceChildren(h("p", { class: "error" }, "No person found in this photo.")); recompute(); return; }
        const ph: ScanPhoto = { pose: found.pose, width: found.img.naturalWidth, height: found.img.naturalHeight, view };
        const { problems } = measurePhoto(ph, 175);
        photos[view] = ph;
        out.replaceChildren(preview(found.img, found.pose), ...(problems.length ? problems.map(t => h("p", { class: "error" }, t)) : [h("p", { class: "form-status ok" }, "Looks good.")]));
      } catch (e) { out.replaceChildren(h("p", { class: "error" }, errorText(e))); }
      recompute();
    });
    return { input, out };
  };
  const front = photoInput("front"), side = photoInput("side");
  heightInput.addEventListener("input", recompute);

  saveBtn.addEventListener("click", async () => {
    if (!pending) return;
    status.className = "form-status";
    try {
      await updateProfile({ body: pending, height_cm: pending.heightCm });
      showDims(pending.dims, [], `Saved from ${pending.photos.map(x => x.view).join(" + ")} photo, height ${pending.heightCm} cm.`);
      status.className = "form-status ok"; status.textContent = "Saved. Workouts now use your measurements.";
      saveBtn.disabled = true;
    } catch (e) { status.textContent = errorText(e); }
  });
  const delBtn = h("button", { class: "btn quiet small", onclick: async () => {
    try { await updateProfile({ body: null }); table.replaceChildren(); status.className = "form-status ok"; status.textContent = "Measurements deleted."; }
    catch (e) { status.className = "form-status"; status.textContent = errorText(e); }
  } }, "Delete measurements");

  return h("section", { class: "body-scan" },
    h("h2", {}, "Body measurements"),
    h("p", {}, "Two photos and your height tell the coach your real proportions. It then builds the ghost to your body and measures joint angles more accurately, also when you film from the front."),
    h("p", { class: "muted small" }, "The photos are analyzed on this phone and never uploaded or stored. Only the lengths below are saved to your profile."),
    h("ul", { class: "small" },
      h("li", {}, "Stand straight, whole body in the photo from head to feet, phone at hip height about 2–3 m away (ask someone, or use the timer)."),
      h("li", {}, "Fitted clothes, arms a little away from your body, feet hip-width apart."),
      h("li", {}, "Front photo: face the camera. Side photo (optional, measures your feet): turn sideways.")),
    h("label", { class: "field" }, "Front photo", front.input), front.out,
    h("label", { class: "field" }, "Side photo (optional)", side.input), side.out,
    table,
    h("div", { class: "actions" }, saveBtn, p.body ? delBtn : h("span")),
    status);
}
