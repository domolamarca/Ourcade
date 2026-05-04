// Supabase project credentials.
//
// These are PUBLIC by design — the anon key is meant to ship in client
// apps. Security is enforced via Row-Level Security policies on the
// `scores` table (see SUPABASE_SETUP.md).
//
// To configure:
//   1. Create a project at https://supabase.com (free tier).
//   2. From the project dashboard: Settings → API. Copy the URL and the
//      `anon` key.
//   3. Paste them in below, replacing the placeholders.
//   4. Run the SQL in SUPABASE_SETUP.md to create the table + indexes.
//
// Until placeholders are replaced, the leaderboard module falls back
// to local mock data so the app keeps working in development.

export const SUPABASE_URL = 'https://ooowijbucnhaqrhygxqe.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_qtiW8fn2EhwiHBCtIF_jiw_RFqJokMv';

/** True when both values are still placeholders — leaderboard runs in mock mode. */
export const SUPABASE_NOT_CONFIGURED =
  SUPABASE_URL.includes('YOUR_PROJECT') ||
  SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
