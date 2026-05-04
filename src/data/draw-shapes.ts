// Draw It — shape catalog, templates, and scoring.
//
// Each shape produces a "template" — a normalized polyline in the unit
// square [-1, 1]² — that:
//   1. Defines the target preview the player sees.
//   2. Acts as the reference for template-match scoring.
//
// Scoring methods:
//   - CIRCLE: coefficient-of-variation of distances from centroid. Pure
//     roundness; orientation doesn't matter.
//   - POLYGON: corner detection at high-curvature points + closure
//     check. Driven by `expectedCorners`.
//   - TEMPLATE: arc-length resample player + template to N points,
//     center / normalize both, then take mean point-to-point distance
//     across forward/reverse and a few cyclic shifts.
//
// Buffers were tightened in v2 — accuracy windows are smaller across
// the board so a sloppy attempt won't comfortably score above the miss
// threshold.

export type Pt = { x: number; y: number };

export type ShapeKind =
  // Tier 1 — warm-up basics.
  | 'CIRCLE'
  | 'SQUARE'
  | 'TRIANGLE'
  // Tier 2 — geometric.
  | 'DIAMOND'
  | 'PENTAGON'
  | 'HEXAGON'
  | 'ELLIPSE'
  | 'TRAPEZOID'
  | 'SEMICIRCLE'
  // Tier 3 — more sides / asymmetry.
  | 'OCTAGON'
  | 'STAR_5'
  | 'PLUS'
  | 'ARROW_UP'
  | 'ARROW_RIGHT'
  | 'HOUSE'
  | 'HOURGLASS'
  | 'CHECKMARK'
  // Tier 4 — curves and complex.
  | 'HEART'
  | 'CRESCENT'
  | 'INFINITY'
  | 'LIGHTNING'
  | 'SPIRAL'
  | 'WAVE'
  | 'ZIGZAG'
  | 'LETTER_S'
  | 'LETTER_Z'
  | 'TEARDROP'
  | 'HEXAGRAM';

export type ScoreMethod = 'CIRCLE' | 'POLYGON' | 'TEMPLATE';

export type ShapeDef = {
  kind: ShapeKind;
  label: string;
  /** 1 (warm-up) → 4 (master). */
  difficulty: 1 | 2 | 3 | 4;
  scoreMethod: ScoreMethod;
  /** For POLYGON: expected corner count. */
  expectedCorners?: number;
  /** Whether the path closes back to start. */
  closed: boolean;
  /** Generates the unit-space template. */
  template: (n?: number) => Pt[];
};

const TEMPLATE_N = 64;

