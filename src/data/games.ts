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
    id: 'tilt-maze',
    name: 'TILT MAZE',
    shortName: 'MAZE',
    tagline: 'Roll the ball through. Don\'t fall off.',
    description:
      'Tilt your phone to roll a ball through a winding path. Levels get narrower, twistier, spiral, and eventually start swinging hazards at you. Haptic warns when you\'re near the edge. One slip ends the run.',
    rules: [
      'Tilt the phone to apply gravity to the ball',
      'Stay on the glowing path',
      'Edge proximity triggers haptic warning',
      'Falling off OR hitting a hazard = game over',
      'Score: levels cleared, fastest time wins ties',
    ],
    sensors: ['ACCEL'],
    category: 'MOTION',
    iconText: '~',
    unit: 'LV',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'green',
    higherIsBetter: true,
    formatScore: (score, detail) => {
      // Composite: level * 1_000_000 - elapsed_ms.
      // detail.level is the level reached, detail.taps holds elapsed_ms.
      const level = detail?.level ?? Math.floor(score / 1_000_000);
      const ms = detail?.taps ?? level * 1_000_000 - score;
      const sec = (Math.max(0, ms) / 1000).toFixed(1);
      return `L${level} · ${sec}s`;
    },
  },
  {
    id: 'polaroid',
    name: 'POLAROID',
    shortName: 'POLA',
    tagline: 'Snap. Memorize. Spot the change.',
    description:
      'Take a photo. Memorize it. The game shows it back with one thing changed. Tap the change as fast as you can. Five rounds, every photo is yours, no two runs alike.',
    rules: [
      'TAP TO SHOOT — your camera, your photos',
      'Memorize phase: 2 seconds with the original',
      'Reveal phase: tap exactly where the change is',
      'Score = speed + accuracy across 5 rounds',
    ],
    sensors: ['CAM', 'TOUCH'],
    category: 'TOUCH',
    iconText: '◻',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'cyan',
    higherIsBetter: true,
  },
  {
    id: 'walk-the-line',
    name: 'WALK THE LINE',
    shortName: 'WALK',
    tagline: 'Trust your inner compass.',
    description:
      "Walk a target distance in a straight line — eyes closed, screen blacked out. Your phone tracks heading drift and step count. Some levels you turn around and return to start; others change the target mid-walk via haptic. 10 levels, one life, one body memory.",
    rules: [
      'Screen goes black during each walk — no progress visible',
      'Pedometer counts steps, gyro tracks heading drift',
      'RETURN levels: walk out, turn 180°, walk back',
      'VARIABLE levels: target updates mid-walk via haptic',
      'Score: low drift + accurate distance per level',
    ],
    sensors: ['ACCEL', 'GYRO', 'PEDOMETER'],
    category: 'MOTION',
    iconText: '|',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'cyan',
    higherIsBetter: true,
  },
  {
    id: 'slipstream',
    name: 'SLIPSTREAM',
    shortName: 'STREAM',
    tagline: 'Thread the neon. Dodge the bombs.',
    description:
      'Glow-bug through neon corridors. Tap to flap, tilt to drift. Tall walls have 1–3 holes (some moving), orange short bars bob between them, cyan tunnels force altitude commits, and red bombs turn the arcade lethal. Mine fields appear in the deep run. Hit anything — wall, bomb, top/bottom border — and the run ends.',
    rules: [
      'TAP to flap upward, TILT to drift sideways',
      'Thread holes in tall walls (1–3 holes; some drift)',
      'Orange bars bob — fly above or below',
      'CYAN tunnels: stay inside the corridor',
      'RED bombs end the run on contact — beware mine fields',
      'Streaks from orbs unlock x2 / x3 / x4 multipliers',
    ],
    sensors: ['TOUCH', 'ACCEL'],
    category: 'COMBO',
    iconText: '~',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'magenta',
    higherIsBetter: true,
  },
  {
    id: 'dead-air',
    name: 'DEAD AIR',
    shortName: 'DEAD AIR',
    tagline: 'Be still. Be silent. As long as you can.',
    description:
      'Hold the phone in your hand and stay perfectly still while keeping the room silent. Either condition fails and the run ends. Score is duration. Setting the phone down counts as cheating.',
    rules: [
      'Hold the phone — don\'t set it down',
      'Stay still: jitter must stay in the human-grip range',
      'Stay quiet: ambient dB must stay below the threshold',
      'Random buzz checks confirm you\'re really holding it',
      'Score: total seconds both conditions held',
    ],
    sensors: ['ACCEL', 'MIC'],
    category: 'COMBO',
    iconText: '~',
    unit: 'SEC',
    scoreLabel: 'LONGEST',
    status: 'live',
    accentColor: 'cyan',
    higherIsBetter: true,
    formatScore: (score) => `${(score / 100).toFixed(2)}s`,
  },
  {
    id: 'trivia',
    name: 'TRIVIA',
    shortName: 'TRIVIA',
    tagline: 'Three strikes. Endless questions.',
    description:
      'Multiple-choice questions stream forever. 8 seconds each. Three strikes (wrong or timeout) and the run ends. Every 10 correct earns a SHIELD that absorbs a strike. Game-over screen shows your strongest and weakest categories.',
    rules: [
      '4 choices, tap to answer — 8s per question',
      'Faster correct = bigger speed bonus',
      'Streaks unlock x2 / x3 / x4 multipliers',
      '3 strikes ends the run',
      '+1 SHIELD per 10 correct (absorbs a strike)',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '?',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'magenta',
    higherIsBetter: true,
  },
  {
    id: 'draw-it',
    name: 'DRAW IT',
    shortName: 'DRAW',
    tagline: 'Sketch from memory. Forever.',
    description:
      'Each round flashes a target shape briefly, then the canvas goes blank and you draw it freehand. 27 unique shapes spanning four difficulty tiers. Every fourth round is a BISECT bonus — slice the shape in half through the center at any angle for free points. Scoring is tight; sloppy strokes will end the run.',
    rules: [
      'Target flashes — memorize, then redraw blind',
      'Lift finger to submit',
      'Tiers: basics → polygons → stars/arrows → curves & letters',
      'Every 4th round = BISECT bonus — any angle through the center',
      'Score below 250 on a normal round = run ends',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: 'O',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'green',
    higherIsBetter: true,
  },
  {
    id: 'pulse',
    name: 'PULSE',
    shortName: 'PULSE',
    tagline: 'Tap the falling tiles. Don\'t miss.',
    description:
      'Four lanes. Tiles drop from the top — tap the lane when the tile crosses the hit zone. Tempo never stops climbing. Tile heights start varying after 30s. After 60s, RED off-key tiles slip in — let those fall through. Tapping one ends your run. Each lane sounds a note in C major.',
    rules: [
      '4 lanes — tap when a tile reaches the yellow line',
      'Hit closer to the line for bonus points',
      'Miss, empty tap, or RED tap = game over',
      'Tempo + tile sizes ramp continuously (no cap)',
      'After 60s: RED off-key tiles — DO NOT tap',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '|',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'yellow',
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
