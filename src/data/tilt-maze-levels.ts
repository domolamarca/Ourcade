// Tilt Maze level definitions.
//
// Each level has:
//   - path: a polyline the ball must roll along (start = path[0], end = last)
//   - width: stroke width of the path in pixels (proximity-to-edge math
//             uses width/2 as the half-width tolerance)
//   - hazards: optional array of swinging pendulum obstacles
//
// Difficulty curve:
//   Levels 1-3: simple geometric shapes, wide path, no hazards (warm-up)
//   Levels 4-5: tighter S-curves and zigzags
//   Levels 6-7: spirals, narrower
//   Levels 8-10: hazards added, mixed shapes, narrow path

export type Point = {
  x: number;
  y: number;
  /**
   * Optional per-waypoint width override. When set, the path narrows or
   * widens to this value at this point; segments interpolate between
   * adjacent points' widths. Falls back to the level's default `width`.
   */
  width?: number;
};

export type Hazard = {
  pivot: Point;
  armLength: number;
  radius: number;
  periodMs: number;
  phase?: number; // offset 0..1 to desync multiple hazards
  amplitude?: number; // peak swing angle in radians, default ~60°
};

/**
 * Static surface effects placed along the path. Tiles render as oriented
 * rectangles aligned with the path's tangent at `pos`, with width that
 * matches the path's local width. `length` is how far the tile stretches
 * along the path direction. Boost (yellow, >>) accelerates; slow (purple,
 * <<) drags. Effect applies as long as the ball's projection along the
 * path tangent at the tile center is within ±length/2.
 */
export type TileEffect = {
  pos: Point;
  length: number;
  kind: 'boost' | 'slow';
};

export type Level = {
  name: string;
  path: Point[];
  /** Default path half-width; per-point widths in `path` override this. */
  width: number; // px
  hazards: Hazard[];
  tiles?: TileEffect[];
};

// Shared coordinate space. Bumped from 360×600 to 380×720 so the SVG
// viewBox better matches a typical iPhone aspect ratio (the play area
// now flex-fills the screen via the host View).
export const LEVEL_VIEW_W = 380;
export const LEVEL_VIEW_H = 720;

// ---- Procedural spiral helper ----------------------------------------
// Generates an inward spiral path. center is the spiral's middle, startR
// is the outer radius (where the player starts), endR the inner radius
// (where they finish). Turns is the number of full revolutions.
function spiral(opts: {
  center: Point;
  startR: number;
  endR: number;
  turns: number;
  startAngle?: number;
  segments?: number;
  clockwise?: boolean;
}): Point[] {
  const segments = opts.segments ?? 60;
  const startAngle = opts.startAngle ?? -Math.PI / 2; // start at top
  const dir = opts.clockwise === false ? -1 : 1;
  const out: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = opts.startR + (opts.endR - opts.startR) * t;
    const a = startAngle + dir * t * opts.turns * 2 * Math.PI;
    out.push({
      x: opts.center.x + Math.cos(a) * r,
      y: opts.center.y + Math.sin(a) * r,
    });
  }
  return out;
}

// Center of the play area, used for spiral generation.
const CX = LEVEL_VIEW_W / 2; // 190
const CY = LEVEL_VIEW_H / 2; // 360
// Maximum spiral radius that stays on screen with margin for path width.
const MAX_SPIRAL_R = 145;