export const SHAPES: Record<ShapeKind, ShapeDef> = {
  CIRCLE: {
    kind: 'CIRCLE',
    label: 'CIRCLE',
    difficulty: 1,
    scoreMethod: 'CIRCLE',
    closed: true,
    template: (n = TEMPLATE_N) => makeCircle(n),
  },
  SQUARE: {
    kind: 'SQUARE',
    label: 'SQUARE',
    difficulty: 1,
    scoreMethod: 'POLYGON',
    expectedCorners: 4,
    closed: true,
    template: (n = TEMPLATE_N) => makeRegularPolygon(4, n, Math.PI / 4),
  },
  TRIANGLE: {
    kind: 'TRIANGLE',
    label: 'TRIANGLE',
    difficulty: 1,
    scoreMethod: 'POLYGON',
    expectedCorners: 3,
    closed: true,
    template: (n = TEMPLATE_N) => makeRegularPolygon(3, n, -Math.PI / 2),
  },
  DIAMOND: {
    kind: 'DIAMOND',
    label: 'DIAMOND',
    difficulty: 2,
    scoreMethod: 'POLYGON',
    expectedCorners: 4,
    closed: true,
    template: (n = TEMPLATE_N) => makeRegularPolygon(4, n, -Math.PI / 2),
  },
  PENTAGON: {
    kind: 'PENTAGON',
    label: 'PENTAGON',
    difficulty: 2,
    scoreMethod: 'POLYGON',
    expectedCorners: 5,
    closed: true,
    template: (n = TEMPLATE_N) => makeRegularPolygon(5, n, -Math.PI / 2),
  },
  HEXAGON: {
    kind: 'HEXAGON',
    label: 'HEXAGON',
    difficulty: 2,
    scoreMethod: 'POLYGON',
    expectedCorners: 6,
    closed: true,
    template: (n = TEMPLATE_N) => makeRegularPolygon(6, n, 0),
  },
  ELLIPSE: {
    kind: 'ELLIPSE',
    label: 'ELLIPSE',
    difficulty: 2,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeEllipse(0.6, n),
  },
  TRAPEZOID: {
    kind: 'TRAPEZOID',
    label: 'TRAPEZOID',
    difficulty: 2,
    scoreMethod: 'POLYGON',
    expectedCorners: 4,
    closed: true,
    template: (n = TEMPLATE_N) => makeTrapezoid(n),
  },
  SEMICIRCLE: {
    kind: 'SEMICIRCLE',
    label: 'SEMICIRCLE',
    difficulty: 2,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeSemicircle(n),
  },
  OCTAGON: {
    kind: 'OCTAGON',
    label: 'OCTAGON',
    difficulty: 3,
    scoreMethod: 'POLYGON',
    expectedCorners: 8,
    closed: true,
    template: (n = TEMPLATE_N) => makeRegularPolygon(8, n, Math.PI / 8),
  },
  STAR_5: {
    kind: 'STAR_5',
    label: '5-POINT STAR',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeStar(5, 0.42, n),
  },
  PLUS: {
    kind: 'PLUS',
    label: 'PLUS',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makePlus(0.42, n),
  },
  ARROW_UP: {
    kind: 'ARROW_UP',
    label: 'ARROW UP',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeArrowUp(n),
  },
  ARROW_RIGHT: {
    kind: 'ARROW_RIGHT',
    label: 'ARROW RIGHT',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeArrowRight(n),
  },
  HOUSE: {
    kind: 'HOUSE',
    label: 'HOUSE',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeHouse(n),
  },
  HOURGLASS: {
    kind: 'HOURGLASS',
    label: 'HOURGLASS',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeHourglass(n),
  },
  CHECKMARK: {
    kind: 'CHECKMARK',
    label: 'CHECKMARK',
    difficulty: 3,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeCheckmark(n),
  },
  HEART: {
    kind: 'HEART',
    label: 'HEART',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeHeart(n),
  },
  CRESCENT: {
    kind: 'CRESCENT',
    label: 'CRESCENT',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeCrescent(n),
  },
  INFINITY: {
    kind: 'INFINITY',
    label: 'INFINITY',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeInfinity(n),
  },
  LIGHTNING: {
    kind: 'LIGHTNING',
    label: 'LIGHTNING',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeLightning(n),
  },
  SPIRAL: {
    kind: 'SPIRAL',
    label: 'SPIRAL',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeSpiral(n),
  },
  WAVE: {
    kind: 'WAVE',
    label: 'WAVE',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeWave(n),
  },
  ZIGZAG: {
    kind: 'ZIGZAG',
    label: 'ZIGZAG',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeZigzag(n),
  },
  LETTER_S: {
    kind: 'LETTER_S',
    label: 'LETTER S',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeLetterS(n),
  },
  LETTER_Z: {
    kind: 'LETTER_Z',
    label: 'LETTER Z',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: false,
    template: (n = TEMPLATE_N) => makeLetterZ(n),
  },
  TEARDROP: {
    kind: 'TEARDROP',
    label: 'TEARDROP',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeTeardrop(n),
  },
  HEXAGRAM: {
    kind: 'HEXAGRAM',
    label: 'HEXAGRAM',
    difficulty: 4,
    scoreMethod: 'TEMPLATE',
    closed: true,
    template: (n = TEMPLATE_N) => makeStar(6, 0.55, n),
  },
};

/** Shapes per difficulty tier — used to gate progression. */
export const TIER_POOLS: Record<1 | 2 | 3 | 4, ShapeKind[]> = {
  1: ['CIRCLE', 'SQUARE', 'TRIANGLE'],
  2: ['DIAMOND', 'PENTAGON', 'HEXAGON', 'ELLIPSE', 'TRAPEZOID', 'SEMICIRCLE'],
  3: [
    'OCTAGON',
    'STAR_5',
    'PLUS',
    'ARROW_UP',
    'ARROW_RIGHT',
    'HOUSE',
    'HOURGLASS',
    'CHECKMARK',
  ],
  4: [
    'HEART',
    'CRESCENT',
    'INFINITY',
    'LIGHTNING',
    'SPIRAL',
    'WAVE',
    'ZIGZAG',
    'LETTER_S',
    'LETTER_Z',
    'TEARDROP',
    'HEXAGRAM',
  ],
};

