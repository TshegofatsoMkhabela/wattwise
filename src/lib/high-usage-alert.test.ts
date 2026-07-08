import { describe, expect, it } from "vitest";

import { evaluateHighUsageAlert } from "./high-usage-alert";

describe("evaluateHighUsageAlert", () => {
  it("waits until usage stays high for the sustained window", () => {
    const initial = { highUsageStartedAt: null, lastAgentAlertAt: -120000 };
    const first = evaluateHighUsageAlert(1700, 1000, initial);
    const second = evaluateHighUsageAlert(1700, 5999, first.state);
    const third = evaluateHighUsageAlert(1700, 6000, second.state);

    expect(first.shouldTrigger).toBe(false);
    expect(second.shouldTrigger).toBe(false);
    expect(third.shouldTrigger).toBe(true);
  });

  it("resets the sustained timer when usage drops below threshold", () => {
    const high = evaluateHighUsageAlert(1700, 1000, {
      highUsageStartedAt: null,
      lastAgentAlertAt: -120000,
    });
    const normal = evaluateHighUsageAlert(700, 3000, high.state);

    expect(normal.shouldTrigger).toBe(false);
    expect(normal.state.highUsageStartedAt).toBeNull();
  });

  it("uses the cooldown to avoid duplicate agent triggers", () => {
    const triggered = evaluateHighUsageAlert(1700, 6000, {
      highUsageStartedAt: 1000,
      lastAgentAlertAt: -120000,
    });
    const duplicate = evaluateHighUsageAlert(1700, 7000, triggered.state);

    expect(triggered.shouldTrigger).toBe(true);
    expect(duplicate.shouldTrigger).toBe(false);
  });
});
