type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

/**
 * Lightweight analytics/crash facade. Swap the body for Sentry/PostHog later
 * without changing call sites.
 */
export const analytics = {
  track(event: string, payload: AnalyticsPayload = {}) {
    if (__DEV__) {
      console.info(`[analytics] ${event}`, payload);
    }
  },
  captureException(error: unknown, context: AnalyticsPayload = {}) {
    if (__DEV__) {
      console.error('[crash]', error, context);
    }
  },
};