/**
 * Shapes that can be used for BISECT bonus rounds. Any shape works
 * geometrically (the player can cut anything in half through its
 * centroid), but we pick recognizable ones with clear silhouettes.
 */
export const BISECT_SHAPES: ShapeKind[] = [
  'CIRCLE',
  'SQUARE',
  'TRIANGLE',
  'DIAMOND',
  'PENTAGON',
  'HEXAGON',
  'OCTAGON',
  'ELLIPSE',
  'STAR_5',
  'HEART',
  'PLUS',
  'HOUSE',
  'TEARDROP',
  'HEXAGRAM',
];

// ---------------------------------------------------------------------
// Template generators — all return points in [-1, 1]² unit space.
// ---------------------------------------------------------------------

function makeCircle(n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return out;
}

function makeRegularPolygon(sides: number, n: number, startAngle: number): Pt[] {
  const verts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i / sides) * Math.PI * 2;
    verts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return resampleByArcLength(verts, n, true);
}

function makeStar(points: number, innerRatio: number, n: number): Pt[] {
  const verts: Pt[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = -Math.PI / 2 + (i / total) * Math.PI * 2;
    const r = i % 2 === 0 ? 1.0 : innerRatio;
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return resampleByArcLength(verts, n, true);
}

function makePlus(armRatio: number, n: number): Pt[] {
  const w = armRatio;
  const verts: Pt[] = [
    { x: -w, y: -1 }, { x: w, y: -1 },
    { x: w, y: -w }, { x: 1, y: -w },
    { x: 1, y: w }, { x: w, y: w },
    { x: w, y: 1 }, { x: -w, y: 1 },
    { x: -w, y: w }, { x: -1, y: w },
    { x: -1, y: -w }, { x: -w, y: -w },
  ];
  return resampleByArcLength(verts, n, true);
}

function makeArrowUp(n: number): Pt[] {
  const verts: Pt[] = [
    { x: 0, y: -1 },
    { x: 0.6, y: -0.35 },
    { x: 0.25, y: -0.35 },
    { x: 0.25, y: 1 },
    { x: -0.25, y: 1 },
    { x: -0.25, y: -0.35 },
    { x: -0.6, y: -0.35 },
  ];
  return resampleByArcLength(verts, n, true);
}

function makeArrowRight(n: number): Pt[] {
  const verts: Pt[] = [
    { x: 1, y: 0 },
    { x: 0.35, y: -0.6 },
    { x: 0.35, y: -0.25 },
    { x: -1, y: -0.25 },
    { x: -1, y: 0.25 },
    { x: 0.35, y: 0.25 },
    { x: 0.35, y: 0.6 },
  ];
  return resampleByArcLength(verts, n, true);
}

function makeHouse(n: number): Pt[] {
  const verts: Pt[] = [
    { x: 0, y: -1 },
    { x: 0.7, y: -0.35 },
    { x: 0.7, y: 1 },
    { x: -0.7, y: 1 },
    { x: -0.7, y: -0.35 },
  ];
  return resampleByArcLength(verts, n, true);
}

function makeTrapezoid(n: number): Pt[] {
  const verts: Pt[] = [
    { x: -0.55, y: -1 },
    { x: 0.55, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
  return resampleByArcLength(verts, n, true);
}

function makeEllipse(yScale: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: Math.cos(a), y: Math.sin(a) * yScale });
  }
  return normalizeBounds(out);
}

function makeSemicircle(n: number): Pt[] {
  const out: Pt[] = [];
  // Arc from left across the top to right.
  const arcN = Math.floor(n * 0.7);
  for (let i = 0; i <= arcN; i++) {
    const t = i / arcN;
    const a = Math.PI - t * Math.PI; // π → 0
    out.push({ x: Math.cos(a), y: -Math.sin(a) });
  }
  // Bottom edge from right back to left.
  const lineN = n - arcN - 1;
  for (let i = 1; i <= lineN; i++) {
    const t = i / lineN;
    out.push({ x: 1 - 2 * t, y: 0 });
  }
  return normalizeBounds(out);
}

