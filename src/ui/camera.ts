// Opening the camera with as wide a view as it has, so the whole body fits without standing far away.
// - Ask for the sensor's own 3:4 shape (4:3 when the phone lies sideways): 16:9 video modes are usually
//   cropped from the sensor, which narrows the view.
// - resizeMode "none": take a format the camera produces natively instead of a cropped/scaled one.
// - Zoom out as far as the camera allows (some phones start front cameras zoomed in).
// - Any camera can be picked by name, e.g. "Back Ultra Wide Camera" on iPhones.

export interface OpenedCamera {
  stream: MediaStream;
  /** Mirror the picture (front cameras, so moving left looks like moving left). */
  mirror: boolean;
  /** What the camera actually gave: size, zoom, name (shown on screen to help find the best setup). */
  info: string;
}

/** `choice`: "user" (front), "environment" (back), or "device:<deviceId>" for one specific camera. */
export async function openCamera(choice: string): Promise<OpenedCamera> {
  const portrait = window.innerHeight > window.innerWidth;
  const [w, h] = portrait ? [960, 1280] : [1280, 960];
  const shape = { width: { ideal: w }, height: { ideal: h }, aspectRatio: { ideal: w / h }, frameRate: { ideal: 30 }, resizeMode: { ideal: "none" } };
  const video = choice.startsWith("device:") ? { ...shape, deviceId: { exact: choice.slice(7) } } : { ...shape, facingMode: choice };
  const stream = await navigator.mediaDevices.getUserMedia({ video: video as MediaTrackConstraints, audio: false });
  const track = stream.getVideoTracks()[0];
  try {
    const zoom = (track.getCapabilities?.() as { zoom?: { min: number } } | undefined)?.zoom;
    const now = (track.getSettings() as { zoom?: number }).zoom ?? 1;
    if (zoom && zoom.min < now) await track.applyConstraints({ advanced: [{ zoom: zoom.min } as MediaTrackConstraintSet] });
  } catch { /* zoom not supported */ }
  const st = track.getSettings() as MediaTrackSettings & { zoom?: number };
  const mirror = st.facingMode ? st.facingMode === "user" : choice === "user" || /front|user|face/i.test(track.label);
  const info = `camera ${st.width ?? "?"}×${st.height ?? "?"}${st.zoom ? ` · zoom ${st.zoom}` : ""}${track.label ? ` · ${track.label}` : ""}`;
  return { stream, mirror, info };
}

/** Adds every camera on the device to the picker (names are only known after camera permission was given). */
export async function listCameras(select: HTMLSelectElement, current: string) {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput" && d.label);
    for (const o of [...select.options]) if (o.value.startsWith("device:")) o.remove();
    for (const c of cams) {
      const o = document.createElement("option");
      o.value = `device:${c.deviceId}`; o.textContent = c.label;
      select.append(o);
    }
    select.value = current;
    if (select.value !== current) select.value = "user";
  } catch { /* not available */ }
}

/** Keeps the drawing canvas the size of the video (it can change when the phone turns). Returns true if it changed. */
export function syncCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  if (!video.videoWidth || (canvas.width === video.videoWidth && canvas.height === video.videoHeight)) return false;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  return true;
}
