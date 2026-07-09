// Pure liveness logic for the municipality face-login gesture.
// Deliberately free of any MediaPipe / DOM imports so the head-pose maths and the
// per-gesture progress are cheap to reason about and unit-test in isolation.
//
// NOTE: this is a *demo liveness gesture*, not biometric authentication — it verifies
// that a face centred and turned as asked, not *who* the person is.
// See research/face-login-liveness.md.

/** Minimal shape of a normalised face landmark (x/y in [0,1], origin top-left). */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

// MediaPipe FaceMesh landmark indices we sample for a cheap, lighting-robust head pose.
export const NOSE_TIP = 1;
export const EYE_OUTER_A = 33; // one eye's outer corner
export const EYE_OUTER_B = 263; // the other eye's outer corner

/**
 * Estimates head yaw as a signed ratio in eye-half-span units: ~0 when facing the
 * camera, growing negative/positive as the head turns to one side (the nose drifts
 * toward one eye in image space). Returns null when the needed landmarks are missing.
 * Sign is intentionally not tied to physical left/right — the gestures only require
 * "a strong turn one way, then the other", which is robust to the mirrored selfie view.
 */
export function estimateYaw(landmarks: readonly Landmark[]): number | null {
  const nose = landmarks[NOSE_TIP];
  const a = landmarks[EYE_OUTER_A];
  const b = landmarks[EYE_OUTER_B];
  if (!nose || !a || !b) return null;

  const mid = (a.x + b.x) / 2;
  const halfSpan = Math.abs(b.x - a.x) / 2;
  if (halfSpan < 1e-6) return null;

  return (nose.x - mid) / halfSpan;
}

/** How far the face (nose) sits from the frame centre; 0 = dead centre, ~0.7 = corner. */
export function faceCenterOffset(landmarks: readonly Landmark[]): number | null {
  const nose = landmarks[NOSE_TIP];
  if (!nose) return null;
  return Math.hypot(nose.x - 0.5, nose.y - 0.5);
}

export type Gesture = "center" | "left" | "right";
export const GESTURES: readonly Gesture[] = ["center", "left", "right"];

export const CENTER_YAW_MAX = 0.3; // must be roughly forward-facing to count as centred
export const CENTER_OFFSET_MAX = 0.2; // must be near the middle of the frame
export const TURN_MIN = 0.5; // yaw magnitude that counts as a completed turn
export const CENTER_HOLD_MS = 900; // hold centred this long to pass the first step

export const GESTURE_LABEL: Record<Gesture | "done", string> = {
  center: "Center your face and hold still",
  left: "Slowly turn your head left",
  right: "Now turn your head right",
  done: "Face verified",
};

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Whether the centre step's position + orientation condition is currently met. */
export function isCentered(reading: { yaw: number; offset: number }): boolean {
  return Math.abs(reading.yaw) <= CENTER_YAW_MAX && reading.offset <= CENTER_OFFSET_MAX;
}

export interface Reading {
  yaw: number;
  offset: number;
  /** Milliseconds the face has been continuously centred (only used by the centre step). */
  holdMs: number;
}

/**
 * Completion fraction (0..1) of a single gesture for the given reading. Pure and
 * frame-independent — the caller supplies accumulated holdMs and the first-turn sign.
 * The centre step fills by hold time; the turn steps fill by how far the head has turned.
 */
export function gestureProgress(
  gesture: Gesture,
  reading: Reading,
  firstTurnSign: -1 | 0 | 1 = 0,
): number {
  switch (gesture) {
    case "center":
      return isCentered(reading) ? clamp01(reading.holdMs / CENTER_HOLD_MS) : 0;
    case "left":
      return clamp01(Math.abs(reading.yaw) / TURN_MIN);
    case "right": {
      const opposite = firstTurnSign !== 0 && Math.sign(reading.yaw) === -firstTurnSign;
      return opposite ? clamp01(Math.abs(reading.yaw) / TURN_MIN) : 0;
    }
  }
}