function makeHourglass(n: number): Pt[] {
  // Hourglass / bowtie: top edge → diagonal to opposite-bottom corner →
  // bottom edge → diagonal back. Resamples cleanly thanks to the closed
  // resampler picking up the crossover.
  const verts: Pt[] = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ];
  return resampleByArcLength(verts, n, true);
}

function makeCheckmark(n: number): Pt[] {
  const verts: Pt[] = [
    { x: -0.95, y: 0 },
    { x: -0.35, y: 0.7 },
    { x: 0.95, y: -0.65 },
  ];
  return resampleByArcLength(verts, n, false);
}

function makeHeart(n: number): Pt[] {
  const raw: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      -(13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t));
    raw.push({ x, y });
  }
  return normalizeBounds(raw);
}

function makeCrescent(n: number): Pt[] {
  const out: Pt[] = [];
  // Outer arc: top → left → bottom (left half of the outer circle).
  const outerN = Math.floor(n * 0.55);
  for (let i = 0; i < outerN; i++) {
    const t = i / outerN;
    const a = -Math.PI / 2 - t * Math.PI;
    out.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  // Inner arc: back from bottom to top, peaking to the right of center.
  const innerN = n - outerN;
  for (let i = 0; i < innerN; i++) {
    const t = i / innerN;
    out.push({
      x: 0.6 * Math.sin((1 - t) * Math.PI),
      y: 1 - 2 * t,
    });
  }
  return normalizeBounds(out);
}

function makeInfinity(n: number): Pt[] {
  const raw: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    raw.push({
      x: Math.cos(t) / denom,
      y: (Math.sin(t) * Math.cos(t)) / denom,
    });
  }
  return normalizeBounds(raw);
}

function makeLightning(n: number): Pt[] {
  const verts: Pt[] = [
    { x: 0.15, y: -1 },
    { x: -0.45, y: -0.15 },
    { x: 0.0, y: -0.05 },
    { x: -0.35, y: 0.45 },
    { x: 0.25, y: 1 },
  ];
  return resampleByArcLength(verts, n, false);
}

function makeSpiral(n: number): Pt[] {
  const out: Pt[] = [];
  const turns = 2.25;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = -Math.PI / 2 + t * Math.PI * 2 * turns;
    const r = t;
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return out;
}

function makeWave(n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({
      x: -1 + 2 * t,
      y: 0.55 * Math.sin(t * Math.PI * 2 * 2.25),
    });
  }
  return out;
}

function makeZigzag(n: number): Pt[] {
  const verts: Pt[] = [
    { x: -1, y: -0.6 },
    { x: -0.5, y: 0.6 },
    { x: 0, y: -0.6 },
    { x: 0.5, y: 0.6 },
    { x: 1, y: -0.6 },
  ];
  return resampleByArcLength(verts, n, false);
}

function makeLetterS(n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({
      x: 0.7 * Math.sin(t * Math.PI * 2),
      y: -1 + 2 * t,
    });
  }
  return out;
}

function makeLetterZ(n: number): Pt[] {
  const verts: Pt[] = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ];
  return resampleByArcLength(verts, n, false);
}

function makeTeardrop(n: number): Pt[] {
  const raw: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const half = Math.sin(t / 2);
    raw.push({
      x: Math.sin(t) * half * half,
      y: -Math.cos(t),
    });
  }
  return normalizeBounds(raw);
}

// ---------------------------------------------------------------------
// Geometric helpers
// ---------------------------------------------------------------------

