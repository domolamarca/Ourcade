// Sentry wrapper — provides crash + error reporting with a graceful
// no-op fallback when the SDK isn't installed or the DSN is empty.
//
// We use `require()` instead of a static import so the build doesn't
// break before `npm install @sentry/react-native` runs. This mirrors
// the conditional-init pattern Sentry recommends for staged rollouts.

import { SENTRY_DSN, SENTRY_ENV, SENTRY_TRACES_SAMPLE_RATE } from './sentry-config';

type SentryModule = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, ctx?: unknown) => void;
  setTag: (key: string, value: string) => void;
  setUser: (user: { id?: string; username?: string } | null) => void;
  withScope?: (cb: (scope: { setTag: (k: string, v: string) => void }) => void) => void;
};

let sentry: SentryModule | null = null;
let initialized = false;

/** Lazy load the SDK so missing-module doesn't crash the bundler. */
function loadSdk(): SentryModule | null {
  if (sentry) return sentry;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@sentry/react-native');
    sentry = mod as SentryModule;
    return sentry;
  } catch {
    return null;
  }
}

/**
 * Initialize Sentry. Call once at app boot (root layout). Silent no-op
 * if either the SDK isn't installed or the DSN is empty.
 */
export function initSentry(): void {
  if (initialized) return;
  if (!SENTRY_DSN) return;
  const sdk = loadSdk();
  if (!sdk) return;
  try {
    sdk.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENV,
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
      // Auto-capture console.error in addition to thrown errors. Cheap
      // signal for "something went wrong even if nothing crashed."
      enableAutoSessionTracking: true,
      // Skip dev errors — they're already loud in Metro and would
      // burn through the free-tier quota before launch.
      enabled: !__DEV__,
    });
    initialized = true;
  } catch {
    /* swallow — Sentry init failures shouldn't crash the app */
  }
}

/** Tag the current Sentry scope with a cabinet name. Call this when
 *  the player enters a play screen so any subsequent crash is
 *  attributed to the cabinet that was running. */
export function setCabinetTag(cabinetId: string): void {
  if (!initialized) return;
  const sdk = loadSdk();
  if (!sdk) return;
  try {
    sdk.setTag('cabinet', cabinetId);
  } catch {
    /* swallow */
  }
}

/** Tag the player's anonymous identity (3-letter initials + first-seen
 *  timestamp). Use for grouping crash reports by player without sending
 *  any actual PII. */
export function setSentryUser(initials: string): void {
  if (!initialized) return;
  const sdk = loadSdk();
  if (!sdk) return;
  try {
    sdk.setUser({ username: initials });
  } catch {
    /* swallow */
  }
}

/** Manually report an error that you caught + handled. Useful for
 *  expected-but-noteworthy failures like "Supabase score submission
 *  retried 3x and still failed." */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  const sdk = loadSdk();
  if (!sdk) return;
  try {
    if (context && sdk.withScope) {
      sdk.withScope((scope) => {
        for (const [k, v] of Object.entries(context)) {
          scope.setTag(k, String(v));
        }
        sdk.captureException(err);
      });
    } else {
      sdk.captureException(err);
    }
  } catch {
    /* swallow */
  }
}
