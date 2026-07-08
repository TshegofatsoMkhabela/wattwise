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

export type FaceStep = "center" | "turn1" | "turn2" | "done";

/** Below this magnitude the face counts as looking forward. */
export const YAW_CENTER_MAX = 0.35;
/** At/above this magnitude a deliberate turn is registered (forgiving, for demo reliability). */
export const YAW_TURN_MIN = 0.55;

export interface LivenessState {
  step: FaceStep;
  /** Sign of the first turn, so the second step can require the opposite direction. */
  firstTurnSign: -1 | 0 | 1;
}

export interface LivenessOptions {
  centerMax?: number;
  turnMin?: number;
}

export function initLiveness(): LivenessState {
  return { step: "center", firstTurnSign: 0 };
}

/**
 * Pure transition: given the current state and a yaw reading, returns the next state.
 * Only ever moves forward (center → turn1 → turn2 → done); readings that don't satisfy
 * the current step return the state unchanged.
 */
export function advanceLiveness(
  state: LivenessState,
  yaw: number,
  options: LivenessOptions = {},
): LivenessState {
  const centerMax = options.centerMax ?? YAW_CENTER_MAX;
  const turnMin = options.turnMin ?? YAW_TURN_MIN;
  const magnitude = Math.abs(yaw);
  const sign: -1 | 1 = yaw < 0 ? -1 : 1;

  switch (state.step) {
    case "center":
      return magnitude <= centerMax ? { ...state, step: "turn1" } : state;
    case "turn1":
      return magnitude >= turnMin ? { step: "turn2", firstTurnSign: sign } : state;
    case "turn2":
      return state.firstTurnSign !== 0 && sign === -state.firstTurnSign && magnitude >= turnMin
        ? { ...state, step: "done" }
        : state;
    default:
      return state;
  }
}

/** Fraction of the challenge completed at the *start* of a step (0, ⅓, ⅔, 1). */
export function stepProgress(step: FaceStep): number {
  switch (step) {
    case "center":
      return 0;
    case "turn1":
      return 1 / 3;
    case "turn2":
      return 2 / 3;
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

  if (state.step === "turn1") {
    return Math.min(base + Math.min(Math.abs(yaw) / turnMin, 1) / 3, 1);
  }
  if (state.step === "turn2") {
    const correctDirection = state.firstTurnSign !== 0 && Math.sign(yaw) === -state.firstTurnSign;
    const intra = correctDirection ? Math.min(Math.abs(yaw) / turnMin, 1) / 3 : 0;
    return Math.min(base + intra, 1);
  }
  return base;
}

/** Human-facing instruction for each step. */
export const FACE_STEP_LABEL: Record<FaceStep, string> = {
  center: "Look straight at the screen",
  turn1: "Slowly turn your head left",
  turn2: "Now turn your head right",
  done: "Face verified",
};
