// Sentry crash + error reporting configuration.
//
// v1.0 ships WITHOUT Sentry. The @sentry/react-native@6.x SDK uses
// older Hermes profiler APIs (enableSamplingProfiler / etc.) that
// were renamed in RN 0.74+, which breaks iOS builds against RN 0.81's
// engine. Until @sentry/react-native@7.x is wired (planned for v1.1),
// `sentry.ts` lazy-requires the package and falls back to no-ops if
// it's missing.
//
// To wire up in v1.1:
//   1. Create a free account at https://sentry.io (free tier covers
//      5,000 errors/month — plenty for indie launch).
//   2. Create a new project: Platform = "React Native", give it any
//      name (e.g. "ourcade-ios").
//   3. Sentry shows you a DSN that looks like:
//        https://abc123def456@o7654321.ingest.us.sentry.io/1234567
//      Paste it into SENTRY_DSN below.
//   4. Reinstall the SDK at a Hermes-compatible version:
//        npm install @sentry/react-native@^7
//        npx expo prebuild --clean
//        eas build --platform ios

export const SENTRY_DSN = '';

// Optional — environment tag applied to every event. Useful for
// distinguishing TestFlight builds from App Store builds in the
// Sentry dashboard. Override via app.json's `extra` block if you want
// per-build configuration.
export const SENTRY_ENV = __DEV__ ? 'development' : 'production';

// Sample rate for performance traces (0.0 = none, 1.0 = all). Errors
// are always 100% sampled regardless of this. Lower values save quota
// on the free tier. 0.2 means we trace 20% of sessions for perf.
export const SENTRY_TRACES_SAMPLE_RATE = 0.2;
