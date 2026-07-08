import { describe, it, expect } from "vitest";
import {
  initLiveness,
  advanceLiveness,
  liveProgress,
  CENTER_HOLD_MS,
  YAW_CENTER_MAX,
  YAW_TURN_MIN,
  type LivenessState,
} from "./face-liveness";

describe("face-liveness state machine", () => {
  it("initializes to centering step", () => {
    const state = initLiveness();
    expect(state.step).toBe("centering");
    expect(state.centerHeldMs).toBe(0);
  });

  it("accumulates centerHeldMs while face is centered", () => {
    let state = initLiveness();

    // Accumulate dtMs
    state = advanceLiveness(state, 0.1, 200);
    expect(state.step).toBe("centering");
    expect(state.centerHeldMs).toBe(200);

    // Keep accumulating
    state = advanceLiveness(state, -0.2, 300);
    expect(state.step).toBe("centering");
    expect(state.centerHeldMs).toBe(500);

    // Reach the threshold
    state = advanceLiveness(state, 0.1, 100);
    expect(state.step).toBe("center");
  });

  it("resets centerHeldMs if face turns too far during centering", () => {
    let state = initLiveness();
    state = advanceLiveness(state, 0.1, 200);
    expect(state.centerHeldMs).toBe(200);

    // Turn too far!
    state = advanceLiveness(state, YAW_CENTER_MAX + 0.1, 100);
    expect(state.step).toBe("centering");
    expect(state.centerHeldMs).toBe(0); // Reset
  });

  it("transitions smoothly from center to turn1 to turn2 to done", () => {
    let state = initLiveness();
    state = advanceLiveness(state, 0, CENTER_HOLD_MS);
    expect(state.step).toBe("center");

    state = advanceLiveness(state, 0, 16);
    expect(state.step).toBe("turn1");

    // Turn left (negative yaw)
    state = advanceLiveness(state, -YAW_TURN_MIN, 16);
    expect(state.step).toBe("turn2");
    expect(state.firstTurnSign).toBe(-1);

    // Look back center (should stay in turn2)
    state = advanceLiveness(state, 0, 16);
    expect(state.step).toBe("turn2");

    // Turn right (positive yaw)
    state = advanceLiveness(state, YAW_TURN_MIN, 16);
    expect(state.step).toBe("done");
  });
});

describe("liveProgress", () => {
  it("computes continuous progress correctly", () => {
    let state = initLiveness();

    // Centering (0 -> 0.15)
    expect(liveProgress(state, 0)).toBe(0);
    state = advanceLiveness(state, 0, CENTER_HOLD_MS / 2);
    expect(liveProgress(state, 0)).toBeCloseTo(0.075);

    state = advanceLiveness(state, 0, CENTER_HOLD_MS / 2);
    expect(state.step).toBe("center");
    // Center to turn1 start (0.15 -> 0.33)
    expect(liveProgress(state, 0)).toBeCloseTo(0.15);

    state = advanceLiveness(state, 0, 16);
    expect(state.step).toBe("turn1");
    // Turn 1 (0.33 -> 0.67). At start of turn1, progress is 0.33.
    expect(liveProgress(state, 0)).toBeCloseTo(0.33);

    // Midway through turn1
    expect(liveProgress(state, -(YAW_TURN_MIN / 2))).toBeCloseTo(0.33 + 0.34 / 2);

    state = advanceLiveness(state, -YAW_TURN_MIN, 16);
    expect(state.step).toBe("turn2");
    // At start of turn2, progress is 0.67
    expect(liveProgress(state, 0)).toBeCloseTo(0.67);

    // Wrong direction turn should not advance progress past 0.67
    expect(liveProgress(state, -YAW_TURN_MIN)).toBeCloseTo(0.67);

    // Correct direction turn midway
    expect(liveProgress(state, YAW_TURN_MIN / 2)).toBeCloseTo(0.67 + 0.33 / 2);

    state = advanceLiveness(state, YAW_TURN_MIN, 16);
    expect(state.step).toBe("done");
    expect(liveProgress(state, YAW_TURN_MIN)).toBe(1);
  });
});
