// GHOST — handler-mode stealth.
//
// You don't move the Runner. He walks his route. You clear his path.
// Tap threats to neutralize them (camera loops, vending distractions,
// laser flips, light switches), each costing one item from your finite
// budget. At certain waypoints the Runner pauses and a sensor mini-game
// takes over the screen — hold the phone still while he hides, or crack
// a safe by haptic feel alone. A guard near the Runner pulses the phone
// like a heartbeat. One detection ends the run.
//
// Score = base 10,000 + unspent_budget * 500 - elapsed_seconds * 30,
// floored at 0. Higher is better.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path as SvgPath,
  Rect,
} from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

// --- Map + tile constants ----------------------------------------------
const TILE_PX = 28;
const COLS = 12;
const ROWS = 18;
const MAP_W = COLS * TILE_PX; // 336
const MAP_H = ROWS * TILE_PX; // 504

// Movement / timing
const RUNNER_SPEED = 70; // px/s
const GUARD_SPEED = 45; // px/s
const TICK_MS = 33;
const CAMERA_LOOP_MS = 3000;
const VENDING_DISTRACT_MS = 5000;
const HIDE_HOLD_MS = 4000; // hold still this long
const HIDE_MOTION_THRESHOLD = 0.18; // accelerometer magnitude (in g, minus 1)
const HEARTBEAT_NEAR_TILES = 6;
const TAP_RADIUS_PX = 32;

const ACCENT = neon('purple');

// Vision cones
const CAMERA_FOV = Math.PI / 2.6; // ~70°
const CAMERA_RANGE = 4.5 * TILE_PX;
const GUARD_FOV = Math.PI / 2.2; // ~80°
const GUARD_RANGE = 5 * TILE_PX;

// Score
const BASE_SCORE = 10000;
const PER_BUDGET_BONUS = 500;
const PER_SECOND_PENALTY = 30;

// --- Level 1 grid: '.' = floor, '#' = wall ----------------------------
const GRID: string[] = [
  '............',
  'S...........',
  '............',
  '##.#####.###',
  '............',
  '............',
  '............',
  '............',
  '########.###',
  '............',
  '............',
  '............',
  '#.#####.####',
  '............',
  '............',
  '............',
  '......#.....',
  '...........X',
];

// Sanity-check at module load.
if (GRID.length !== ROWS) throw new Error(`GRID rows mismatch: ${GRID.length} vs ${ROWS}`);
for (const row of GRID) {
  if (row.length !== COLS) throw new Error(`GRID col mismatch: "${row}"`);
}

// --- Waypoint script ---------------------------------------------------
// The Runner walks these in order. A `trigger` pauses him until the
// matching sensor moment resolves successfully.
type Waypoint = {
  x: number;
  y: number;
  trigger?: 'hide' | 'safe';
};

const WAYPOINTS: Waypoint[] = [
  { x: 0, y: 1 },           // start
  { x: 1, y: 4 },           // through wall gap
  { x: 5, y: 6 },           // approach camera
  { x: 8, y: 7 },           // past camera
  { x: 7, y: 9 },           // through wall gap (col 7 row 8 is open)
  { x: 4, y: 11, trigger: 'hide' }, // hide moment behind cover
  { x: 9, y: 11 },          // past patrol guard
  { x: 1, y: 13 },          // through wall (col 1 row 12 is open)
  { x: 6, y: 16, trigger: 'safe' }, // safe-crack
  { x: 11, y: 17 },         // exit
];

// --- Threat node definitions -------------------------------------------
type CameraThreat = {
  kind: 'camera';
  id: string;
  x: number; // tile center
  y: number;
  facing: number; // radians
  sweepHalfWidth: number; // radians, swept symmetrically
  sweepPeriodMs: number;
};

type GuardThreat = {
  kind: 'guard';
  id: string;
  patrol: { x: number; y: number }[]; // tile centers, looped
};

type VendingThreat = {
  kind: 'vending';
  id: string;
  x: number;
  y: number;
  distractsGuardId: string;
  distractTile: { x: number; y: number };
};

type LaserThreat = {
  kind: 'laser';
  id: string;
  // Line as a tile pair the laser blocks; flips between A and B.
  sideA: { from: { x: number; y: number }; to: { x: number; y: number } };
  sideB: { from: { x: number; y: number }; to: { x: number; y: number } };
  // Visible orange-ish bolt color for distinction from neon palette.
  initial: 'A' | 'B';
};

type LightThreat = {
  kind: 'light';
  id: string;
  x: number;
  y: number;
  // Halves the range of any guard whose patrol passes through this region
  // when the light is OFF.
  affectsGuardId?: string;
};

type ThreatDef =
  | CameraThreat
  | GuardThreat
  | VendingThreat
  | LaserThreat
  | LightThreat;

