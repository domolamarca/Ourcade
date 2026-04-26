// Single source of truth for the game catalog.
// When you add a real game implementation, flip status: 'soon' → 'live' and
// drop the play screen at app/play/[id].tsx.

import type { NeonColor } from '../theme';

export type SensorTag =
  | 'TOUCH'
  | 'ACCEL'
  | 'GYRO'
  | 'MAG'
  | 'BARO'
  | 'MIC'
  | 'CAM'
  | 'GPS'
  | 'PEDOMETER'
  | 'COMBO';

export type GameCategory = 'TOUCH' | 'MOTION' | 'AUDIO' | 'COMPASS' | 'LOCATION' | 'COMBO';

export type Game = {
  id: string;
  name: string;
  shortName: string; // <= 10 chars, displayed on cabinet marquee
  tagline: string; // one-line hook
  description: string; // longer pre-game blurb
  rules: string[]; // bullet list shown before PRESS START
  sensors: SensorTag[];
  category: GameCategory;
  iconText: string; // glyph standing in for sprite art
  unit: string; // 'PTS' | 'MS' | 'dB' | '°' | 'M'
  scoreLabel: string; // 'BEST' | 'FASTEST' | 'CLOSEST' etc.
  status: 'live' | 'soon';
  accentColor: NeonColor;
  // Higher score = better? Most arcade games yes; reaction-time games no.
  higherIsBetter: boolean;
  // Optional custom display formatter for compound scores (e.g. Minesweep
  // packs level + tap count into a single sortable number but should
  // *render* as "L4 · 23"). Receives the raw score number plus optional
  // detail fields the leaderboard row can supply.
  formatScore?: (score: number, detail?: { level?: number; taps?: number }) => string;
};