export function resampleByArcLength(
  path: Pt[],
  n: number,
  closed: boolean,
): Pt[] {
  if (path.length < 2) return new Array(n).fill(path[0] ?? { x: 0, y: 0 });
  const segs: Array<{ from: Pt; to: Pt; len: number }> = [];
  let totalLen = 0;
  const stop = closed ? path.length : path.length - 1;
  for (let i = 0; i < stop; i++) {
    const from = path[i];
    const to = path[(i + 1) % path.length];
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len > 0) {
      segs.push({ from, to, len });
      totalLen += len;
    }
  }
  if (segs.length === 0) {
    return new Array(n).fill(path[0]);
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const target = closed ? (i / n) * totalLen : (i / (n - 1)) * totalLen;
    let acc = 0;
    let s = 0;
    while (s < segs.length - 1 && acc + segs[s].len < target) {
      acc += segs[s].len;
      s++;
    }
    const seg = segs[s];
    const t = clamp((target - acc) / seg.len, 0, 1);
    out.push({
      x: seg.from.x + (seg.to.x - seg.from.x) * t,
      y: seg.from.y + (seg.to.y - seg.from.y) * t,
    });
  }
  return out;
}

export function normalizeBounds(pts: Pt[]): Pt[] {
  if (pts.length === 0) return pts;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1e-6);
  return pts.map((p) => ({
    x: (p.x - cx) / scale,
    y: (p.y - cy) / scale,
  }));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------

/** Render the template at canvas (cx, cy) with radius r. */
export function renderTemplate(
  kind: ShapeKind,
  cx: number,
  cy: number,
  r: number,
  n: number = TEMPLATE_N,
): Pt[] {
  const tpl = SHAPES[kind].template(n);
  return tpl.map((p) => ({ x: cx + p.x * r, y: cy + p.y * r }));
}

export function scoreShape(
  kind: ShapeKind,
  playerPath: Pt[],
  canvasW?: number,
  canvasH?: number,
): number {
  if (playerPath.length < 5) return 0;
  const def = SHAPES[kind];

  let raw = 0;
  switch (def.scoreMethod) {
    case 'CIRCLE':
      raw = scoreCircle(playerPath);
      break;
    case 'POLYGON':
      raw = scorePolygon(playerPath, def.expectedCorners ?? 4);
      break;
    case 'TEMPLATE':
      raw = scoreTemplate(playerPath, def.template(), def.closed);
      break;
  }

  // Position + size guard. The CIRCLE / POLYGON / TEMPLATE scorers are
  // intentionally position- and (mostly) size-invariant so that "did
  // you draw a triangle" doesn't depend on where your finger landed.
  // The downside: a tiny square drawn in the upper-left corner scores
  // the same as a centered, full-sized one. This guard caps that off
  // by gently penalizing drawings whose centroid drifts far from the
  // canvas center or whose bounding box is far off the target radius.
  // Generous bands so a slightly-off drawing isn't punished — only
  // egregiously misplaced or wrong-size attempts get docked.
  if (canvasW != null && canvasH != null) {
    raw = Math.round(raw * positionAndSizeFactor(playerPath, canvasW, canvasH));
  }
  return raw;
}

/**
 * Multiplier in [0, 1] for how well the player's drawing matches the
 * canvas position and size of the target preview.
 *
 * - Position: full credit if drawing centroid is within 0.6 × target
 *   radius of canvas center; ramps to zero by 1.2 × target radius.
 * - Size: full credit at 0.7-1.6× target radius; ramps to zero outside
 *   [0.4, 2.4]. Tolerances are deliberately wide on the high end since
 *   "drew it bigger" is a less common failure than "drew it tiny."
 */
export function positionAndSizeFactor(
  path: Pt[],
  canvasW: number,
  canvasH: number,
): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const playerCx = (minX + maxX) / 2;
  const playerCy = (minY + maxY) / 2;
  const playerRadius = Math.max((maxX - minX) / 2, (maxY - minY) / 2);

  const targetCx = canvasW / 2;
  const targetCy = canvasH / 2;
  const targetRadius = Math.min(canvasW, canvasH) * 0.36;

  const centerDist = Math.hypot(playerCx - targetCx, playerCy - targetCy);
  // Full credit until 0.6r off center, then linear to 0 at 1.2r.
  let positionScore: number;
  if (centerDist <= targetRadius * 0.6) positionScore = 1;
  else positionScore = clamp(1 - (centerDist - targetRadius * 0.6) / (targetRadius * 0.6), 0, 1);

  const ratio = playerRadius / Math.max(targetRadius, 1);
  let sizeScore: number;
  if (ratio < 0.4 || ratio > 2.4) sizeScore = 0;
  else if (ratio < 0.7) sizeScore = (ratio - 0.4) / 0.3;
  else if (ratio > 1.6) sizeScore = (2.4 - ratio) / 0.8;
  else sizeScore = 1;

  return positionScore * sizeScore;
}

