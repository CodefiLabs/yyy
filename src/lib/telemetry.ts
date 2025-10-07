import posthog from "posthog-js";

// Detect distribution build mode
const IS_DISTRIBUTION_BUILD = process.env.DYAD_DISTRIBUTION_BUILD === "true";

/**
 * Wrapper for PostHog capture that respects distribution mode
 * In distribution mode, all telemetry is disabled
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (IS_DISTRIBUTION_BUILD) {
    return;
  }
  posthog.capture(eventName, properties);
}

/**
 * Wrapper for PostHog captureException that respects distribution mode
 * In distribution mode, all telemetry is disabled
 */
export function captureException(error: Error): void {
  if (IS_DISTRIBUTION_BUILD) {
    return;
  }
  posthog.captureException(error);
}

/**
 * Check if telemetry is enabled (not in distribution mode)
 */
export function isTelemetryEnabled(): boolean {
  return !IS_DISTRIBUTION_BUILD;
}