export const LEVELS: Level[] = [
  // --- LEVEL 1: a gentle horizontal sweep -----------------------------
  {
    name: 'WARM-UP',
    width: 84,
    path: [
      { x: 60, y: 360 },
      { x: 320, y: 360 },
    ],
    hazards: [],
  },

  // --- LEVEL 2: L-turn — boost on the long straight, NOT in the corner
  {
    name: 'CORNER',
    width: 72,
    path: [
      { x: 60, y: 90 },
      { x: 60, y: 520 },
      { x: 320, y: 520 },
    ],
    hazards: [],
    tiles: [
      // Mid-vertical straight — easy to ride straight through.
      { pos: { x: 60, y: 280 }, length: 70, kind: 'boost' },
    ],
  },

  // --- LEVEL 3: S-curve with a narrow neck ----------------------------
  {
    name: 'CHOKE',
    width: 64,
    path: [
      { x: 60, y: 90 },
      { x: 240, y: 90 },
      { x: 240, y: 280, width: 38 },
      { x: 60, y: 360, width: 38 },
      { x: 60, y: 600 },
      { x: 320, y: 600 },
    ],
    hazards: [],
    tiles: [
      // Slow patch on the neck approach — straight section before the squeeze.
      { pos: { x: 240, y: 200 }, length: 50, kind: 'slow' },
    ],
  },

  // --- LEVEL 4: zigzag with mixed tiles -------------------------------
  {
    name: 'ZIGZAG',
    width: 50,
    path: [
      { x: 60, y: 90 },
      { x: 320, y: 90 },
      { x: 60, y: 230 },
      { x: 320, y: 230 },
      { x: 60, y: 370 },
      { x: 320, y: 370 },
      { x: 60, y: 510 },
      { x: 320, y: 510 },
      { x: 320, y: 640 },
    ],
    hazards: [],
    tiles: [
      { pos: { x: 200, y: 90 },  length: 80, kind: 'boost' },
      { pos: { x: 200, y: 370 }, length: 80, kind: 'boost' },
      { pos: { x: 200, y: 230 }, length: 60, kind: 'slow' },
      { pos: { x: 200, y: 510 }, length: 60, kind: 'slow' },
    ],
  },

  // --- LEVEL 5: 2.5-turn spiral, fits the new view dims ---------------
  {
    name: 'WHIRL',
    width: 50,
    path: spiral({
      center: { x: CX, y: CY },
      startR: MAX_SPIRAL_R,
      endR: 28,
      turns: 2.5,
      segments: 90,
    }),
    hazards: [],
    tiles: [
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 28, 2.5, 0.15), length: 50, kind: 'boost' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 28, 2.5, 0.55), length: 40, kind: 'boost' },
    ],
  },

  // --- LEVEL 6: tight spiral with progressive narrowing ---------------
  {
    name: 'TIGHT WHIRL',
    width: 44,
    path: spiral({
      center: { x: CX, y: CY },
      startR: MAX_SPIRAL_R,
      endR: 24,
      turns: 3,
      segments: 110,
    }).map((p, i, arr) => {
      const t = i / (arr.length - 1);
      const w = 44 - t * 14; // 44 outer → 30 near center
      return { ...p, width: w };
    }),
    hazards: [],
    tiles: [
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 24, 3, 0.7), length: 40, kind: 'slow' },
    ],
  },

  // --- LEVEL 7: long path with first pendulum -------------------------
  {
    name: 'PENDULUM',
    width: 54,
    path: [
      { x: 60, y: 90 },
      { x: 320, y: 90 },
      { x: 320, y: 240 },
      { x: 60, y: 240 },
      { x: 60, y: 410 },
      { x: 320, y: 410 },
      { x: 320, y: 600, width: 40 },
      { x: 60, y: 660, width: 40 },
    ],
    hazards: [
      { pivot: { x: CX, y: 110 }, armLength: 100, radius: 14, periodMs: 2000 },
    ],
    tiles: [
      { pos: { x: 200, y: 410 }, length: 70, kind: 'boost' },
      { pos: { x: 200, y: 240 }, length: 60, kind: 'slow' },
    ],
  },

  // --- LEVEL 8: spiral + hazards + tiles ------------------------------
  {
    name: 'GAUNTLET',
    width: 46,
    path: spiral({
      center: { x: CX, y: CY },
      startR: MAX_SPIRAL_R,
      endR: 30,
      turns: 2.5,
      segments: 90,
    }),
    hazards: [
      { pivot: { x: CX, y: 80 },  armLength: 120, radius: 14, periodMs: 1700 },
      { pivot: { x: CX, y: 640 }, armLength: 120, radius: 14, periodMs: 2300, phase: 0.5 },
    ],
    tiles: [
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 30, 2.5, 0.10), length: 44, kind: 'boost' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 30, 2.5, 0.45), length: 40, kind: 'slow' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 30, 2.5, 0.75), length: 32, kind: 'slow' },
    ],
  },

  // --- LEVEL 9: corridor with narrow chokes + multiple pendulums ------
  {
    name: 'CROSSFIRE',
    width: 44,
    path: [
      { x: 60, y: 80 },
      { x: 60, y: 360, width: 30 },
      { x: 60, y: 640 },
      { x: 320, y: 640 },
      { x: 320, y: 360, width: 30 },
      { x: 320, y: 80 },
      { x: 200, y: 80 },
      { x: 200, y: 360 },
    ],
    hazards: [
      { pivot: { x: 60,  y: 240 }, armLength: 80,  radius: 12, periodMs: 1500 },
      { pivot: { x: 320, y: 460 }, armLength: 80,  radius: 12, periodMs: 1700, phase: 0.3 },
      { pivot: { x: 260, y: 80 },  armLength: 90,  radius: 12, periodMs: 1900, phase: 0.7 },
    ],
    tiles: [
      { pos: { x: 60, y: 500 },  length: 50, kind: 'boost' },
      { pos: { x: 320, y: 220 }, length: 50, kind: 'boost' },
    ],
  },

  // --- LEVEL 10: spiral with mixed everything -------------------------
  {
    name: 'TYRANT',
    width: 38,
    path: spiral({
      center: { x: CX, y: CY },
      startR: MAX_SPIRAL_R,
      endR: 22,
      turns: 3,
      segments: 110,
    }).map((p, i, arr) => {
      const t = i / (arr.length - 1);
      const w = 38 - t * 14;
      return { ...p, width: w };
    }),
    hazards: [
      { pivot: { x: CX, y: 60  }, armLength: 130, radius: 12, periodMs: 1400 },
      { pivot: { x: CX, y: 660 }, armLength: 130, radius: 12, periodMs: 1700, phase: 0.25 },
      { pivot: { x: 50,  y: CY }, armLength: 110, radius: 12, periodMs: 1900, phase: 0.5 },
      { pivot: { x: 330, y: CY }, armLength: 110, radius: 12, periodMs: 2100, phase: 0.75 },
    ],
    tiles: [
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 22, 3, 0.20), length: 40, kind: 'boost' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 22, 3, 0.55), length: 32, kind: 'slow' },
    ],
  },

  // ====================================================================
  // LATER GAME — levels 11+ keep raising the difficulty curve.
  // ====================================================================

  // --- LEVEL 11: gentle sine wave wide path ---------------------------
  {
    name: 'SINE WAVE',
    width: 56,
    path: Array.from({ length: 32 }, (_, i) => {
      const t = i / 31;
      return {
        x: 190 + Math.sin(t * Math.PI * 3) * 110,
        y: 80 + t * 580,
      };
    }),
    hazards: [],
    tiles: [
      { pos: { x: 290, y: 220 }, length: 50, kind: 'boost' },
      { pos: { x: 90,  y: 380 }, length: 50, kind: 'slow' },
      { pos: { x: 290, y: 560 }, length: 50, kind: 'boost' },
    ],
  },

  // --- LEVEL 12: H-bridge — cross from top to mid via two horizontals
  {
    name: 'H-BRIDGE',
    width: 48,
    path: [
      { x: 60, y: 100 },
      { x: 320, y: 100 },
      { x: 320, y: 600 },
      { x: 60, y: 600 },
      { x: 60, y: 360 },
      { x: 320, y: 360 },
    ],
    hazards: [
      { pivot: { x: CX, y: 360 }, armLength: 80, radius: 12, periodMs: 1700 },
    ],
    tiles: [
      { pos: { x: 200, y: 100 }, length: 70, kind: 'boost' },
      { pos: { x: 200, y: 600 }, length: 70, kind: 'slow' },
    ],
  },

  // --- LEVEL 13: BOG — patience test with chained slow patches --------
  {
    name: 'BOG',
    width: 56,
    path: [
      { x: 60, y: 100 },
      { x: 320, y: 100 },
      { x: 320, y: 360 },
      { x: 60, y: 360 },
      { x: 60, y: 620 },
      { x: 320, y: 620 },
    ],
    hazards: [],
    tiles: [
      { pos: { x: 200, y: 100 }, length: 80, kind: 'slow' },
      { pos: { x: 320, y: 230 }, length: 60, kind: 'slow' },
      { pos: { x: 200, y: 360 }, length: 80, kind: 'slow' },
      { pos: { x: 60,  y: 490 }, length: 60, kind: 'slow' },
      { pos: { x: 200, y: 620 }, length: 80, kind: 'slow' },
    ],
  },

  // --- LEVEL 14: NEEDLE — narrow tube with slight zigzag --------------
  {
    name: 'NEEDLE',
    width: 28,
    path: [
      { x: 60, y: 100 },
      { x: 320, y: 200 },
      { x: 60, y: 320 },
      { x: 320, y: 440 },
      { x: 60, y: 560 },
      { x: 320, y: 660 },
    ],
    hazards: [],
    tiles: [],
  },

  // --- LEVEL 15: RAPIDS — fast pendulums on a vertical run -----------
  {
    name: 'RAPIDS',
    width: 50,
    path: [
      { x: 60, y: 80 },
      { x: 60, y: 660 },
      { x: 320, y: 660 },
    ],
    hazards: [
      { pivot: { x: 130, y: 200 }, armLength: 70, radius: 12, periodMs: 1100 },
      { pivot: { x: 130, y: 360 }, armLength: 70, radius: 12, periodMs: 1100, phase: 0.5 },
      { pivot: { x: 130, y: 520 }, armLength: 70, radius: 12, periodMs: 1100, phase: 0.25 },
    ],
    tiles: [
      { pos: { x: 200, y: 660 }, length: 80, kind: 'boost' },
    ],
  },

  // --- LEVEL 16: TAPER — path narrows steadily from 70 to 26 ----------
  {
    name: 'TAPER',
    width: 70,
    path: Array.from({ length: 14 }, (_, i) => {
      const t = i / 13;
      return {
        x: 60 + t * 280,
        y: 100 + t * 540,
        width: 70 - t * 44,
      };
    }),
    hazards: [
      { pivot: { x: 110, y: 250 }, armLength: 60, radius: 12, periodMs: 1500 },
      { pivot: { x: 270, y: 500 }, armLength: 60, radius: 12, periodMs: 1700, phase: 0.5 },
    ],
    tiles: [
      { pos: { x: 130, y: 200 }, length: 50, kind: 'boost' },
    ],
  },

  // --- LEVEL 17: LOOP — rectangular outer loop with center dive ------
  {
    name: 'LOOP',
    width: 44,
    path: [
      { x: 60, y: 100 },
      { x: 320, y: 100 },
      { x: 320, y: 620 },
      { x: 60, y: 620 },
      { x: 60, y: 240 },
      { x: 200, y: 240 },
      { x: 200, y: 460 },
    ],
    hazards: [
      { pivot: { x: 190, y: 360 }, armLength: 100, radius: 14, periodMs: 1800 },
    ],
    tiles: [
      { pos: { x: 200, y: 100 }, length: 70, kind: 'boost' },
      { pos: { x: 320, y: 360 }, length: 60, kind: 'slow' },
    ],
  },

  // --- LEVEL 18: INFERNO — narrow zigzag with five tiles --------------
  {
    name: 'INFERNO',
    width: 36,
    path: [
      { x: 60, y: 80 },
      { x: 320, y: 80 },
      { x: 320, y: 240 },
      { x: 60, y: 240 },
      { x: 60, y: 460 },
      { x: 320, y: 460 },
      { x: 320, y: 660 },
      { x: 60, y: 660 },
    ],
    hazards: [
      { pivot: { x: 190, y: 360 }, armLength: 90, radius: 14, periodMs: 1500 },
      { pivot: { x: 190, y: 560 }, armLength: 90, radius: 14, periodMs: 1700, phase: 0.5 },
    ],
    tiles: [
      { pos: { x: 200, y: 80 },  length: 70, kind: 'boost' },
      { pos: { x: 320, y: 160 }, length: 50, kind: 'slow' },
      { pos: { x: 200, y: 240 }, length: 70, kind: 'boost' },
      { pos: { x: 200, y: 460 }, length: 70, kind: 'slow' },
      { pos: { x: 200, y: 660 }, length: 70, kind: 'boost' },
    ],
  },

  // --- LEVEL 19: TWIN — two spirals connected ------------------------
  {
    name: 'TWIN',
    width: 36,
    path: [
      // Spiral 1 inward
      ...spiral({ center: { x: 110, y: 220 }, startR: 80, endR: 12, turns: 1.5, segments: 50 }),
      // Connection
      { x: 270, y: 220 },
      // Spiral 2 outward (other direction)
      ...spiral({
        center: { x: 270, y: 500 },
        startR: 12,
        endR: 80,
        turns: 1.5,
        segments: 50,
        clockwise: false,
      }),
    ],
    hazards: [],
    tiles: [
      { pos: { x: 200, y: 220 }, length: 50, kind: 'boost' },
    ],
  },

  // --- LEVEL 20: SUPREME — variable width, hazards, dense tiles ------
  {
    name: 'SUPREME',
    width: 36,
    path: spiral({
      center: { x: CX, y: CY },
      startR: MAX_SPIRAL_R,
      endR: 18,
      turns: 4,
      segments: 140,
    }).map((p, i, arr) => {
      const t = i / (arr.length - 1);
      // Pulsing width: wider then narrower then narrower
      const w = 40 - t * 20 + Math.sin(t * Math.PI * 4) * 4;
      return { ...p, width: Math.max(20, w) };
    }),
    hazards: [
      { pivot: { x: CX, y: 50  }, armLength: 130, radius: 12, periodMs: 1300 },
      { pivot: { x: CX, y: 670 }, armLength: 130, radius: 12, periodMs: 1500, phase: 0.2 },
      { pivot: { x: 40,  y: CY }, armLength: 110, radius: 12, periodMs: 1700, phase: 0.4 },
      { pivot: { x: 340, y: CY }, armLength: 110, radius: 12, periodMs: 1900, phase: 0.6 },
      { pivot: { x: CX, y: CY }, armLength: 50,  radius: 10, periodMs: 1100, phase: 0.8 },
    ],
    tiles: [
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 18, 4, 0.15), length: 36, kind: 'boost' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 18, 4, 0.45), length: 28, kind: 'slow' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 18, 4, 0.70), length: 28, kind: 'slow' },
      { pos: spiralPointAt({ x: CX, y: CY }, MAX_SPIRAL_R, 18, 4, 0.85), length: 24, kind: 'boost' },
    ],
  },
];

/**
 * Returns the position at fractional distance `t` (0..1) along a spiral.
 * Used to place tile effects on a spiral's interior without manually
 * calculating coordinates.
 */
function spiralPointAt(
  center: Point,
  startR: number,
  endR: number,
  turns: number,
  t: number,
): Point {
  const r = startR + (endR - startR) * t;
  const a = -Math.PI / 2 + t * turns * 2 * Math.PI;
  return {
    x: center.x + Math.cos(a) * r,
    y: center.y + Math.sin(a) * r,
  };
}
