import { describe, expect, it } from "vitest";
import { CENTER_HOLD_MS, gestureProgress, isCentered, type Landmark } from "./face-liveness";

function landmarks(nose: Landmark): Landmark[] {
  const points = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5 }));
  points[1] = nose;
  points[33] = { x: 0.3, y: 0.42 };
  points[263] = { x: 0.7, y: 0.42 };
  return points;
}

describe("face-liveness", () => {
  it("accepts a forgiving centered face for demo login", () => {
    expect(isCentered({ yaw: 0.38, offset: 0.28 })).toBe(true);
  });

  it("completes the center step with a short hold", () => {
    expect(gestureProgress("center", { yaw: 0.1, offset: 0.1, holdMs: CENTER_HOLD_MS })).toBe(1);
  });

  it("accepts smaller head turns for left and right gestures", () => {
    const leftTurn = gestureProgress("left", { yaw: 0.34, offset: 0.1, holdMs: 0 });
    const rightTurn = gestureProgress("right", { yaw: -0.34, offset: 0.1, holdMs: 0 }, 1);

    expect(leftTurn).toBe(1);
    expect(rightTurn).toBe(1);
  });

  it("keeps landmark yaw calculation stable for a near-center face", async () => {
    const { estimateYaw, faceCenterOffset } = await import("./face-liveness");
    const sample = landmarks({ x: 0.54, y: 0.56 });

    expect(estimateYaw(sample)).toBeCloseTo(0.2);
    expect(faceCenterOffset(sample)).toBeLessThan(0.1);
  });
});
