// Supabase client singleton.
//
// Anonymous, no auth — the leaderboard is a public read/insert-only
// table. RLS on the server side restricts which rows can be inserted
// (see SUPABASE_SETUP.md). No session management needed.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_NOT_CONFIGURED,
  SUPABASE_URL,
} from './supabase-config';

// Build a stub when credentials aren't configured so import sites can
// still resolve. Code paths that actually call into the client check
// SUPABASE_NOT_CONFIGURED first.
export const supabase = SUPABASE_NOT_CONFIGURED
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Anonymous use — don't try to manage user sessions.
        persistSession: false,
        autoRefreshToken: false,
        storage: AsyncStorage as never,
      },
      // RN already has fetch; nothing to override.
    });

export { SUPABASE_NOT_CONFIGURED };
