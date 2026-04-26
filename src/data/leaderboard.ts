// Mock leaderboard data so the UI has something to render before we wire
// up Supabase. Replace these getter functions with real queries later —
// keep the shape the same and the screens won't need to change.

export type Score = {
  id: string;
  initials: string;
  gameId: string;
  score: number;
  unit: string;
  date: string; // ISO date
  city?: string; // populated for location-based games
  // Minesweep-style compound detail: level reached + total taps used.
  // Other games can ignore these.
  level?: number;
  taps?: number;
};

export type Timeframe = 'today' | 'week' | 'all';

const MOCK_SCORES: Score[] = [
  // Tap Bullseye — continuous-spawn survival mode.
  // Score = sum of per-target scores until you let one expire.
  // Elite players push 150–200k. Casual sessions land 30–60k.
  { id: '1', initials: 'KAT', gameId: 'tap-bullseye', score: 187420, unit: 'PTS', date: '2026-04-25' },
  { id: '2', initials: 'NOX', gameId: 'tap-bullseye', score: 152890, unit: 'PTS', date: '2026-04-24' },
  { id: '3', initials: 'ZIP', gameId: 'tap-bullseye', score: 124650, unit: 'PTS', date: '2026-04-26' },
  { id: '4', initials: 'DOM', gameId: 'tap-bullseye', score: 98170, unit: 'PTS', date: '2026-04-26' },
  { id: '5', initials: 'BLZ', gameId: 'tap-bullseye', score: 76540, unit: 'PTS', date: '2026-04-25' },
  { id: '6', initials: 'KAT', gameId: 'tap-bullseye', score: 71200, unit: 'PTS', date: '2026-04-23' },
  { id: '7', initials: 'NOX', gameId: 'tap-bullseye', score: 64300, unit: 'PTS', date: '2026-04-22' },
  { id: '8', initials: 'ZEN', gameId: 'tap-bullseye', score: 54200, unit: 'PTS', date: '2026-04-26' },
  { id: '9', initials: 'AAA', gameId: 'tap-bullseye', score: 47830, unit: 'PTS', date: '2026-04-21' },
  { id: '10', initials: 'BOT', gameId: 'tap-bullseye', score: 41900, unit: 'PTS', date: '2026-04-25' },
  { id: '11', initials: 'STN', gameId: 'tap-bullseye', score: 38440, unit: 'PTS', date: '2026-04-20' },
  { id: '12', initials: 'HRO', gameId: 'tap-bullseye', score: 34100, unit: 'PTS', date: '2026-04-24' },
  { id: '13', initials: 'WAS', gameId: 'tap-bullseye', score: 28750, unit: 'PTS', date: '2026-04-26' },
  { id: '14', initials: 'TUR', gameId: 'tap-bullseye', score: 22400, unit: 'PTS', date: '2026-04-22' },
  { id: '15', initials: 'NIM', gameId: 'tap-bullseye', score: 18920, unit: 'PTS', date: '2026-04-19' },
  { id: '16', initials: 'AGE', gameId: 'tap-bullseye', score: 15300, unit: 'PTS', date: '2026-04-26' },
  { id: '17', initials: 'GMR', gameId: 'tap-bullseye', score: 12180, unit: 'PTS', date: '2026-04-23' },
  { id: '18', initials: 'NUB', gameId: 'tap-bullseye', score: 9750, unit: 'PTS', date: '2026-04-26' },

  // Minesweep — composite score: level * 10000 - taps.
  // Higher is better; ties broken by tap count (encoded into the score).
  // Local-wipe + tight 40px blast: 1–2 dots per kill on average, so taps
  // pile up fast at higher levels.
  { id: '50', initials: 'KAT', gameId: 'minesweep', score: 80000 - 1247, unit: 'LV', level: 8, taps: 1247, date: '2026-04-26' },
  { id: '51', initials: 'NOX', gameId: 'minesweep', score: 70000 - 968,  unit: 'LV', level: 7, taps: 968,  date: '2026-04-25' },
  { id: '52', initials: 'ZIP', gameId: 'minesweep', score: 60000 - 781,  unit: 'LV', level: 6, taps: 781,  date: '2026-04-24' },
  { id: '53', initials: 'DOM', gameId: 'minesweep', score: 50000 - 542,  unit: 'LV', level: 5, taps: 542,  date: '2026-04-26' },
  { id: '54', initials: 'BLZ', gameId: 'minesweep', score: 50000 - 651,  unit: 'LV', level: 5, taps: 651,  date: '2026-04-23' },
  { id: '55', initials: 'ZEN', gameId: 'minesweep', score: 40000 - 387,  unit: 'LV', level: 4, taps: 387,  date: '2026-04-22' },
  { id: '56', initials: 'STN', gameId: 'minesweep', score: 40000 - 451,  unit: 'LV', level: 4, taps: 451,  date: '2026-04-21' },
  { id: '57', initials: 'AAA', gameId: 'minesweep', score: 30000 - 234,  unit: 'LV', level: 3, taps: 234,  date: '2026-04-26' },
  { id: '58', initials: 'BOT', gameId: 'minesweep', score: 30000 - 298,  unit: 'LV', level: 3, taps: 298,  date: '2026-04-20' },
  { id: '59', initials: 'TUR', gameId: 'minesweep', score: 20000 - 124,  unit: 'LV', level: 2, taps: 124,  date: '2026-04-26' },
  { id: '60', initials: 'NUB', gameId: 'minesweep', score: 20000 - 167,  unit: 'LV', level: 2, taps: 167,  date: '2026-04-25' },
  { id: '61', initials: 'AGE', gameId: 'minesweep', score: 10000 - 38,   unit: 'LV', level: 1, taps: 38,   date: '2026-04-19' },

  // GHOST — mission 1 only for now. Score = baseScore - timeMs/100 + unspent_budget*500.
  { id: '70', initials: 'KAT', gameId: 'ghost', score: 18420, unit: 'PTS', date: '2026-04-26' },
  { id: '71', initials: 'NOX', gameId: 'ghost', score: 16980, unit: 'PTS', date: '2026-04-25' },
  { id: '72', initials: 'ZEN', gameId: 'ghost', score: 14210, unit: 'PTS', date: '2026-04-24' },
  { id: '73', initials: 'DOM', gameId: 'ghost', score: 12450, unit: 'PTS', date: '2026-04-26' },
  { id: '74', initials: 'BLZ', gameId: 'ghost', score: 11020, unit: 'PTS', date: '2026-04-23' },
  { id: '75', initials: 'STN', gameId: 'ghost', score: 9530,  unit: 'PTS', date: '2026-04-22' },
  { id: '76', initials: 'AAA', gameId: 'ghost', score: 7820,  unit: 'PTS', date: '2026-04-21' },

  // Reaction Light — lower is better
  { id: '101', initials: 'ZIP', gameId: 'reaction-light', score: 142, unit: 'MS', date: '2026-04-26' },
  { id: '102', initials: 'BLZ', gameId: 'reaction-light', score: 156, unit: 'MS', date: '2026-04-25' },
  { id: '103', initials: 'KAT', gameId: 'reaction-light', score: 167, unit: 'MS', date: '2026-04-25' },
  { id: '104', initials: 'DOM', gameId: 'reaction-light', score: 184, unit: 'MS', date: '2026-04-26' },

  // Dead Still
  { id: '201', initials: 'ZEN', gameId: 'dead-still', score: 9421, unit: 'PTS', date: '2026-04-26' },
  { id: '202', initials: 'STN', gameId: 'dead-still', score: 8804, unit: 'PTS', date: '2026-04-23' },
  { id: '203', initials: 'DOM', gameId: 'dead-still', score: 7250, unit: 'PTS', date: '2026-04-26' },

  // 360 Spin — lower is better
  { id: '301', initials: 'TRN', gameId: 'spin-360', score: 1.2, unit: '°', date: '2026-04-25' },
  { id: '302', initials: 'AXE', gameId: 'spin-360', score: 2.7, unit: '°', date: '2026-04-24' },
  { id: '303', initials: 'DOM', gameId: 'spin-360', score: 5.3, unit: '°', date: '2026-04-26' },
];

