// Lazy, cached loader for the MediaPipe FaceLandmarker. This is the ONLY module that
// imports @mediapipe/tasks-vision — it is dynamically imported so the ~MB model + WASM
// never touch the SSR bundle and only download when a face check is actually needed.
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";

// Pinned to the installed package version so the WASM matches the JS API.
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarkerType> | null = null;
let loadedDelegate: "GPU" | "CPU" | null = null;

/** Which compute delegate the loaded model is using (for diagnostics). */
export function getFaceDelegate(): "GPU" | "CPU" | null {
  return loadedDelegate;
}

/** True when the browser can create a WebGL2 context — MediaPipe needs it. */
export function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/** Thrown (as message) when WebGL2 is unavailable, so the UI can guide the user. */
export const WEBGL2_UNAVAILABLE = "WEBGL2_UNAVAILABLE";

/**
 * Returns a shared FaceLandmarker instance, creating it on first call. The promise is
 * cached so repeated calls (prewarm + gate mount) reuse one download. On failure the
 * cache is cleared so a later attempt can retry. Rejects when not running in a browser.
 */
export function loadFaceLandmarker(): Promise<FaceLandmarkerType> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Face detection is only available in the browser."));
  }

  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null; // allow a retry after a failed load
      throw err;
    });
  }
  return landmarkerPromise;
}

async function createLandmarker(): Promise<FaceLandmarkerType> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

  const filesetPromise = FilesetResolver.forVisionTasks(WASM_CDN);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout loading FaceLandmarker WASM from CDN")), 10000),
  );

  const fileset = await Promise.race([filesetPromise, timeoutPromise]);

  const build = (delegate: "GPU" | "CPU") =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

  // Prefer the GPU delegate; fall back to CPU on machines without it or where WebGL fails.
  try {
    if (!hasWebGL2()) throw new Error("WebGL2 not available");
    const lm = await build("GPU");
    loadedDelegate = "GPU";
    return lm;
  } catch (err) {
    console.warn("GPU delegate failed, falling back to CPU", err);
    const lm = await build("CPU");
    loadedDelegate = "CPU";
    return lm;
  }
}

/** Fire-and-forget prewarm — e.g. when the municipality role is selected on the login form. */
export function prewarmFaceLandmarker(): void {
  void loadFaceLandmarker().catch(() => {
    /* swallow — the gate surfaces load errors when the user actually starts the check */
  });
}