// --- CIRCLE: coefficient of variation of distances from centroid -----
//
// Tightened in v2: cv tolerance lowered from 0.35 → 0.20 so a wonky
// circle no longer sails through.
function scoreCircle(path: Pt[]): number {
  const cx = mean(path.map((p) => p.x));
  const cy = mean(path.map((p) => p.y));
  const dists = path.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const m = mean(dists);
  if (m < 5) return 0;
  const sd = Math.sqrt(mean(dists.map((d) => (d - m) ** 2)));
  const cv = sd / m;
  const closure = Math.hypot(
    path[0].x - path[path.length - 1].x,
    path[0].y - path[path.length - 1].y,
  );
  const closureScore = clamp(1 - closure / (m * 0.5), 0, 1);
  // cv tolerance loosened from 0.20 → 0.25 — hand-drawn circles
  // typically land in 0.10–0.20 range; 0.20 was too punishing for
  // anything but a near-perfect attempt.
  const roundness = clamp(1 - cv / 0.25, 0, 1);
  return Math.round(1000 * roundness * (0.6 + 0.4 * closureScore));
}

// --- POLYGON: corner detection + closure + edge straightness ---------
//
// Tightened: closure window narrowed and corner-count penalties
// steepened.
function scorePolygon(path: Pt[], expectedCorners: number): number {
  const resampled = resampleByArcLength(path, 80, false);
  const corners = countCorners(resampled);
  const cornerScore = scoreCornerCount(corners, expectedCorners);

  const start = resampled[0];
  const end = resampled[resampled.length - 1];
  const totalSpan = boundingDiagonal(resampled);
  const closure = Math.hypot(start.x - end.x, start.y - end.y);
  const closureScore = clamp(1 - closure / (totalSpan * 0.13), 0, 1);

  const straightness = clamp(corners / (corners + 3), 0, 1);

  return Math.round(
    1000 * (0.55 * cornerScore + 0.30 * closureScore + 0.15 * straightness),
  );
}

function countCorners(path: Pt[]): number {
  const window = 4;
  let count = 0;
  let lastCornerIdx = -100;
  for (let i = window; i < path.length - window; i++) {
    const a = sub(path[i], path[i - window]);
    const b = sub(path[i + window], path[i]);
    const angA = Math.atan2(a.y, a.x);
    const angB = Math.atan2(b.y, b.x);
    const d = Math.abs(angDiff(angA, angB));
    if (d > Math.PI / 5 && i - lastCornerIdx > window) {
      count++;
      lastCornerIdx = i;
    }
  }
  return count;
}

function scoreCornerCount(detected: number, expected: number): number {
  const diff = Math.abs(detected - expected);
  if (diff === 0) return 1;
  if (diff === 1) return 0.55;
  if (diff === 2) return 0.20;
  return 0.05;
}

// --- TEMPLATE: arc-length resample + mean point distance -------------
//
// Tightened: distance window narrowed from [0.08, 0.45] to [0.05, 0.30]
// so a sloppy attempt won't comfortably land above 250.
function scoreTemplate(path: Pt[], template: Pt[], closed: boolean): number {
  const N = template.length;
  const resampled = resampleByArcLength(path, N, closed);
  const playerNorm = normalizeBounds(resampled);
  const tplNorm = normalizeBounds(template);

  let bestDist = Infinity;
  if (closed) {
    const shifts = [
      0,
      Math.floor(N / 8),
      Math.floor(N / 4),
      Math.floor(N / 2),
      -Math.floor(N / 8),
      -Math.floor(N / 4),
    ];
    for (const s of shifts) {
      const dF = meanDistanceShifted(playerNorm, tplNorm, s, false);
      const dR = meanDistanceShifted(playerNorm, tplNorm, s, true);
      if (dF < bestDist) bestDist = dF;
      if (dR < bestDist) bestDist = dR;
    }
  } else {
    const dF = meanDistanceShifted(playerNorm, tplNorm, 0, false);
    const dR = meanDistanceShifted(playerNorm, tplNorm, 0, true);
    bestDist = Math.min(dF, dR);
  }

  const score = Math.round(1000 * (1 - (bestDist - 0.05) / 0.25));
  return clamp(score, 0, 1000);
}

