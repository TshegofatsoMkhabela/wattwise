export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[WattWise error boundary]", context, error);
}