export const games: Game[] = [
  {
    id: 'tap-bullseye',
    name: 'TAP BULLSEYE',
    shortName: 'BULLSEYE',
    tagline: 'Survive the spawn. One miss ends it.',
    description:
      'Targets keep appearing, faster and faster. Tap them before they expire. Let one slip and the game is over. How long can you keep up?',
    rules: [
      'New target every ~0.9s, accelerating',
      'Each target fades over 3.5s — when it vanishes, you\'re out',
      'Tap anywhere outside a target = game over',
      'Dead-center streaks unlock x2 / x3 / x4 score',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '◎',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'magenta',
    higherIsBetter: true,
  },
  {
    id: 'minesweep',
    name: 'MINESWEEP',
    shortName: 'SWEEP',
    tagline: 'Read the chaos. Wipe colors clean.',
    description:
      'A field of moving dots in 5 colors. Tap a spot — the dominant color inside your tight blast radius gets wiped from that area only. Hunt the rest down. Empty blast = game over. Each level adds more, smaller, faster dots.',
    rules: [
      '5 colors, tight 40px blast radius',
      'Dominant color in blast → those dots in radius wiped',
      'Same color elsewhere stays alive — hunt them down',
      'Empty blast = game over',
      'Score: levels reached, fewest taps wins ties',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '*',
    unit: 'LV',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'orange',
    higherIsBetter: true,
    formatScore: (score, detail) => {
      // Composite encoding: level * 10000 - taps. Decode for display.
      const level = detail?.level ?? Math.floor(score / 10000);
      const taps = detail?.taps ?? level * 10000 - score;
      return `L${level} · ${taps}`;
    },
  },
  {
    id: 'ghost',
    name: 'GHOST',
    shortName: 'GHOST',
    tagline: "You're the eyes. He's the legs.",
    description:
      "Operator mode. The Runner walks his route — you clear the path. Loop cameras, distract guards, flip lasers, hold the phone still during hide moments, crack safes by haptic feel alone. One detection ends the run.",
    rules: [
      'Tap threats to neutralize them — budget is finite',
      'Hold the phone still during hide moments',
      'Heartbeat haptic = a guard is close',
      'Crack safes by feel, no visuals',
      'Score: time + unspent budget',
    ],
    sensors: ['TOUCH', 'ACCEL', 'GYRO'],
    category: 'COMBO',
    iconText: 'g',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'purple',
    higherIsBetter: true,
  },
  {
    id: 'reaction-light',
    name: 'REACTION LIGHT',
    shortName: 'REACT',
    tagline: 'Wait for green. Tap. Pure milliseconds.',
    description:
      'The screen sits red. After a random delay it flips green. Tap as fast as you can. Tap during red and you bust.',
    rules: [
      'Hold still. Tap the moment it turns green',
      'Tap during red = disqualified',
      'Average of 5 rounds is your score',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '◉',
    unit: 'MS',
    scoreLabel: 'FASTEST',
    status: 'live',
    accentColor: 'green',
    higherIsBetter: false,
  },
  {
    id: 'dead-still',
    name: 'DEAD STILL',
    shortName: 'STILL',
    tagline: 'Hold the phone perfectly still.',
    description:
      'Lower jitter = higher score. Sneeze, breathe wrong, get bumped — your score craters. Ten seconds of true zen.',
    rules: [
      'Hold the phone in any orientation',
      'Score = 10000 / accumulated jitter',
      'Ten seconds. No do-overs',
    ],
    sensors: ['ACCEL', 'GYRO'],
    category: 'MOTION',
    iconText: '⊡',
    unit: 'PTS',
    scoreLabel: 'STEADIEST',
    status: 'live',
    accentColor: 'cyan',
    higherIsBetter: true,
  },
  {
    id: 'spin-360',
    name: '360 SPIN',
    shortName: 'SPIN',
    tagline: 'Rotate exactly one full turn.',
    description:
      'Rotate the phone exactly 360° on the yaw axis. Closest to a perfect revolution wins. Drift counts against you.',
    rules: [
      'Lay flat or hold upright — your choice',
      'Score = |360 − measured°|',
      'Lower is better',
    ],
    sensors: ['GYRO'],
    category: 'MOTION',
    iconText: '↻',
    unit: '°',
    scoreLabel: 'CLOSEST',
    status: 'live',
    accentColor: 'yellow',
    higherIsBetter: false,
  },
  {
    id: 'silence',
    name: 'SILENCE',
    shortName: 'QUIET',
    tagline: 'Make your room as silent as possible.',
    description:
      'We sample microphone dB for 30 seconds. Lowest sustained reading wins. Try this in NYC, we dare you.',
    rules: [
      'Mic permission required',
      '30 seconds of recording',
      'Score = average dB over the run',
    ],
    sensors: ['MIC'],
    category: 'AUDIO',
    iconText: '◔',
    unit: 'dB',
    scoreLabel: 'QUIETEST',
    status: 'soon',
    accentColor: 'purple',
    higherIsBetter: false,
  },
  {
    id: 'true-north',
    name: 'TRUE NORTH',
    shortName: 'NORTH',
    tagline: 'Point the phone exactly north.',
    description:
      'Compass mode. Aim the top of the device at magnetic north as accurately as you can. We snapshot when you tap LOCK.',
    rules: [
      'Compass calibration matters — wave the phone in a figure-8 first',
      'Tap LOCK when you think you have it',
      'Score = degrees off true north',
    ],
    sensors: ['MAG'],
    category: 'COMPASS',
    iconText: '◈',
    unit: '°',
    scoreLabel: 'CLOSEST',
    status: 'soon',
    accentColor: 'orange',
    higherIsBetter: false,
  },
  {
    id: 'high-rise',
    name: 'HIGH RISE',
    shortName: 'CLIMB',
    tagline: 'Find the highest building near you.',
    description:
      'Localized leaderboard. Use the barometer to record the highest elevation gain in your city in a single session. Daily reset.',
    rules: [
      'Barometer required (iPhone 6 and later)',
      'Localized to your city — separate leaderboard',
      'Score = peak elevation above your start point',
    ],
    sensors: ['BARO', 'GPS'],
    category: 'LOCATION',
    iconText: '↟',
    unit: 'M',
    scoreLabel: 'HIGHEST',
    status: 'soon',
    accentColor: 'blue',
    higherIsBetter: true,
  },
  {
    id: 'tap-and-still',
    name: 'TAP & STILL',
    shortName: 'COMBO',
    tagline: 'Fastest tap with the least phone motion.',
    description:
      'Tie-breaker mode. Tap the target as fast as possible while keeping the phone perfectly still. Combined score across both.',
    rules: [
      'Touch + accelerometer scored together',
      'Movement penalty multiplies your time',
      'Used for tie-break in tournaments',
    ],
    sensors: ['TOUCH', 'ACCEL'],
    category: 'COMBO',
    iconText: '✦',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'soon',
    accentColor: 'red',
    higherIsBetter: true,
  },
];

export const gamesById: Record<string, Game> = Object.fromEntries(
  games.map((g) => [g.id, g]),
);

export function getGame(id: string): Game | undefined {
  return gamesById[id];
}