function meanDistanceShifted(
  a: Pt[],
  b: Pt[],
  shift: number,
  reverse: boolean,
): number {
  const N = a.length;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const idx = ((i + shift) % N + N) % N;
    const j = reverse ? (N - 1 - idx) : idx;
    sum += Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
  }
  return sum / N;
}

// --- BISECT scoring (free-angle) -------------------------------------
//
// The player draws ANY straight line through the shape — vertical,
// diagonal, horizontal, doesn't matter. We:
//   1. Fit a line to the player's points (PCA / dominant eigenvector).
//   2. Score how STRAIGHT the path is (mean perpendicular distance from
//      the path to the fitted line — should be tiny).
//   3. Score how close the line passes to the canvas center (where the
//      shape is centered — a true bisector passes through the centroid).
//   4. Score how much of the diameter the line covers (a half-line that
//      only crosses one side doesn't bisect; we want full diameter).
// All three multiply, so failing any one craters the score.
//
// Returns 0–1500 (bonus rounds pay more than normal rounds).
//
export type FittedLine = {
  centerX: number;
  centerY: number;
  dirX: number;
  dirY: number;
};

export function fitLine(path: Pt[]): FittedLine {
  let sx = 0, sy = 0;
  for (const p of path) {
    sx += p.x;
    sy += p.y;
  }
  const cx = sx / path.length;
  const cy = sy / path.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of path) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const lambda = tr / 2 + disc;
  let dx = sxy;
  let dy = lambda - sxx;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    // Degenerate (all points equal or colinear with x-axis variance only)
    if (sxx >= syy) {
      dx = 1;
      dy = 0;
    } else {
      dx = 0;
      dy = 1;
    }
  } else {
    dx /= len;
    dy /= len;
  }
  return { centerX: cx, centerY: cy, dirX: dx, dirY: dy };
}

export function perpDistFromLine(p: Pt, line: FittedLine): number {
  return Math.abs(
    (p.x - line.centerX) * -line.dirY + (p.y - line.centerY) * line.dirX,
  );
}

export function scoreBisect(
  path: Pt[],
  canvasW: number,
  canvasH: number,
  shapeRadiusPx: number,
): number {
  if (path.length < 4) return 0;

  const line = fitLine(path);

  // 1. Straightness — average perpendicular residual.
  let totalResidual = 0;
  for (const p of path) totalResidual += perpDistFromLine(p, line);
  const avgResidual = totalResidual / path.length;
  // Tighter than v1: 16px max residual instead of "anything roughly straight".
  const straightnessScore = clamp(1 - avgResidual / 16, 0, 1);

  // 2. Line passes through canvas center.
  const center: Pt = { x: canvasW / 2, y: canvasH / 2 };
  const distToCenter = perpDistFromLine(center, line);
  const centerScore = clamp(1 - distToCenter / 22, 0, 1);

  // 3. Length spans the diameter. Use straight-line distance from
  // the first to the last point (the player's stroke endpoints).
  const start = path[0];
  const end = path[path.length - 1];
  const lineLength = Math.hypot(end.x - start.x, end.y - start.y);
  const expectedLength = shapeRadiusPx * 2;
  const lengthScore = clamp(lineLength / (expectedLength * 0.9), 0, 1);

  return Math.round(1500 * straightnessScore * centerScore * lengthScore);
}

// ---------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

function angDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function boundingDiagonal(pts: Pt[]): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY) || 1;
}

// ---------------------------------------------------------------------
// Round scheduling for infinite mode
// ---------------------------------------------------------------------

/** Tier (1..4) based on round number. */
export function tierForRound(round: number): 1 | 2 | 3 | 4 {
  // Round numbers that are bonus rounds don't count toward tier progression.
  const effective = round - Math.floor(round / 4);
  if (effective <= 3) return 1;
  if (effective <= 7) return 2;
  if (effective <= 12) return 3;
  return 4;
}

/** Every 4th round is a BISECT bonus. */
export function isBonusRound(round: number): boolean {
  return round % 4 === 0;
}
