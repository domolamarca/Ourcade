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

  // Polaroid — 5 rounds × max 2000 = 10,000 ceiling.
  { id: '90', initials: 'KAT', gameId: 'polaroid', score: 9420, unit: 'PTS', date: '2026-04-26' },
  { id: '91', initials: 'NOX', gameId: 'polaroid', score: 8870, unit: 'PTS', date: '2026-04-25' },
  { id: '92', initials: 'ZIP', gameId: 'polaroid', score: 8210, unit: 'PTS', date: '2026-04-24' },
  { id: '93', initials: 'DOM', gameId: 'polaroid', score: 7340, unit: 'PTS', date: '2026-04-26' },
  { id: '94', initials: 'BLZ', gameId: 'polaroid', score: 6920, unit: 'PTS', date: '2026-04-23' },
  { id: '95', initials: 'ZEN', gameId: 'polaroid', score: 6180, unit: 'PTS', date: '2026-04-22' },
  { id: '96', initials: 'AAA', gameId: 'polaroid', score: 5440, unit: 'PTS', date: '2026-04-21' },
  { id: '97', initials: 'NUB', gameId: 'polaroid', score: 3820, unit: 'PTS', date: '2026-04-20' },

  // Trivia — 10 questions × max 1000 = 10,000 ceiling.
  { id: '140', initials: 'KAT', gameId: 'trivia', score: 9420, unit: 'PTS', date: '2026-04-26' },
  { id: '141', initials: 'NOX', gameId: 'trivia', score: 8870, unit: 'PTS', date: '2026-04-25' },
  { id: '142', initials: 'ZIP', gameId: 'trivia', score: 7980, unit: 'PTS', date: '2026-04-24' },
  { id: '143', initials: 'DOM', gameId: 'trivia', score: 6720, unit: 'PTS', date: '2026-04-26' },
  { id: '144', initials: 'BLZ', gameId: 'trivia', score: 5340, unit: 'PTS', date: '2026-04-23' },
  { id: '145', initials: 'AAA', gameId: 'trivia', score: 3200, unit: 'PTS', date: '2026-04-21' },

  // Draw It — 5 rounds × max 1000 = 5,000 ceiling.
  { id: '150', initials: 'KAT', gameId: 'draw-it', score: 4620, unit: 'PTS', date: '2026-04-26' },
  { id: '151', initials: 'ZIP', gameId: 'draw-it', score: 4180, unit: 'PTS', date: '2026-04-25' },
  { id: '152', initials: 'DOM', gameId: 'draw-it', score: 3540, unit: 'PTS', date: '2026-04-26' },
  { id: '153', initials: 'BLZ', gameId: 'draw-it', score: 2820, unit: 'PTS', date: '2026-04-23' },
  { id: '154', initials: 'AAA', gameId: 'draw-it', score: 1750, unit: 'PTS', date: '2026-04-21' },

  // Pulse — endless distance × multiplier; elite players push 30k+.
  { id: '160', initials: 'KAT', gameId: 'pulse', score: 32140, unit: 'PTS', date: '2026-04-26' },
  { id: '161', initials: 'NOX', gameId: 'pulse', score: 24690, unit: 'PTS', date: '2026-04-25' },
  { id: '162', initials: 'ZIP', gameId: 'pulse', score: 18420, unit: 'PTS', date: '2026-04-24' },
  { id: '163', initials: 'DOM', gameId: 'pulse', score: 12380, unit: 'PTS', date: '2026-04-26' },
  { id: '164', initials: 'BLZ', gameId: 'pulse', score: 7140,  unit: 'PTS', date: '2026-04-23' },
  { id: '165', initials: 'AAA', gameId: 'pulse', score: 3220,  unit: 'PTS', date: '2026-04-21' },

  // Dead Air — score is centiseconds (0.01s units). 6,000 = 60s, 12,000 = 2min.
  { id: '130', initials: 'ZEN', gameId: 'dead-air', score: 12420, unit: 'SEC', date: '2026-04-26' },
  { id: '131', initials: 'KAT', gameId: 'dead-air', score: 8970,  unit: 'SEC', date: '2026-04-25' },
  { id: '132', initials: 'NOX', gameId: 'dead-air', score: 6340,  unit: 'SEC', date: '2026-04-24' },
  { id: '133', initials: 'DOM', gameId: 'dead-air', score: 4520,  unit: 'SEC', date: '2026-04-26' },
  { id: '134', initials: 'BLZ', gameId: 'dead-air', score: 3080,  unit: 'SEC', date: '2026-04-23' },
  { id: '135', initials: 'AAA', gameId: 'dead-air', score: 1840,  unit: 'SEC', date: '2026-04-21' },

  // Walk the Line — sum of per-level scores, max ~20000.
  { id: '110', initials: 'KAT', gameId: 'walk-the-line', score: 16240, unit: 'PTS', date: '2026-04-26' },
  { id: '111', initials: 'NOX', gameId: 'walk-the-line', score: 14880, unit: 'PTS', date: '2026-04-25' },
  { id: '112', initials: 'ZIP', gameId: 'walk-the-line', score: 13420, unit: 'PTS', date: '2026-04-24' },
  { id: '113', initials: 'DOM', gameId: 'walk-the-line', score: 11200, unit: 'PTS', date: '2026-04-26' },
  { id: '114', initials: 'BLZ', gameId: 'walk-the-line', score: 9870,  unit: 'PTS', date: '2026-04-23' },
  { id: '115', initials: 'AAA', gameId: 'walk-the-line', score: 7260,  unit: 'PTS', date: '2026-04-21' },

  // Slipstream — endless distance × multiplier; elite players push 50k+.
  { id: '120', initials: 'KAT', gameId: 'slipstream', score: 64280, unit: 'PTS', date: '2026-04-26' },
  { id: '121', initials: 'NOX', gameId: 'slipstream', score: 51760, unit: 'PTS', date: '2026-04-25' },
  { id: '122', initials: 'ZIP', gameId: 'slipstream', score: 42910, unit: 'PTS', date: '2026-04-24' },
  { id: '123', initials: 'DOM', gameId: 'slipstream', score: 32540, unit: 'PTS', date: '2026-04-26' },
  { id: '124', initials: 'BLZ', gameId: 'slipstream', score: 26380, unit: 'PTS', date: '2026-04-23' },
  { id: '125', initials: 'ZEN', gameId: 'slipstream', score: 19720, unit: 'PTS', date: '2026-04-22' },
  { id: '126', initials: 'AAA', gameId: 'slipstream', score: 12440, unit: 'PTS', date: '2026-04-21' },
  { id: '127', initials: 'NUB', gameId: 'slipstream', score: 5980,  unit: 'PTS', date: '2026-04-20' },

  // Tilt Maze — composite: level * 1_000_000 - elapsed_ms (higher better).
  { id: '80', initials: 'KAT', gameId: 'tilt-maze', score: 10_000_000 - 218_400, unit: 'LV', level: 10, taps: 218_400, date: '2026-04-26' },
  { id: '81', initials: 'NOX', gameId: 'tilt-maze', score: 9_000_000  - 195_100, unit: 'LV', level: 9,  taps: 195_100, date: '2026-04-25' },
  { id: '82', initials: 'ZIP', gameId: 'tilt-maze', score: 8_000_000  - 167_900, unit: 'LV', level: 8,  taps: 167_900, date: '2026-04-25' },
  { id: '83', initials: 'DOM', gameId: 'tilt-maze', score: 7_000_000  - 142_300, unit: 'LV', level: 7,  taps: 142_300, date: '2026-04-26' },
  { id: '84', initials: 'BLZ', gameId: 'tilt-maze', score: 6_000_000  - 128_700, unit: 'LV', level: 6,  taps: 128_700, date: '2026-04-23' },
  { id: '85', initials: 'STN', gameId: 'tilt-maze', score: 5_000_000  - 96_400,  unit: 'LV', level: 5,  taps: 96_400,  date: '2026-04-22' },
  { id: '86', initials: 'AAA', gameId: 'tilt-maze', score: 4_000_000  - 78_200,  unit: 'LV', level: 4,  taps: 78_200,  date: '2026-04-21' },
  { id: '87', initials: 'BOT', gameId: 'tilt-maze', score: 3_000_000  - 51_900,  unit: 'LV', level: 3,  taps: 51_900,  date: '2026-04-20' },
  { id: '88', initials: 'TUR', gameId: 'tilt-maze', score: 2_000_000  - 33_500,  unit: 'LV', level: 2,  taps: 33_500,  date: '2026-04-26' },
  { id: '89', initials: 'NUB', gameId: 'tilt-maze', score: 1_000_000  - 18_600,  unit: 'LV', level: 1,  taps: 18_600,  date: '2026-04-19' },

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
 * Returns the player's leaderboard placement for a game: their best entry
 * plus its rank among everyone else's scores. Used by the lobby's cabinet
 * cards to lead with "RANK #X" instead of a raw score.
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