const THREATS: ThreatDef[] = [
  {
    kind: 'camera',
    id: 'cam-1',
    x: 5, y: 6,
    facing: Math.PI / 2, // pointing down
    sweepHalfWidth: Math.PI / 6,
    sweepPeriodMs: 4000,
  },
  {
    kind: 'guard',
    id: 'g-1',
    patrol: [
      { x: 9, y: 11 },
      { x: 9, y: 9 },
      { x: 6, y: 9 },
      { x: 6, y: 11 },
    ],
  },
  {
    kind: 'vending',
    id: 'vend-1',
    x: 2, y: 15,
    distractsGuardId: 'g-1',
    distractTile: { x: 9, y: 13 }, // guard walks toward this
  },
  {
    kind: 'laser',
    id: 'laser-1',
    sideA: { from: { x: 5, y: 14 }, to: { x: 5, y: 16 } },
    sideB: { from: { x: 8, y: 14 }, to: { x: 8, y: 16 } },
    initial: 'A',
  },
  {
    kind: 'light',
    id: 'light-1',
    x: 10, y: 11,
    affectsGuardId: 'g-1',
  },
];

// --- Resource budget (doubled for testing per spec) --------------------
type Budget = {
  loops: number;     // camera loops
  distract: number;  // vending pops
  laser: number;     // laser flips
  light: number;     // light toggles
};

const STARTING_BUDGET: Budget = {
  loops: 4,
  distract: 2,
  laser: 2,
  light: 2,
};

// --- Dialogue ----------------------------------------------------------
type Line = { speaker: 'HANDLER' | 'RUNNER'; text: string };

const BRIEFING: Line[] = [
  { speaker: 'HANDLER', text: 'Last contact went dark four hours ago.' },
  { speaker: 'HANDLER', text: 'Briefcase is on level 3. Get in. Get out.' },
  { speaker: 'RUNNER',  text: 'Don\'t lose me.' },
  { speaker: 'HANDLER', text: 'Eyes on you.' },
];

const DEBRIEF_SUCCESS: Line[] = [
  { speaker: 'HANDLER', text: 'Clean run. Briefcase secured.' },
  { speaker: 'RUNNER',  text: 'We do this again Friday.' },
  { speaker: 'HANDLER', text: 'We don\'t talk till Friday.' },
];

const DEBRIEF_FAIL: Line[] = [
  { speaker: 'HANDLER', text: 'They saw you. Get out, get out, get out.' },
  { speaker: 'RUNNER',  text: '...' },
];

// --- Phase + runtime types ---------------------------------------------
type Phase =
  | 'briefing'
  | 'playing'
  | 'hide'
  | 'safe'
  | 'success'
  | 'fail';

type CameraState = { loopedUntil: number };
type GuardState = {
  // Pixel position
  px: number;
  py: number;
  // Current patrol target index
  targetIdx: number;
  // Distract override
  distractUntil: number;
  distractTarget: { x: number; y: number } | null;
  // Last facing angle (for vision cone)
  facing: number;
};
type LaserState = { side: 'A' | 'B' };
type LightState = { on: boolean };

