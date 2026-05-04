// Leaderboard data layer.
//
// Architecture: a local in-memory cache of Score rows that the UI
// reads synchronously, plus async functions that load from Supabase
// on app boot and submit new scores. When Supabase isn't configured
// (placeholder URL/key in supabase-config.ts), we fall back to the
// MOCK_SCORES list so the app stays usable in dev.
//
// On boot, App._layout.tsx calls `loadLeaderboard()` once. Each
// Result screen calls `submitScore(...)` when a player taps SUBMIT.
// The cache is updated optimistically and the home screen re-renders
// via the subscriber pattern.

import { useEffect, useState } from 'react';
import { SUPABASE_NOT_CONFIGURED, supabase } from '../lib/supabase';
import { MOCK_SCORES, PLAYER_INITIALS } from './mock-scores';
import type { Score, Timeframe } from './leaderboard-types';

export type { Score, Timeframe } from './leaderboard-types';

// ----- In-memory cache --------------------------------------------------

let cache: Score[] = [];
let cacheLoaded = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((s) => s());
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Hook for components that want to re-render when the cache changes. */
export function useLeaderboardVersion(): number {
  const [, setVersion] = useState(0);
  useEffect(() => {
    return subscribe(() => setVersion((v) => v + 1));
  }, []);
  return cacheLoaded ? 1 : 0;
}

// ----- Loading from Supabase ------------------------------------------

/**
 * Pull the latest scores from Supabase into the local cache. Falls back
 * to MOCK_SCORES if Supabase isn't configured or the call fails.
 *
 * Called once at app boot from `app/_layout.tsx`.
 */
export async function loadLeaderboard(): Promise<void> {
  if (SUPABASE_NOT_CONFIGURED || !supabase) {
    cache = [...MOCK_SCORES];
    cacheLoaded = true;
    notify();
    return;
  }

  try {
    // Pull a generous slice — enough to compute ranks and show the
    // global table. 5000 rows is comfortable inside the free tier and
    // covers a healthy launch.
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error || !data) {
      // eslint-disable-next-line no-console
      console.warn('Leaderboard load failed, falling back to mock', error?.message);
      cache = [...MOCK_SCORES];
    } else {
      cache = data.map(rowToScore);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Leaderboard load threw, falling back to mock', e);
    cache = [...MOCK_SCORES];
  }

  cacheLoaded = true;
  notify();
}

// ----- Submitting a score --------------------------------------------

/**
 * Push a freshly-played score to the leaderboard. In Supabase mode
 * this inserts into the `scores` table and adds the new row to the
 * local cache. In mock mode it just adds to the cache.
 */
export async function submitScore(args: {
  gameId: string;
  initials: string;
  score: number;
  unit: string;
  level?: number;
  taps?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const initials = args.initials.toUpperCase().padEnd(3, 'A').slice(0, 3);

  if (SUPABASE_NOT_CONFIGURED || !supabase) {
    cache.unshift({
      id: `local-${Date.now()}`,
      gameId: args.gameId,
      initials,
      score: args.score,
      unit: args.unit,
      level: args.level,
      taps: args.taps,
      date: new Date().toISOString().slice(0, 10),
    });
    notify();
    return { ok: true };
  }

  try {
    const { data, error } = await supabase
      .from('scores')
      .insert({
        game_id: args.gameId,
        initials,
        score: args.score,
        unit: args.unit,
        level: args.level ?? null,
        taps: args.taps ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'unknown error' };
    }
    cache.unshift(rowToScore(data));
    notify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ----- Sync getters (UI reads from cache) -----------------------------

export function isLowerBetter(gameId: string): boolean {
  // reaction-light is now infinite-survival (rounds-survived = higher
  // better). spin-360 stays lower-better (degrees-off-from-360°).
  return gameId === 'spin-360';
}

export function getTopScores(
  gameId: string,
  timeframe: Timeframe = 'all',
  limit = 10,
): Score[] {
  const game = cache.filter((s) => s.gameId === gameId);
  const filtered = filterByTimeframe(game, timeframe);
  filtered.sort(scoreSorter(gameId));
  return filtered.slice(0, limit);
}

export function getAllTopScores(timeframe: Timeframe = 'all', limit = 25): Score[] {
  const filtered = filterByTimeframe(cache, timeframe);
  return filtered.slice(0, limit);
}

export function getAllScoresForGame(gameId: string): Score[] {
  return cache.filter((s) => s.gameId === gameId);
}

export function getPlayerBest(gameId: string): Score | null {
  const ours = cache.filter(
    (s) => s.gameId === gameId && s.initials === PLAYER_INITIALS,
  );
  if (!ours.length) return null;
  ours.sort(scoreSorter(gameId));
  return ours[0];
}

/**
 * Returns the player's leaderboard placement for a game: their best
 * entry plus its rank among everyone else's scores. Used by lobby
 * cards.
 */
export function getPlayerRank(
  gameId: string,
): { rank: number; total: number; best: Score } | null {
  const best = getPlayerBest(gameId);
  if (!best) return null;
  const all = getAllScoresForGame(gameId);
  const sorted = [...all].sort(scoreSorter(gameId));
  const rank = sorted.findIndex((s) => s.id === best.id) + 1;
  return { rank, total: sorted.length, best };
}

/**
 * Insert a hypothetical player score into the leaderboard for a game
 * and return the full ranked list along with where the player landed.
 * Used by the result screen to compute "you finished #X of Y".
 */
export function rankPlayerScore(args: {
  gameId: string;
  initials: string;
  score: number;
  unit: string;
  level?: number;
  taps?: number;
}): { ranked: Score[]; playerRank: number; playerEntry: Score; total: number } {
  const playerEntry: Score = {
    id: 'me',
    initials: args.initials,
    gameId: args.gameId,
    score: args.score,
    unit: args.unit,
    date: new Date().toISOString().slice(0, 10),
    level: args.level,
    taps: args.taps,
  };
  const all = [...getAllScoresForGame(args.gameId), playerEntry];
  all.sort(scoreSorter(args.gameId));
  const playerRank = all.findIndex((s) => s.id === 'me') + 1;
  return { ranked: all, playerRank, playerEntry, total: all.length };
}

// ----- Helpers --------------------------------------------------------

function scoreSorter(gameId: string) {
  const lower = isLowerBetter(gameId);
  return (a: Score, b: Score) => (lower ? a.score - b.score : b.score - a.score);
}

function filterByTimeframe(scores: Score[], timeframe: Timeframe): Score[] {
  if (timeframe === 'all') return [...scores];
  // Anchor "now" to today rather than the old hardcoded mock date once
  // we're live; mock fallback still works because dates in the mock are
  // in the same window.
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - (timeframe === 'today' ? 1 : 7));
  return scores.filter((s) => new Date(s.date) >= cutoff);
}

/** Map a Supabase `scores` row to our local Score type. */
function rowToScore(row: SupabaseScoreRow): Score {
  return {
    id: row.id,
    gameId: row.game_id,
    initials: row.initials,
    score: Number(row.score),
    unit: row.unit ?? 'PTS',
    date:
      typeof row.created_at === 'string'
        ? row.created_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    level: row.level ?? undefined,
    taps: row.taps ?? undefined,
    city: row.city ?? undefined,
  };
}

type SupabaseScoreRow = {
  id: string;
  game_id: string;
  initials: string;
  score: number | string;
  unit: string | null;
  level: number | null;
  taps: number | null;
  city: string | null;
  created_at: string;
};