const PLAYER_INITIALS = 'DOM';

export function isLowerBetter(gameId: string): boolean {
  return (
    gameId === 'reaction-light' ||
    gameId === 'spin-360' ||
    gameId === 'silence' ||
    gameId === 'true-north'
  );
}

export function getTopScores(
  gameId: string,
  timeframe: Timeframe = 'all',
  limit = 10,
): Score[] {
  const game = MOCK_SCORES.filter((s) => s.gameId === gameId);
  const filtered = filterByTimeframe(game, timeframe);
  filtered.sort(scoreSorter(gameId));
  return filtered.slice(0, limit);
}

export function getAllTopScores(timeframe: Timeframe = 'all', limit = 25): Score[] {
  const filtered = filterByTimeframe(MOCK_SCORES, timeframe);
  return filtered.slice(0, limit);
}

export function getAllScoresForGame(gameId: string): Score[] {
  return MOCK_SCORES.filter((s) => s.gameId === gameId);
}

export function getPlayerBest(gameId: string): Score | null {
  const ours = MOCK_SCORES.filter(
    (s) => s.gameId === gameId && s.initials === PLAYER_INITIALS,
  );
  if (!ours.length) return null;
  ours.sort(scoreSorter(gameId));
  return ours[0];
}

/**
 * Insert a hypothetical player score into the leaderboard for a game and
 * return the full ranked list along with where the player landed. The
 * player score gets a synthetic id ('me') so the result screen can spot
 * it easily for highlighting.
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

function scoreSorter(gameId: string) {
  const lower = isLowerBetter(gameId);
  return (a: Score, b: Score) => (lower ? a.score - b.score : b.score - a.score);
}

function filterByTimeframe(scores: Score[], timeframe: Timeframe): Score[] {
  if (timeframe === 'all') return [...scores];
  const now = new Date('2026-04-26');
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - (timeframe === 'today' ? 1 : 7));
  return scores.filter((s) => new Date(s.date) >= cutoff);
}
