// Mock leaderboard rows used as a dev fallback when Supabase isn't
// configured. Same data that used to live inline in leaderboard.ts.
//
// In production, this list is also good seed material — paste the rows
// into the Supabase SQL editor (see SUPABASE_SETUP.md) so the live
// leaderboards have realistic-looking competition out of the gate.

import type { Score } from './leaderboard-types';

export const MOCK_SCORES: Score[] = [
  // Tap Bullseye — continuous-spawn survival mode.
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

  // Trivia
  { id: '140', initials: 'KAT', gameId: 'trivia', score: 9420, unit: 'PTS', date: '2026-04-26' },
  { id: '141', initials: 'NOX', gameId: 'trivia', score: 8870, unit: 'PTS', date: '2026-04-25' },
  { id: '142', initials: 'ZIP', gameId: 'trivia', score: 7980, unit: 'PTS', date: '2026-04-24' },
  { id: '143', initials: 'DOM', gameId: 'trivia', score: 6720, unit: 'PTS', date: '2026-04-26' },
  { id: '144', initials: 'BLZ', gameId: 'trivia', score: 5340, unit: 'PTS', date: '2026-04-23' },
  { id: '145', initials: 'AAA', gameId: 'trivia', score: 3200, unit: 'PTS', date: '2026-04-21' },

  // Draw It
  { id: '150', initials: 'KAT', gameId: 'draw-it', score: 4620, unit: 'PTS', date: '2026-04-26' },
  { id: '151', initials: 'ZIP', gameId: 'draw-it', score: 4180, unit: 'PTS', date: '2026-04-25' },
  { id: '152', initials: 'DOM', gameId: 'draw-it', score: 3540, unit: 'PTS', date: '2026-04-26' },
  { id: '153', initials: 'BLZ', gameId: 'draw-it', score: 2820, unit: 'PTS', date: '2026-04-23' },
  { id: '154', initials: 'AAA', gameId: 'draw-it', score: 1750, unit: 'PTS', date: '2026-04-21' },

  // Pulse
  { id: '160', initials: 'KAT', gameId: 'pulse', score: 32140, unit: 'PTS', date: '2026-04-26' },
  { id: '161', initials: 'NOX', gameId: 'pulse', score: 24690, unit: 'PTS', date: '2026-04-25' },
  { id: '162', initials: 'ZIP', gameId: 'pulse', score: 18420, unit: 'PTS', date: '2026-04-24' },
  { id: '163', initials: 'DOM', gameId: 'pulse', score: 12380, unit: 'PTS', date: '2026-04-26' },
  { id: '164', initials: 'BLZ', gameId: 'pulse', score: 7140,  unit: 'PTS', date: '2026-04-23' },
  { id: '165', initials: 'AAA', gameId: 'pulse', score: 3220,  unit: 'PTS', date: '2026-04-21' },

  // Memory Grid
  { id: '170', initials: 'KAT', gameId: 'memory-grid', score: 12100, unit: 'PTS', date: '2026-04-26' },
  { id: '171', initials: 'NOX', gameId: 'memory-grid', score: 9450,  unit: 'PTS', date: '2026-04-25' },
  { id: '172', initials: 'ZIP', gameId: 'memory-grid', score: 7800,  unit: 'PTS', date: '2026-04-24' },
  { id: '173', initials: 'DOM', gameId: 'memory-grid', score: 5600,  unit: 'PTS', date: '2026-04-26' },
  { id: '174', initials: 'BLZ', gameId: 'memory-grid', score: 3850,  unit: 'PTS', date: '2026-04-23' },
  { id: '175', initials: 'AAA', gameId: 'memory-grid', score: 1500,  unit: 'PTS', date: '2026-04-21' },

  // Stroop Rush
  { id: '180', initials: 'KAT', gameId: 'stroop', score: 28640, unit: 'PTS', date: '2026-04-26' },
  { id: '181', initials: 'NOX', gameId: 'stroop', score: 21380, unit: 'PTS', date: '2026-04-25' },
  { id: '182', initials: 'ZIP', gameId: 'stroop', score: 16210, unit: 'PTS', date: '2026-04-24' },
  { id: '183', initials: 'DOM', gameId: 'stroop', score: 11440, unit: 'PTS', date: '2026-04-26' },
  { id: '184', initials: 'BLZ', gameId: 'stroop', score: 7860,  unit: 'PTS', date: '2026-04-23' },
  { id: '185', initials: 'AAA', gameId: 'stroop', score: 3120,  unit: 'PTS', date: '2026-04-21' },

  // Reaction Light — lower is better
  { id: '101', initials: 'ZIP', gameId: 'reaction-light', score: 142, unit: 'MS', date: '2026-04-26' },
  { id: '102', initials: 'BLZ', gameId: 'reaction-light', score: 156, unit: 'MS', date: '2026-04-25' },
  { id: '103', initials: 'KAT', gameId: 'reaction-light', score: 167, unit: 'MS', date: '2026-04-25' },
  { id: '104', initials: 'DOM', gameId: 'reaction-light', score: 184, unit: 'MS', date: '2026-04-26' },

  // Dead Air
  { id: '130', initials: 'ZEN', gameId: 'dead-air', score: 12420, unit: 'SEC', date: '2026-04-26' },
  { id: '131', initials: 'KAT', gameId: 'dead-air', score: 8970,  unit: 'SEC', date: '2026-04-25' },
  { id: '132', initials: 'NOX', gameId: 'dead-air', score: 6340,  unit: 'SEC', date: '2026-04-24' },
  { id: '133', initials: 'DOM', gameId: 'dead-air', score: 4520,  unit: 'SEC', date: '2026-04-26' },
  { id: '134', initials: 'BLZ', gameId: 'dead-air', score: 3080,  unit: 'SEC', date: '2026-04-23' },
  { id: '135', initials: 'AAA', gameId: 'dead-air', score: 1840,  unit: 'SEC', date: '2026-04-21' },

  // Walk the Line
  { id: '110', initials: 'KAT', gameId: 'walk-the-line', score: 16240, unit: 'PTS', date: '2026-04-26' },
  { id: '111', initials: 'NOX', gameId: 'walk-the-line', score: 14880, unit: 'PTS', date: '2026-04-25' },
  { id: '112', initials: 'ZIP', gameId: 'walk-the-line', score: 13420, unit: 'PTS', date: '2026-04-24' },
  { id: '113', initials: 'DOM', gameId: 'walk-the-line', score: 11200, unit: 'PTS', date: '2026-04-26' },
  { id: '114', initials: 'BLZ', gameId: 'walk-the-line', score: 9870,  unit: 'PTS', date: '2026-04-23' },
  { id: '115', initials: 'AAA', gameId: 'walk-the-line', score: 7260,  unit: 'PTS', date: '2026-04-21' },

  // Slipstream
  { id: '120', initials: 'KAT', gameId: 'slipstream', score: 64280, unit: 'PTS', date: '2026-04-26' },
  { id: '121', initials: 'NOX', gameId: 'slipstream', score: 51760, unit: 'PTS', date: '2026-04-25' },
  { id: '122', initials: 'ZIP', gameId: 'slipstream', score: 42910, unit: 'PTS', date: '2026-04-24' },
  { id: '123', initials: 'DOM', gameId: 'slipstream', score: 32540, unit: 'PTS', date: '2026-04-26' },
  { id: '124', initials: 'BLZ', gameId: 'slipstream', score: 26380, unit: 'PTS', date: '2026-04-23' },
  { id: '125', initials: 'ZEN', gameId: 'slipstream', score: 19720, unit: 'PTS', date: '2026-04-22' },
  { id: '126', initials: 'AAA', gameId: 'slipstream', score: 12440, unit: 'PTS', date: '2026-04-21' },
  { id: '127', initials: 'NUB', gameId: 'slipstream', score: 5980,  unit: 'PTS', date: '2026-04-20' },

  // Tilt Maze — composite score
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

  // 360 Spin — lower is better
  { id: '301', initials: 'TRN', gameId: 'spin-360', score: 1.2, unit: '°', date: '2026-04-25' },
  { id: '302', initials: 'AXE', gameId: 'spin-360', score: 2.7, unit: '°', date: '2026-04-24' },
  { id: '303', initials: 'DOM', gameId: 'spin-360', score: 5.3, unit: '°', date: '2026-04-26' },

  // Vector — endless tunnel survival score (time + blast combos).
  // Top-tier players push 8k+; casual ~1k.
  { id: '430', initials: 'KAT', gameId: 'vector', score: 12480, unit: 'PTS', date: '2026-04-26' },
  { id: '431', initials: 'NOX', gameId: 'vector', score:  9320, unit: 'PTS', date: '2026-04-25' },
  { id: '432', initials: 'ZIP', gameId: 'vector', score:  6890, unit: 'PTS', date: '2026-04-24' },
  { id: '433', initials: 'DOM', gameId: 'vector', score:  4720, unit: 'PTS', date: '2026-04-26' },
  { id: '434', initials: 'BLZ', gameId: 'vector', score:  3140, unit: 'PTS', date: '2026-04-23' },
  { id: '435', initials: 'AAA', gameId: 'vector', score:  1280, unit: 'PTS', date: '2026-04-21' },

  // Flip — total degrees rotated in 5s.
  // Casual single-flip ~360°. A determined wrist-spinner can hit 2000°+
  // in 5 seconds. Top scores show off clean multi-axis rotation.
  { id: '401', initials: 'KAT', gameId: 'flip', score: 2840, unit: '°', date: '2026-04-26' },
  { id: '402', initials: 'NOX', gameId: 'flip', score: 2210, unit: '°', date: '2026-04-25' },
  { id: '403', initials: 'ZIP', gameId: 'flip', score: 1740, unit: '°', date: '2026-04-24' },
  { id: '404', initials: 'DOM', gameId: 'flip', score: 1180, unit: '°', date: '2026-04-26' },
  { id: '405', initials: 'BLZ', gameId: 'flip', score: 840,  unit: '°', date: '2026-04-23' },
  { id: '406', initials: 'AAA', gameId: 'flip', score: 420,  unit: '°', date: '2026-04-21' },

  // Shake Meter — sum of (|a|-1g)² across 10s of samples (~50Hz).
  // Calibration: leisurely shake ~3000, vigorous ~12000, manic ~25000+.
  { id: '410', initials: 'KAT', gameId: 'shake', score: 28640, unit: 'PTS', date: '2026-04-26' },
  { id: '411', initials: 'NOX', gameId: 'shake', score: 22180, unit: 'PTS', date: '2026-04-25' },
  { id: '412', initials: 'ZIP', gameId: 'shake', score: 17420, unit: 'PTS', date: '2026-04-24' },
  { id: '413', initials: 'DOM', gameId: 'shake', score: 12340, unit: 'PTS', date: '2026-04-26' },
  { id: '414', initials: 'BLZ', gameId: 'shake', score: 8210,  unit: 'PTS', date: '2026-04-23' },
  { id: '415', initials: 'AAA', gameId: 'shake', score: 3640,  unit: 'PTS', date: '2026-04-21' },

  // Card Shark — 3 strikes ends the run; per-round 100 + speed × streak.
  // Top-tier: 80+ correct rounds, ~25k+ score.
  { id: '420', initials: 'KAT', gameId: 'card-shark', score: 27880, unit: 'PTS', date: '2026-04-26' },
  { id: '421', initials: 'NOX', gameId: 'card-shark', score: 21340, unit: 'PTS', date: '2026-04-25' },
  { id: '422', initials: 'ZIP', gameId: 'card-shark', score: 16210, unit: 'PTS', date: '2026-04-24' },
  { id: '423', initials: 'DOM', gameId: 'card-shark', score: 11480, unit: 'PTS', date: '2026-04-26' },
  { id: '424', initials: 'BLZ', gameId: 'card-shark', score: 7320,  unit: 'PTS', date: '2026-04-23' },
  { id: '425', initials: 'AAA', gameId: 'card-shark', score: 2840,  unit: 'PTS', date: '2026-04-21' },
];

export const PLAYER_INITIALS = 'DOM';
