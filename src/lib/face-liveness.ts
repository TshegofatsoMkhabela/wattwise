// Pure liveness logic for the municipality face-login "turn your head" challenge.
// Deliberately free of any MediaPipe / DOM imports so the head-pose maths and the
// step state machine are cheap to reason about and unit-test in isolation.
//
// NOTE: this is a *demo liveness gesture*, not biometric authentication — it verifies
// that a face turned as asked, not *who* the person is. See research/face-login-liveness.md.

/** Minimal shape of a normalised face landmark (x/y in [0,1], origin top-left). */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

// MediaPipe FaceMesh landmark indices we sample for a cheap, lighting-robust yaw proxy.
export const NOSE_TIP = 1;
export const EYE_OUTER_A = 33; // one eye's outer corner
export const EYE_OUTER_B = 263; // the other eye's outer corner

/**
 * Estimates head yaw as a signed ratio in eye-half-span units: ~0 when facing the
 * camera, growing negative/positive as the head turns to one side (the nose drifts
 * toward one eye in image space). Returns null when the needed landmarks are missing.
 * Sign is intentionally not tied to physical left/right — the step machine only cares
 * about "a strong turn one way, then the other", which makes it robust to the mirrored
 * selfie view and camera differences.
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

export type FaceStep = "centering" | "center" | "turn1" | "turn2" | "done";

/** Below this magnitude the face counts as looking forward. */
export const YAW_CENTER_MAX = 0.35;
/** At/above this magnitude a deliberate turn is registered (forgiving, for demo reliability). */
export const YAW_TURN_MIN = 0.55;

export interface LivenessState {
  step: FaceStep;
  /** Sign of the first turn, so the second step can require the opposite direction. */
  firstTurnSign: -1 | 0 | 1;
  centerHeldMs: number;
}

export interface LivenessOptions {
  centerMax?: number;
  turnMin?: number;
}

export const CENTER_HOLD_MS = 600;

export function initLiveness(): LivenessState {
  return { step: "centering", firstTurnSign: 0, centerHeldMs: 0 };
}

/**
 * Pure transition: given the current state and a yaw reading, returns the next state.
 * Only ever moves forward (center → turn1 → turn2 → done); readings that don't satisfy
 * the current step return the state unchanged.
 */
export function advanceLiveness(
  state: LivenessState,
  yaw: number,
  dtMs: number,
  options: LivenessOptions = {},
): LivenessState {
  const centerMax = options.centerMax ?? YAW_CENTER_MAX;
  const turnMin = options.turnMin ?? YAW_TURN_MIN;
  const magnitude = Math.abs(yaw);
  const sign: -1 | 1 = yaw < 0 ? -1 : 1;

  switch (state.step) {
    case "centering":
      if (magnitude <= centerMax) {
        const nextMs = state.centerHeldMs + dtMs;
        if (nextMs >= CENTER_HOLD_MS) {
          return { ...state, step: "center", centerHeldMs: nextMs };
        }
        return { ...state, centerHeldMs: nextMs };
      }
      return { ...state, centerHeldMs: 0 };
    case "center":
      return magnitude <= centerMax ? { ...state, step: "turn1" } : state;
    case "turn1":
      return magnitude >= turnMin ? { ...state, step: "turn2", firstTurnSign: sign } : state;
    case "turn2":
      return state.firstTurnSign !== 0 && sign === -state.firstTurnSign && magnitude >= turnMin
        ? { ...state, step: "done" }
        : state;
    default:
      return state;
  }
}

export function stepProgress(step: FaceStep): number {
  switch (step) {
    case "centering":
      return 0;
    case "center":
      return 0.15;
    case "turn1":
      return 0.33;
    case "turn2":
      return 0.67;
    case "done":
      return 1;
  }
}

/**
 * Responsive progress for the ring: the step's base fraction plus a live partial for
 * how far through the current turn the user is, so the ring visibly grows as they move.
 * During turn2 only a correctly-directed turn contributes, to avoid a "full but stuck" ring.
 */
export function liveProgress(
  state: LivenessState,
  yaw: number,
  options: LivenessOptions = {},
): number {
  const turnMin = options.turnMin ?? YAW_TURN_MIN;
  const base = stepProgress(state.step);

  if (state.step === "centering") {
    return Math.min(0.15 * (state.centerHeldMs / CENTER_HOLD_MS), 0.15);
  }
  if (state.step === "center") {
    return 0.15; // Jumps from 0.15 to 0.33 in one frame if center confirmed
  }
  if (state.step === "turn1") {
    return Math.min(base + Math.min(Math.abs(yaw) / turnMin, 1) * 0.34, 0.67);
  }
  if (state.step === "turn2") {
    const correctDirection = state.firstTurnSign !== 0 && Math.sign(yaw) === -state.firstTurnSign;
    const intra = correctDirection ? Math.min(Math.abs(yaw) / turnMin, 1) * 0.33 : 0;
    return Math.min(base + intra, 1);
  }
  return base;
}

export const FACE_STEP_LABEL: Record<FaceStep, string> = {
  centering: "Center your face in the circle",
  center: "Look straight at the screen",
  turn1: "Slowly turn your head left",
  turn2: "Now turn your head right",
  done: "Face verified",
};
