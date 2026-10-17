// Opening the camera so the whole body fits: on a phone held upright, ask for an upright (portrait) video.
// A landscape video on an upright phone shows a narrow strip, so people have to stand far away and
// end up small in the picture, which makes tracking less precise.

export async function openCamera(facing: string): Promise<MediaStream> {
  const portrait = window.innerHeight > window.innerWidth;
  const [w, h] = portrait ? [720, 1280] : [1280, 720];
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: w }, height: { ideal: h }, aspectRatio: { ideal: w / h }, frameRate: { ideal: 30 } },
    audio: false
  });
}

/** Keeps the drawing canvas the size of the video (it can change when the phone turns). Returns true if it changed. */
export function syncCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  if (!video.videoWidth || (canvas.width === video.videoWidth && canvas.height === video.videoHeight)) return false;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  return true;
}
