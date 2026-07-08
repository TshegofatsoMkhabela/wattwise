export interface HighUsageAlertState {
  highUsageStartedAt: number | null;
  lastAgentAlertAt: number;
}

export interface HighUsageAlertOptions {
  thresholdWatts?: number;
  sustainedForMs?: number;
  cooldownMs?: number;
}

export function evaluateHighUsageAlert(
  watts: number,
  now: number,
  state: HighUsageAlertState,
  options: HighUsageAlertOptions = {},
): { shouldTrigger: boolean; state: HighUsageAlertState } {
  const thresholdWatts = options.thresholdWatts ?? 1500;
  const sustainedForMs = options.sustainedForMs ?? 5000;
  const cooldownMs = options.cooldownMs ?? 120000;

  if (watts < thresholdWatts) {
    return {
      shouldTrigger: false,
      state: { ...state, highUsageStartedAt: null },
    };
  }

  const highUsageStartedAt = state.highUsageStartedAt ?? now;
  const highLongEnough = now - highUsageStartedAt >= sustainedForMs;
  const cooldownOver = now - state.lastAgentAlertAt >= cooldownMs;

  if (!highLongEnough || !cooldownOver) {
    return {
      shouldTrigger: false,
      state: { ...state, highUsageStartedAt },
    };
  }

  return {
    shouldTrigger: true,
    state: {
      highUsageStartedAt,
      lastAgentAlertAt: now,
    },
  };
}