type Runtime = {
  cameras: Record<string, CameraState>;
  guards: Record<string, GuardState>;
  lasers: Record<string, LaserState>;
  lights: Record<string, LightState>;
};

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function GhostGame() {
  const [phase, setPhase] = useState<Phase>('briefing');
  const [tick, setTick] = useState(0); // forces re-render at game-loop rate
  const [budget, setBudget] = useState<Budget>(STARTING_BUDGET);
  const [briefingIdx, setBriefingIdx] = useState(0);
  const [debriefIdx, setDebriefIdx] = useState(0);

  // Refs for canonical state.
  const phaseRef = useRef<Phase>('briefing');
  const budgetRef = useRef<Budget>({ ...STARTING_BUDGET });
  const runnerPxRef = useRef({ x: 0, y: 0 });
  const waypointIdxRef = useRef(0);
  const runtimeRef = useRef<Runtime>(makeInitialRuntime());
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize runner pixel position from first waypoint.
  useEffect(() => {
    const w = WAYPOINTS[0];
    runnerPxRef.current = tileToPx(w.x, w.y);
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    rafRef.current = null;
    finishTimeoutRef.current = null;
  }

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function dismissBriefingLine() {
    if (briefingIdx + 1 < BRIEFING.length) {
      setBriefingIdx((i) => i + 1);
      return;
    }
    // Begin run.
    startTimeRef.current = Date.now();
    elapsedRef.current = 0;
    waypointIdxRef.current = 0;
    runnerPxRef.current = tileToPx(WAYPOINTS[0].x, WAYPOINTS[0].y);
    setPhaseSafe('playing');
    lastFrameRef.current = Date.now();
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  // ---------- Main game loop -------------------------------------------
  function gameLoop() {
    if (phaseRef.current === 'success' || phaseRef.current === 'fail') return;
    const now = Date.now();
    if (now - lastFrameRef.current >= TICK_MS) {
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      if (phaseRef.current === 'playing') {
        elapsedRef.current = (now - startTimeRef.current) / 1000;
        stepRunner(dt);
        stepGuards(dt, now);
        checkDetection(now);
        maybeHeartbeat(now);
      }
      setTick((t) => t + 1);
    }
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  function stepRunner(dt: number) {
    const wpIdx = waypointIdxRef.current;
    if (wpIdx >= WAYPOINTS.length - 1) return;
    const next = WAYPOINTS[wpIdx + 1];
    const target = tileToPx(next.x, next.y);
    const cur = runnerPxRef.current;
    const dx = target.x - cur.x;
    const dy = target.y - cur.y;
    const dist = Math.hypot(dx, dy);
    const step = RUNNER_SPEED * dt;
    if (dist <= step) {
      // Snap to target, advance.
      runnerPxRef.current = { x: target.x, y: target.y };
      waypointIdxRef.current = wpIdx + 1;
      // Trigger sensor moment if any.
      if (next.trigger === 'hide') {
        setPhaseSafe('hide');
      } else if (next.trigger === 'safe') {
        setPhaseSafe('safe');
      } else if (waypointIdxRef.current === WAYPOINTS.length - 1) {
        triggerSuccess();
      }
    } else {
      runnerPxRef.current = {
        x: cur.x + (dx / dist) * step,
        y: cur.y + (dy / dist) * step,
      };
    }
  }

  function stepGuards(dt: number, now: number) {
    const guardDefs = THREATS.filter((t) => t.kind === 'guard') as GuardThreat[];
    for (const g of guardDefs) {
      const state = runtimeRef.current.guards[g.id];
      // Determine current target — distraction overrides patrol.
      let target: { x: number; y: number };
      if (state.distractUntil > now && state.distractTarget) {
        target = tileToPx(state.distractTarget.x, state.distractTarget.y);
      } else {
        const t = g.patrol[state.targetIdx];
        target = tileToPx(t.x, t.y);
      }
      const dx = target.x - state.px;
      const dy = target.y - state.py;
      const dist = Math.hypot(dx, dy);
      const step = GUARD_SPEED * dt;
      if (dist <= step) {
        state.px = target.x;
        state.py = target.y;
        // Advance patrol if we weren't distracted.
        if (state.distractUntil <= now) {
          state.targetIdx = (state.targetIdx + 1) % g.patrol.length;
        }
      } else {
        state.facing = Math.atan2(dy, dx);
        state.px += (dx / dist) * step;
        state.py += (dy / dist) * step;
      }
    }
  }

  function checkDetection(now: number) {
    const r = runnerPxRef.current;
    // Cameras
    const camDefs = THREATS.filter((t) => t.kind === 'camera') as CameraThreat[];
    for (const c of camDefs) {
      const cs = runtimeRef.current.cameras[c.id];
      if (cs.loopedUntil > now) continue;
      const facing = currentCameraFacing(c, now);
      if (inCone(c.x * TILE_PX + TILE_PX / 2, c.y * TILE_PX + TILE_PX / 2,
                facing, CAMERA_FOV, CAMERA_RANGE,
                r.x, r.y)) {
        triggerFail();
        return;
      }
    }
    // Guards
    const guardDefs = THREATS.filter((t) => t.kind === 'guard') as GuardThreat[];
    for (const g of guardDefs) {
      const gs = runtimeRef.current.guards[g.id];
      // Light-modified range
      const lightOn = isGuardWellLit(g.id);
      const range = lightOn ? GUARD_RANGE : GUARD_RANGE * 0.55;
      if (inCone(gs.px, gs.py, gs.facing, GUARD_FOV, range, r.x, r.y)) {
        triggerFail();
        return;
      }
    }
  }

  function isGuardWellLit(guardId: string): boolean {
    const lights = THREATS.filter((t) => t.kind === 'light') as LightThreat[];
    const relevant = lights.find((l) => l.affectsGuardId === guardId);
    if (!relevant) return true;
    return runtimeRef.current.lights[relevant.id].on;
  }

  function maybeHeartbeat(now: number) {
    const r = runnerPxRef.current;
    let nearestTiles = Infinity;
    const guardDefs = THREATS.filter((t) => t.kind === 'guard') as GuardThreat[];
    for (const g of guardDefs) {
      const gs = runtimeRef.current.guards[g.id];
      const dx = gs.px - r.x;
      const dy = gs.py - r.y;
      const tilesAway = Math.hypot(dx, dy) / TILE_PX;
      if (tilesAway < nearestTiles) nearestTiles = tilesAway;
    }
    if (nearestTiles >= HEARTBEAT_NEAR_TILES) return;

    // Pulse rate scales with closeness.
    const pulseInterval =
      nearestTiles < 2 ? 240 :
      nearestTiles < 4 ? 480 :
      nearestTiles < 5 ? 720 :
      1000;
    if (now - lastHeartbeatRef.current >= pulseInterval) {
      lastHeartbeatRef.current = now;
      Haptics.impactAsync(
        nearestTiles < 3
          ? Haptics.ImpactFeedbackStyle.Heavy
          : nearestTiles < 5
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {});
    }
  }

  // ---------- Tap handling ---------------------------------------------
  function handleMapTap(e: GestureResponderEvent) {
    if (phaseRef.current !== 'playing') return;
    const tx = e.nativeEvent.locationX;
    const ty = e.nativeEvent.locationY;

    // Find closest threat within tap radius.
    let bestId: string | null = null;
    let bestDist = TAP_RADIUS_PX;
    for (const t of THREATS) {
      if (t.kind === 'guard') continue; // guards aren't directly tappable
      const pos = threatScreenPos(t);
      if (!pos) continue;
      const d = Math.hypot(pos.x - tx, pos.y - ty);
      if (d < bestDist) {
        bestDist = d;
        bestId = t.id;
      }
    }
    if (!bestId) return;
    const def = THREATS.find((t) => t.id === bestId);
    if (!def) return;
    activateThreat(def);
  }

  function activateThreat(t: ThreatDef) {
    const now = Date.now();
    if (t.kind === 'camera') {
      if (budgetRef.current.loops <= 0) return;
      budgetRef.current.loops -= 1;
      setBudget({ ...budgetRef.current });
      runtimeRef.current.cameras[t.id].loopedUntil = now + CAMERA_LOOP_MS;
      Haptics.selectionAsync().catch(() => {});
    } else if (t.kind === 'vending') {
      if (budgetRef.current.distract <= 0) return;
      budgetRef.current.distract -= 1;
      setBudget({ ...budgetRef.current });
      const guardState = runtimeRef.current.guards[t.distractsGuardId];
      if (guardState) {
        guardState.distractUntil = now + VENDING_DISTRACT_MS;
        guardState.distractTarget = t.distractTile;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else if (t.kind === 'laser') {
      if (budgetRef.current.laser <= 0) return;
      budgetRef.current.laser -= 1;
      setBudget({ ...budgetRef.current });
      const ls = runtimeRef.current.lasers[t.id];
      ls.side = ls.side === 'A' ? 'B' : 'A';
      Haptics.selectionAsync().catch(() => {});
    } else if (t.kind === 'light') {
      if (budgetRef.current.light <= 0) return;
      budgetRef.current.light -= 1;
      setBudget({ ...budgetRef.current });
      const ls = runtimeRef.current.lights[t.id];
      ls.on = !ls.on;
      Haptics.selectionAsync().catch(() => {});
    }
  }

  // ---------- Sensor moment results ------------------------------------
  function onHideSuccess() {
    setPhaseSafe('playing');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  function onHideFail() {
    triggerFail();
  }
  function onSafeSuccess() {
    setPhaseSafe('playing');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  // ---------- End-of-mission --------------------------------------------
  function triggerFail() {
    if (phaseRef.current === 'fail' || phaseRef.current === 'success') return;
    setPhaseSafe('fail');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setDebriefIdx(0);
  }
  function triggerSuccess() {
    if (phaseRef.current === 'fail' || phaseRef.current === 'success') return;
    setPhaseSafe('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDebriefIdx(0);
  }

  function dismissDebriefLine() {
    const lines = phaseRef.current === 'success' ? DEBRIEF_SUCCESS : DEBRIEF_FAIL;
    if (debriefIdx + 1 < lines.length) {
      setDebriefIdx((i) => i + 1);
      return;
    }
    routeToResult();
  }

  function routeToResult() {
    const success = phaseRef.current === 'success';
    const elapsed = elapsedRef.current;
    const unspent =
      budgetRef.current.loops +
      budgetRef.current.distract +
      budgetRef.current.laser +
      budgetRef.current.light;
    const score = success
      ? Math.max(0, BASE_SCORE + unspent * PER_BUDGET_BONUS - Math.floor(elapsed * PER_SECOND_PENALTY))
      : 0;
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'ghost',
        score: String(score),
        duration: elapsed.toFixed(1),
      },
    });
  }

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'OPERATION'}
            </ArcadeText>
            <ArcadeText variant="pixel" size={14} color={ACCENT} glowColor={ACCENT}>
              {'GHOST  · M1'}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {phase === 'playing' ? `${elapsedRef.current.toFixed(1)}s` : ''}
            </ArcadeText>
          </View>
          <BudgetHud budget={budget} />
        </View>
      </SafeAreaView>

      {/* Map area */}
      <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
        <Pressable
          onPress={handleMapTap}
          style={{
            width: MAP_W,
            height: MAP_H,
            backgroundColor: colors.bgSurface,
            borderWidth: 2,
            borderColor: ACCENT,
          }}
        >
          <MapSvg
            now={Date.now()}
            runnerPos={runnerPxRef.current}
            runtime={runtimeRef.current}
            tick={tick}
          />
        </Pressable>
      </View>

      <ScanlineOverlay opacity={0.04} />

      {/* Briefing dialogue */}
      {phase === 'briefing' && (
        <DialogueOverlay
          line={BRIEFING[briefingIdx]}
          stepIndex={briefingIdx}
          totalSteps={BRIEFING.length}
          onAdvance={dismissBriefingLine}
        />
      )}

      {/* Debrief dialogue (success or fail) */}
      {(phase === 'success' || phase === 'fail') && (
        <DialogueOverlay
          line={(phase === 'success' ? DEBRIEF_SUCCESS : DEBRIEF_FAIL)[debriefIdx]}
          stepIndex={debriefIdx}
          totalSteps={(phase === 'success' ? DEBRIEF_SUCCESS : DEBRIEF_FAIL).length}
          onAdvance={dismissDebriefLine}
          headline={phase === 'success' ? 'EXTRACTED' : 'BURNED'}
          headlineColor={phase === 'success' ? neon('green') : neon('red')}
        />
      )}

      {/* Hide moment */}
      {phase === 'hide' && (
        <HoldStillOverlay onSuccess={onHideSuccess} onFail={onHideFail} />
      )}

      {/* Safe-crack */}
      {phase === 'safe' && <SafeCrackOverlay onSuccess={onSafeSuccess} />}
    </View>
  );
}

// =====================================================================
// MapSvg — renders walls, threats, vision cones, the runner.
// =====================================================================
function MapSvg({
  now,
  runnerPos,
  runtime,
  tick,
}: {
  now: number;
  runnerPos: { x: number; y: number };
  runtime: Runtime;
  tick: number;
}) {
  // tick is here so the parent re-renders us each frame; suppress unused warning.
  void tick;

  return (
    <Svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
      {/* Floor grid */}
      {GRID.map((row, ri) =>
        row.split('').map((ch, ci) => {
          const px = ci * TILE_PX;
          const py = ri * TILE_PX;
          if (ch === '#') {
            return (
              <Rect
                key={`w-${ri}-${ci}`}
                x={px}
                y={py}
                width={TILE_PX}
                height={TILE_PX}
                fill={colors.bgElevated}
                stroke={colors.border}
                strokeWidth={0.5}
              />
            );
          }
          return (
            <Rect
              key={`f-${ri}-${ci}`}
              x={px}
              y={py}
              width={TILE_PX}
              height={TILE_PX}
              fill={colors.bg}
              stroke={colors.border}
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        }),
      )}

      {/* Exit marker */}
      <Rect
        x={11 * TILE_PX + 4}
        y={17 * TILE_PX + 4}
        width={TILE_PX - 8}
        height={TILE_PX - 8}
        fill="none"
        stroke={neon('green')}
        strokeWidth={2}
      />

      {/* Threats */}
      {THREATS.map((t) => {
        if (t.kind === 'camera') {
          const cs = runtime.cameras[t.id];
          const looped = cs.loopedUntil > now;
          const facing = currentCameraFacing(t, now);
          const cx = t.x * TILE_PX + TILE_PX / 2;
          const cy = t.y * TILE_PX + TILE_PX / 2;
          return (
            <G key={t.id}>
              {/* Cone */}
              <SvgPath
                d={conePath(cx, cy, facing, CAMERA_FOV, CAMERA_RANGE)}
                fill={looped ? colors.textMute : neon('yellow')}
                fillOpacity={looped ? 0.10 : 0.18}
                stroke={looped ? colors.textMute : neon('yellow')}
                strokeWidth={1}
                strokeOpacity={looped ? 0.4 : 0.6}
              />
              {/* Camera body */}
              <Circle cx={cx} cy={cy} r={6} fill={looped ? colors.textMute : neon('yellow')} />
              <Circle cx={cx} cy={cy} r={2} fill={colors.bg} />
            </G>
          );
        }
        if (t.kind === 'guard') {
          const gs = runtime.guards[t.id];
          const lit = (() => {
            const lights = THREATS.filter((tt) => tt.kind === 'light') as LightThreat[];
            const rel = lights.find((l) => l.affectsGuardId === t.id);
            if (!rel) return true;
            return runtime.lights[rel.id].on;
          })();
          const range = lit ? GUARD_RANGE : GUARD_RANGE * 0.55;
          return (
            <G key={t.id}>
              <SvgPath
                d={conePath(gs.px, gs.py, gs.facing, GUARD_FOV, range)}
                fill={neon('red')}
                fillOpacity={0.16}
                stroke={neon('red')}
                strokeWidth={1}
                strokeOpacity={0.6}
              />
              <Circle cx={gs.px} cy={gs.py} r={8} fill={neon('red')} />
              <Circle cx={gs.px} cy={gs.py} r={3} fill={colors.bg} />
            </G>
          );
        }
        if (t.kind === 'vending') {
          const cx = t.x * TILE_PX + TILE_PX / 2;
          const cy = t.y * TILE_PX + TILE_PX / 2;
          return (
            <G key={t.id}>
              <Rect x={cx - 9} y={cy - 11} width={18} height={22} fill={neon('cyan')} fillOpacity={0.85} stroke={neon('cyan')} strokeWidth={1} />
              <Rect x={cx - 6} y={cy - 8} width={12} height={5} fill={colors.bg} opacity={0.5} />
              <Rect x={cx - 6} y={cy - 1} width={12} height={5} fill={colors.bg} opacity={0.5} />
            </G>
          );
        }
        if (t.kind === 'laser') {
          const ls = runtime.lasers[t.id];
          const side = ls.side === 'A' ? t.sideA : t.sideB;
          const x1 = side.from.x * TILE_PX + TILE_PX / 2;
          const y1 = side.from.y * TILE_PX + TILE_PX / 2;
          const x2 = side.to.x * TILE_PX + TILE_PX / 2;
          const y2 = side.to.y * TILE_PX + TILE_PX / 2;
          return (
            <G key={t.id}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={neon('orange')} strokeWidth={3} opacity={0.9} />
              <Circle cx={x1} cy={y1} r={4} fill={neon('orange')} />
              <Circle cx={x2} cy={y2} r={4} fill={neon('orange')} />
            </G>
          );
        }
        if (t.kind === 'light') {
          const on = runtime.lights[t.id].on;
          const cx = t.x * TILE_PX + TILE_PX / 2;
          const cy = t.y * TILE_PX + TILE_PX / 2;
          return (
            <G key={t.id}>
              <Circle
                cx={cx}
                cy={cy}
                r={9}
                fill={on ? neon('yellow') : colors.textMute}
                opacity={on ? 0.85 : 0.55}
              />
              <Circle cx={cx} cy={cy} r={3} fill={colors.bg} />
            </G>
          );
        }
        return null;
      })}

      {/* Runner */}
      <Circle cx={runnerPos.x} cy={runnerPos.y} r={9} fill={ACCENT} />
      <Circle cx={runnerPos.x} cy={runnerPos.y} r={5} fill={colors.bg} />
      <Circle cx={runnerPos.x} cy={runnerPos.y} r={3} fill={ACCENT} />
    </Svg>
  );
}

// =====================================================================
// HUD — budget chips
// =====================================================================
function BudgetHud({ budget }: { budget: Budget }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Chip label="LOOP" value={budget.loops} color={neon('yellow')} />
      <Chip label="DIST" value={budget.distract} color={neon('cyan')} />
      <Chip label="LASR" value={budget.laser} color={neon('orange')} />
      <Chip label="LITE" value={budget.light} color={neon('green')} />
    </View>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  const dim = value <= 0;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: dim ? colors.border : color,
        paddingHorizontal: 5,
        paddingVertical: 2,
        alignItems: 'center',
        opacity: dim ? 0.4 : 1,
      }}
    >
      <ArcadeText variant="pixel" size={7} color={dim ? colors.textMute : color}>
        {label}
      </ArcadeText>
      <ArcadeText variant="mono" size={14} color={dim ? colors.textMute : color}>
        {String(value)}
      </ArcadeText>
    </View>
  );
}

// =====================================================================
// DialogueOverlay — typewriter-style line-by-line briefing/debrief
// =====================================================================
function DialogueOverlay({
  line,
  stepIndex,
  totalSteps,
  onAdvance,
  headline,
  headlineColor,
}: {
  line: Line;
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
  headline?: string;
  headlineColor?: string;
}) {
  const [shown, setShown] = useState('');
  const targetRef = useRef(line.text);

  useEffect(() => {
    targetRef.current = line.text;
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(line.text.slice(0, i));
      if (i >= line.text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [line.text, stepIndex]);

  const speakerColor =
    line.speaker === 'HANDLER' ? neon('cyan') : neon('green');

  return (
    <Pressable
      onPress={onAdvance}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(8,8,15,0.78)',
        justifyContent: 'flex-end',
      }}
    >
      {headline ? (
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Blink intervalMs={500} minOpacity={0.45}>
            <ArcadeText
              variant="pixel"
              size={28}
              color={headlineColor ?? neon('yellow')}
              glowColor={headlineColor ?? neon('yellow')}
              glowRadius={16}
            >
              {headline}
            </ArcadeText>
          </Blink>
        </View>
      ) : null}

      <View
        style={{
          margin: spacing.lg,
          padding: spacing.lg,
          borderWidth: 2,
          borderColor: speakerColor,
          backgroundColor: colors.bgSurface,
        }}
      >
        <ArcadeText
          variant="pixel"
          size={9}
          color={speakerColor}
          glowColor={speakerColor}
        >
          {line.speaker}
        </ArcadeText>
        <View style={{ height: spacing.sm }} />
        <ArcadeText variant="mono" size={20} color={colors.text}>
          {shown}
          {shown.length < line.text.length ? '▌' : ''}
        </ArcadeText>
        <View style={{ height: spacing.md }} />
        <ArcadeText variant="pixel" size={7} color={colors.textMute}>
          {`${stepIndex + 1}/${totalSteps} — TAP TO CONTINUE`}
        </ArcadeText>
      </View>
    </Pressable>
  );
}

// =====================================================================
// HoldStillOverlay — accelerometer-driven "hide" moment.
// =====================================================================
function HoldStillOverlay({
  onSuccess,
  onFail,
}: {
  onSuccess: () => void;
  onFail: () => void;
}) {
  const [phase, setPhase] = useState<'arming' | 'holding' | 'done'>('arming');
  const [progress, setProgress] = useState(0); // 0..1
  const startedAtRef = useRef(0);
  const totalMotionRef = useRef(0);
  const lastSampleRef = useRef({ x: 0, y: 0, z: 0 });
  const subRef = useRef<{ remove: () => void } | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    Accelerometer.setUpdateInterval(80);
    subRef.current = Accelerometer.addListener((data) => {
      lastSampleRef.current = data;
    });
    // Brief "ARMING" countdown so player can settle the phone.
    const armingMs = 1200;
    const armTimer = setTimeout(() => {
      startedAtRef.current = Date.now();
      setPhase('holding');
    }, armingMs);
    return () => {
      clearTimeout(armTimer);
      subRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'holding') return;
    let raf: number;
    function tick() {
      if (finishedRef.current) return;
      const now = Date.now();
      const elapsed = now - startedAtRef.current;
      // Magnitude in g (1.0 means stationary because of gravity).
      const { x, y, z } = lastSampleRef.current;
      const mag = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
      if (mag > HIDE_MOTION_THRESHOLD) {
        finishedRef.current = true;
        setPhase('done');
        onFail();
        return;
      }
      const p = Math.min(1, elapsed / HIDE_HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        finishedRef.current = true;
        setPhase('done');
        onSuccess();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, onSuccess, onFail]);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(8,8,15,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ArcadeText
        variant="pixel"
        size={18}
        color={neon('cyan')}
        glowColor={neon('cyan')}
        align="center"
      >
        {phase === 'arming' ? 'GUARD INCOMING' : 'HOLD  STILL'}
      </ArcadeText>
      <View style={{ height: spacing.lg }} />
      <ArcadeText variant="mono" size={20} color={colors.textDim} align="center">
        {phase === 'arming'
          ? 'STEADY THE PHONE'
          : 'DON\'T MOVE — DON\'T BREATHE.'}
      </ArcadeText>
      <View style={{ height: spacing.xl }} />
      {/* Progress bar */}
      <View style={{ width: 220, height: 8, backgroundColor: colors.border }}>
        <View
          style={{
            width: 220 * progress,
            height: 8,
            backgroundColor: neon('cyan'),
          }}
        />
      </View>
    </View>
  );
}

// =====================================================================
// SafeCrackOverlay — dial cracking by haptic feedback only.
//
// Three numbers in sequence. For each number, a hidden target index in
// 0..ROUNDS_PER_DIGIT is the right one. Player drags a dial; as the
// pointer crosses the target, a light haptic pulses. When they stop on
// the target and release, that digit's locked.
// =====================================================================
const SAFE_DIGITS = 3;
const SAFE_NOTCHES = 16; // dial increments
const SAFE_HAPTIC_WINDOW = 1; // notches around target that trigger pulses

function SafeCrackOverlay({ onSuccess }: { onSuccess: () => void }) {
  // Layout
  const dialSize = 220;
  const dialRadius = dialSize / 2;

  const [digit, setDigit] = useState(0);
  const [notch, setNotch] = useState(0);
  const targets = useRef<number[]>(
    Array.from({ length: SAFE_DIGITS }, () =>
      Math.floor(Math.random() * SAFE_NOTCHES),
    ),
  );
  const lastNotchRef = useRef(0);
  const draggingRef = useRef(false);

  function handleStart(e: GestureResponderEvent) {
    draggingRef.current = true;
    handleMove(e);
  }
  function handleMove(e: GestureResponderEvent) {
    if (!draggingRef.current) return;
    const lx = e.nativeEvent.locationX;
    const ly = e.nativeEvent.locationY;
    // Centered around dialRadius.
    const dx = lx - dialRadius;
    const dy = ly - dialRadius;
    let angle = Math.atan2(dy, dx);
    // Map to 0..1 starting from top.
    angle = angle + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const fraction = angle / (Math.PI * 2);
    const newNotch = Math.floor(fraction * SAFE_NOTCHES) % SAFE_NOTCHES;
    if (newNotch !== lastNotchRef.current) {
      const target = targets.current[digit];
      const distToTarget = Math.min(
        Math.abs(newNotch - target),
        SAFE_NOTCHES - Math.abs(newNotch - target),
      );
      if (distToTarget <= SAFE_HAPTIC_WINDOW) {
        // Closer = stronger pulse.
        const style =
          distToTarget === 0
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(style).catch(() => {});
      } else {
        // Cheap selection click for kinetic feedback.
        Haptics.selectionAsync().catch(() => {});
      }
      lastNotchRef.current = newNotch;
      setNotch(newNotch);
    }
  }
  function handleEnd() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const target = targets.current[digit];
    if (notch === target) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (digit + 1 >= SAFE_DIGITS) {
        onSuccess();
      } else {
        setDigit((d) => d + 1);
        setNotch(0);
        lastNotchRef.current = 0;
      }
    } else {
      // Wrong — small error vibration but not a fail; player keeps trying.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }

  // Pointer angle for the dial visual.
  const pointerAngle = (notch / SAFE_NOTCHES) * Math.PI * 2 - Math.PI / 2;
  const pointerX = dialRadius + Math.cos(pointerAngle) * (dialRadius - 14);
  const pointerY = dialRadius + Math.sin(pointerAngle) * (dialRadius - 14);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(8,8,15,0.94)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ArcadeText
        variant="pixel"
        size={16}
        color={neon('purple')}
        glowColor={neon('purple')}
      >
        {'CRACK  THE  SAFE'}
      </ArcadeText>
      <View style={{ height: spacing.sm }} />
      <ArcadeText variant="pixel" size={9} color={colors.textDim}>
        {`DIGIT ${digit + 1} / ${SAFE_DIGITS}  ·  FEEL FOR THE CLICK`}
      </ArcadeText>
      <View style={{ height: spacing.lg }} />

      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleStart}
        onResponderMove={handleMove}
        onResponderRelease={handleEnd}
        onResponderTerminate={handleEnd}
        style={{
          width: dialSize,
          height: dialSize,
          borderRadius: dialSize / 2,
          borderWidth: 3,
          borderColor: neon('purple'),
          backgroundColor: colors.bgSurface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={dialSize} height={dialSize}>
          {/* Tick marks */}
          {Array.from({ length: SAFE_NOTCHES }).map((_, i) => {
            const a = (i / SAFE_NOTCHES) * Math.PI * 2 - Math.PI / 2;
            const x1 = dialRadius + Math.cos(a) * (dialRadius - 6);
            const y1 = dialRadius + Math.sin(a) * (dialRadius - 6);
            const x2 = dialRadius + Math.cos(a) * (dialRadius - 14);
            const y2 = dialRadius + Math.sin(a) * (dialRadius - 14);
            return (
              <Line
                key={`tk-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={colors.textDim}
                strokeWidth={1}
              />
            );
          })}
          {/* Pointer */}
          <Line
            x1={dialRadius}
            y1={dialRadius}
            x2={pointerX}
            y2={pointerY}
            stroke={neon('purple')}
            strokeWidth={3}
          />
          <Circle cx={dialRadius} cy={dialRadius} r={6} fill={neon('purple')} />
        </Svg>
      </View>
      <View style={{ height: spacing.lg }} />
      <ArcadeText variant="pixel" size={9} color={colors.textMute} align="center">
        {'DRAG SLOWLY · RELEASE WHEN YOU FEEL IT'}
      </ArcadeText>
      <View style={{ height: spacing.sm }} />
      <ArcadeText variant="pixel" size={7} color={colors.textMute}>
        {Platform.OS === 'ios' ? '' : '(haptics may be reduced on this device)'}
      </ArcadeText>
    </View>
  );
}

// =====================================================================
// Helpers
// =====================================================================
function tileToPx(tx: number, ty: number) {
  return { x: tx * TILE_PX + TILE_PX / 2, y: ty * TILE_PX + TILE_PX / 2 };
}

function inCone(
  ox: number, oy: number,
  facing: number, fov: number, range: number,
  px: number, py: number,
): boolean {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const a = Math.atan2(dy, dx);
  const da = Math.atan2(Math.sin(a - facing), Math.cos(a - facing));
  return Math.abs(da) <= fov / 2;
}

function conePath(
  ox: number, oy: number,
  facing: number, fov: number, range: number,
): string {
  const a1 = facing - fov / 2;
  const a2 = facing + fov / 2;
  const x1 = ox + Math.cos(a1) * range;
  const y1 = oy + Math.sin(a1) * range;
  const x2 = ox + Math.cos(a2) * range;
  const y2 = oy + Math.sin(a2) * range;
  // Approximate the arc with a single cubic-ish curve via a moderate sweep flag.
  const largeArc = fov > Math.PI ? 1 : 0;
  return `M ${ox} ${oy} L ${x1} ${y1} A ${range} ${range} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function currentCameraFacing(c: CameraThreat, now: number): number {
  // Sweep -halfWidth ↔ +halfWidth using a sine over period.
  const t = (now % c.sweepPeriodMs) / c.sweepPeriodMs;
  const offset = Math.sin(t * Math.PI * 2) * c.sweepHalfWidth;
  return c.facing + offset;
}

function threatScreenPos(t: ThreatDef): { x: number; y: number } | null {
  if (t.kind === 'camera' || t.kind === 'vending' || t.kind === 'light') {
    return tileToPx(t.x, t.y);
  }
  if (t.kind === 'laser') {
    // Allow tapping near either bolt endpoint of the current side.
    // Return the midpoint; the caller has tap radius ~32 anyway.
    const a = t.sideA;
    return tileToPx((a.from.x + a.to.x) / 2, (a.from.y + a.to.y) / 2);
  }
  return null;
}

function makeInitialRuntime(): Runtime {
  const cameras: Record<string, CameraState> = {};
  const guards: Record<string, GuardState> = {};
  const lasers: Record<string, LaserState> = {};
  const lights: Record<string, LightState> = {};
  for (const t of THREATS) {
    if (t.kind === 'camera') {
      cameras[t.id] = { loopedUntil: 0 };
    } else if (t.kind === 'guard') {
      const start = t.patrol[0];
      const startPx = tileToPx(start.x, start.y);
      guards[t.id] = {
        px: startPx.x,
        py: startPx.y,
        targetIdx: 1 % t.patrol.length,
        distractUntil: 0,
        distractTarget: null,
        facing: 0,
      };
    } else if (t.kind === 'laser') {
      lasers[t.id] = { side: t.initial };
    } else if (t.kind === 'light') {
      lights[t.id] = { on: true };
    }
  }
  return { cameras, guards, lasers, lights };
}
