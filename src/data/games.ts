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

/**
 * Skill bucket — used to group cabinets in the lobby. Independent of
 * the sensor `category` above so we can rearrange the floor without
 * disturbing per-game routing or icon mappings.
 */
export type SkillCategory = 'REACTION' | 'MEMORY' | 'CONCENTRATION' | 'CHAOS';

export const SKILL_LABELS: Record<SkillCategory, string> = {
  REACTION: 'REACTION',
  MEMORY: 'MEMORY',
  CONCENTRATION: 'CONCENTRATION',
  CHAOS: 'CHAOS',
};

export const SKILL_COLORS: Record<SkillCategory, NeonColor> = {
  REACTION: 'red',
  MEMORY: 'purple',
  CONCENTRATION: 'green',
  CHAOS: 'yellow',
};

export const SKILL_ORDER: SkillCategory[] = [
  'REACTION',
  'MEMORY',
  'CONCENTRATION',
  'CHAOS',
];

export type Game = {
  id: string;
  name: string;
  shortName: string; // <= 10 chars, displayed on cabinet marquee
  tagline: string; // one-line hook
  description: string; // longer pre-game blurb
  rules: string[]; // bullet list shown before PRESS START
  sensors: SensorTag[];
  category: GameCategory;
  /** Lobby skill bucket — groups cabinets in the home screen. */
  skill: SkillCategory;
  iconText: string; // glyph standing in for sprite art
  unit: string; // 'PTS' | 'MS' | 'dB' | '°' | 'M'
  scoreLabel: string; // 'BEST' | 'FASTEST' | 'CLOSEST' etc.
  status: 'live' | 'soon';
  /** When true, the cabinet is built and works but stays out of the
   * lobby + daily-challenge rotation. Used to bench cabinets between
   * weekly content drops without deleting code or leaderboard data. */
  hidden?: boolean;
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
    skill: 'REACTION',
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
    skill: 'CONCENTRATION',
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
    skill: 'CONCENTRATION',
    name: 'TILT MAZE',
    shortName: 'MAZE',
    tagline: 'Roll the ball through. Don\'t fall off.',
    description:
      'Tilt your phone to roll a ball through a winding path. 30 hand-tuned levels — narrower, twistier, spirals, eventually swinging hazards. Past level 30 the layouts loop with stacking lap difficulty (faster ball, faster hazards). Haptic warns near the edge. One slip ends the run.',
    rules: [
      'Tilt the phone to apply gravity to the ball',
      'Stay on the glowing path',
      'Edge proximity triggers haptic warning',
      'Falling off OR hitting a hazard = game over',
      '30 levels then loops with +difficulty — climb forever',
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
    id: 'walk-the-line',
    skill: 'CONCENTRATION',
    hidden: true, // benched for launch — returns as a content-drop cabinet
    name: 'WALK THE LINE',
    shortName: 'WALK',
    tagline: 'Trust your inner compass.',
    description:
      "Walk a target distance in a straight line — eyes closed, screen blacked out. Your phone tracks heading drift and step count. Some levels you turn around and return to start; others change the target mid-walk via haptic. 10 hand-tuned levels, then procedural walks with longer distances and tighter drift tolerances. 3 strikes ends the run.",
    rules: [
      'Screen goes black during each walk — no progress visible',
      'Accelerometer counts steps, gyro tracks heading drift',
      'RETURN levels: walk out, turn 180°, walk back',
      'VARIABLE levels: target updates mid-walk via haptic',
      'Score below 600 on a level = strike. 3 strikes ends the run',
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
    skill: 'CHAOS',
    name: 'BOUNCE',
    shortName: 'BOUNCE',
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
    skill: 'CONCENTRATION',
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
    skill: 'MEMORY',
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
    skill: 'CONCENTRATION',
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
    id: 'memory-grid',
    skill: 'MEMORY',
    name: 'MEMORY GRID',
    shortName: 'MEMORY',
    tagline: 'Watch the flash. Tap it back.',
    description:
      'A 3×3 neon grid plays a sequence. Tap the cells in the same order. The sequence is persistent — every round adds ONE new cell to the tail; the front you already memorized stays. Show-time per cell tightens with each round. One wrong tap ends the run.',
    rules: [
      'Watch the sequence flash, then tap it back in order',
      'Sequence is persistent — only one new cell appended per round',
      'Show-time per cell shortens with each round',
      'One wrong tap = game over',
      'Score: 100 × cumulative sequence length cleared',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '⠿',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'purple',
    higherIsBetter: true,
  },
  {
    id: 'stroop',
    skill: 'REACTION',
    name: 'COLORZ',
    shortName: 'COLORZ',
    tagline: 'Read the color. Ignore the word.',
    description:
      'A color word is shown in a different ink color. Tap the INK color, not the word. Tiered escalation: round 11 the swatches disappear (read the labels), round 16 the instruction hint vanishes (remember the rule), round 21+ the timer keeps tightening. Three strikes ends the run, but rounds are infinite — climb until you slip.',
    rules: [
      'Tap the INK color (not the word)',
      'Round 11+: swatches gone, word labels only',
      'Round 16+: instruction hint hidden — remember the rule',
      'Round 21+ → 31+ → 51+: progressively shorter timer',
      '3 strikes (wrong or timeout) ends the run',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '◧',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'red',
    higherIsBetter: true,
  },
  {
    id: 'pulse',
    skill: 'REACTION',
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
    id: 'vector',
    skill: 'CHAOS',
    name: 'VECTOR',
    shortName: 'VECTOR',
    tagline: 'Tilt to dodge. Tap to blast.',
    description:
      'Your ship flies toward a vanishing point. Asteroids race out of it straight at you. Tilt to slide, tap to fire. Bullets only kill in the near field. Threat ladder unlocks: CURVING at 20s, BIG at 25s, CLUSTERS at 35s, MINES at 50s. Power-up capsules drop into the lane occasionally — touch with your ship for SPREAD shot or RAPID fire. 3 lives, no cap.',
    rules: [
      'TILT phone to slide · TAP to fire',
      'Bullets only kill in the near zone — wait for the rock to drop',
      'CURVING (20s+) · BIG (25s+) · CLUSTERS (35s+) · MINES (50s+)',
      'Power-up capsules: cyan = SPREAD, yellow = RAPID (5s each)',
      '3 lives, infinite rounds — leaderboard stays open',
    ],
    sensors: ['ACCEL', 'TOUCH'],
    category: 'COMBO',
    iconText: '∆',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'cyan',
    higherIsBetter: true,
  },
  {
    id: 'flip',
    skill: 'CHAOS',
    name: 'FLIP',
    shortName: 'FLIP',
    tagline: 'Rotate as much as you can in 5 seconds.',
    description:
      'A 5-second rotation challenge. Flip, spin, or roll the phone in your hand — every degree counts. Score = total integrated rotation magnitude across all axes. No throwing required; this is wrist-and-grip skill.',
    rules: [
      'Tap to start — 5-second window',
      'Flip / spin / roll the phone any way you like',
      'Score = total degrees of rotation (sum of |gyro|·dt)',
      'Smoother + faster rotation scores higher',
    ],
    sensors: ['GYRO'],
    category: 'MOTION',
    iconText: '↻',
    unit: '°',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'red',
    higherIsBetter: true,
  },
  {
    id: 'shake',
    skill: 'CHAOS',
    name: 'SHAKE METER',
    shortName: 'SHAKE',
    tagline: 'Shake harder. Shake longer.',
    description:
      'Shake the phone as vigorously as possible for 10 seconds. Score is integrated shake energy from the accelerometer. A live intensity meter shows how hard you\'re going. Higher beats lower.',
    rules: [
      '10-second window — shake non-stop',
      'Score = integrated (|a| - 1g)² × time',
      'Live meter shows current intensity',
      'Cardio. Wear a wrist strap if you got one',
    ],
    sensors: ['ACCEL'],
    category: 'MOTION',
    iconText: '~',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'orange',
    higherIsBetter: true,
  },
  {
    id: 'card-shark',
    skill: 'MEMORY',
    name: 'CARD SHARK',
    shortName: 'SHARK',
    tagline: 'Find the queen. Three-card monte.',
    description:
      'Three card backs. The queen flashes for a moment, then they shuffle. Tap the queen when the cards stop. Right = points + speed bonus + streak multiplier. Wrong = strike. Three strikes ends the run, but rounds are infinite — climb forever. Round 11 adds a 4th card. Round 16 adds DECOY FLIPS — fake queens flash mid-shuffle to wreck your tracking.',
    rules: [
      'Watch the queen reveal',
      'Track the shuffle — speed climbs every round',
      'Round 6+: faster ramp (more swaps, less time)',
      'Round 11+: 4th card joins the row',
      'Round 16+: DECOY flashes mid-shuffle — fake queens',
      '3 strikes ends the run',
    ],
    sensors: ['TOUCH'],
    category: 'TOUCH',
    iconText: '♠',
    unit: 'PTS',
    scoreLabel: 'BEST',
    status: 'live',
    accentColor: 'green',
    higherIsBetter: true,
  },
  {
    id: 'reaction-light',
    skill: 'REACTION',
    name: 'REACTION LIGHT',
    shortName: 'REACT',
    tagline: 'Wait for green. Tap. Pure milliseconds.',
    description:
      'The screen sits red. After a random delay it flips green. Tap as fast as you can. Tap during red and you bust. Round 6+ adds distractor flashes — pink, orange, yellow — that aren\'t green but love to fake out your finger.',
    rules: [
      'Hold still. Tap the moment it turns green',
      'Tap during red = disqualified',
      'Round 6+: pink / orange / yellow distractors flash — DON\'T tap',
      'Distractor taps are neutral but slow you down for green',
      'Average of 10 rounds is your score',
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
    id: 'spin-360',
    skill: 'CHAOS',
    hidden: true, // benched for launch — returns as a content-drop cabinet
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
];

export const gamesById: Record<string, Game> = Object.fromEntries(
  games.map((g) => [g.id, g]),
);

export function getGame(id: string): Game | undefined {
  return gamesById[id];
}
