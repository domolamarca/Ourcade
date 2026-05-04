// Tilt Maze — accelerometer-driven ball-roll-through-a-path game.
//
// Phone tilts produce gravity components in the screen plane; the ball
// accelerates accordingly. Stay on the glowing path (variable width
// per-segment supported). Edge proximity triggers escalating haptic
// warning. Falling off the path or colliding with a swinging hazard
// ends the run instantly. Score is composite: (level reached) ×
// 1,000,000 − elapsed_ms; higher wins, faster ties.
//
// INFINITE MODE: after the 20-level loop completes, the game loops back
// to level 1 with a difficulty multiplier (lap 2 = +10% gravity & cap,
// hazards cycle 10% faster). Each subsequent lap stacks more, capped
// at +50%. Players can climb levels indefinitely; high scores can
// always be topped.
//
// Tile effects are placed along certain levels:
//   - boost (yellow): amplifies ball speed while it overlaps
//   - slow  (purple): heavy drag while it overlaps
//
// The run starts when the player TILTS the phone, not when they tap.
// This keeps stray taps from accidentally launching the maze and lets
// the player pre-orient the device before the ball starts rolling.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path as SvgPath,
  Polygon as SvgPolygon,
  Rect,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';
import {
  Hazard,
  Level,
  LEVELS,
  LEVEL_VIEW_H,
  LEVEL_VIEW_W,
  Point,
  TileEffect,
} from '../../src/data/tilt-maze-levels';

// --- Tunables ----------------------------------------------------------
const BALL_RADIUS = 8;
const TICK_MS = 22; // ~45Hz physics
const ACCEL_FACTOR = 720; // px/s² per g of tilt
const FRICTION = 0.93; // baseline per-frame velocity multiplier (60Hz norm)
const MAX_VELOCITY_PX_S = 360;

const TILT_START_THRESHOLD = 0.18; // any |g| over this triggers the run

const EDGE_WARN_RATIO = 0.72;
const EDGE_DANGER_RATIO = 0.88;
const LEVEL_CLEAR_DIST = BALL_RADIUS * 1.5;

const LEVEL_CLEAR_HOLD_MS = 700;
const FAIL_FREEZE_MS = 1500;
const COUNTDOWN_STEP_MS = 500; // per "3", "2", "1", "GO" beat

// Tile effect tunables.
const BOOST_VELOCITY_GAIN_PER_FRAME = 1.05;
const BOOST_KICK_FROM_REST = 280; // px/s² of tilt-direction kick when stopped
const SLOW_FRICTION_PER_FRAME = 0.82; // sticky molasses

const ACCENT = neon('green');

type Phase = 'ready' | 'countdown' | 'playing' | 'level-clear' | 'fail' | 'all-clear';

type Ball = { x: number; y: number; vx: number; vy: number };

export default function TiltMazeGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [levelIdx, setLevelIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [proximity, setProximity] = useState(0);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 0>(3);

  const phaseRef = useRef<Phase>('ready');
  const levelIdxRef = useRef(0);
  const ballRef = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0 });
  const accelRef = useRef({ x: 0, y: 0 });
  const lastFrameRef = useRef(Date.now());
  const lastHapticRef = useRef(0);
  const startTimeRef = useRef(0);
  const elapsedMsRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set the ball at the start of the active level so the READY overlay
  // can preview where the run will begin.
  useEffect(() => {
    initBallForLevel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Accelerometer.setUpdateInterval(20);
    accelSubRef.current = Accelerometer.addListener(({ x, y }) => {
      accelRef.current = { x, y };
      // Tilt-to-start: in ready phase, any meaningful tilt fires the run.
      if (phaseRef.current === 'ready') {
        const tiltMag = Math.hypot(x, y);
        if (tiltMag > TILT_START_THRESHOLD) {
          startRun();
        }
      }
    });
    return () => {
      accelSubRef.current?.remove();
      if (rafRef.current) clearTimeout(rafRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    };
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function startRun() {
    levelIdxRef.current = 0;
    setLevelIdx(0);
    elapsedMsRef.current = 0;
    initBallForLevel(0);
    setPhaseSafe('countdown');
    setCountdown(3);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // 3 → 2 → 1 → GO. Each beat is COUNTDOWN_STEP_MS. Physics start at GO.
    // Timer starts at GO too so the countdown isn't part of the score.
    function step(value: 3 | 2 | 1 | 0) {
      countdownTimeoutRef.current = setTimeout(() => {
        if (value === 0) {
          setPhaseSafe('playing');
          startTimeRef.current = Date.now();
          lastFrameRef.current = Date.now();
          scheduleFrame();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else {
          setCountdown(value);
          Haptics.selectionAsync().catch(() => {});
          step((value - 1) as 3 | 2 | 1 | 0);
        }
      }, COUNTDOWN_STEP_MS);
    }
    step(3);
  }

  function initBallForLevel(idx: number) {
    const lvl = LEVELS[idx % LEVELS.length];
    const start = lvl.path[0];
    ballRef.current = { x: start.x, y: start.y, vx: 0, vy: 0 };
  }

  // Lap = how many full passes through LEVELS the player is on.
  // Lap 1 covers absolute levels 0..19 (displayed L1..L20).
  // Lap 2 covers 20..39 (L21..L40), etc.
  // Each lap past the first adds 10% to gravity, max velocity, and
  // hazard speed, capped at +50% (lap 6).
  function lapForAbs(absIdx: number): number {
    return Math.floor(absIdx / LEVELS.length) + 1;
  }
  function lapMultiplier(lap: number): number {
    return Math.min(1.5, 1 + 0.10 * (lap - 1));
  }

  function scheduleFrame() {
    rafRef.current = setTimeout(gameLoop, TICK_MS);
  }

  function gameLoop() {
    if (phaseRef.current !== 'playing') return;
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
    lastFrameRef.current = now;
    elapsedMsRef.current = now - startTimeRef.current;

    const ball = ballRef.current;
    const accel = accelRef.current;
    const lvl = LEVELS[levelIdxRef.current % LEVELS.length];
    const lap = lapForAbs(levelIdxRef.current);
    const lapMult = lapMultiplier(lap);

    // --- Apply tilt-derived acceleration -----------------------------
    ball.vx += accel.x * ACCEL_FACTOR * lapMult * dt;
    ball.vy += -accel.y * ACCEL_FACTOR * lapMult * dt;

    // --- Apply baseline friction (time-corrected) --------------------
    const friction = Math.pow(FRICTION, dt * 60);
    ball.vx *= friction;
    ball.vy *= friction;

    // --- Apply tile effects ------------------------------------------
    // Tile is an oriented rectangle along the path tangent. Ball is "on
    // tile" if its projection along the local tangent is within ±length/2
    // of the tile center. We don't check perpendicular distance — the
    // path-proximity step already enforces the ball is on the path.
    const tiles = lvl.tiles ?? [];
    let onBoost = false;
    let onSlow = false;
    for (const t of tiles) {
      const tan = pathTangentAt(t.pos, lvl.path);
      const dx = ball.x - t.pos.x;
      const dy = ball.y - t.pos.y;
      const along = dx * tan.tx + dy * tan.ty;
      if (Math.abs(along) > t.length / 2 + 4) continue;
      if (t.kind === 'boost') {
        onBoost = true;
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > 4) {
          const gain = Math.pow(BOOST_VELOCITY_GAIN_PER_FRAME, dt * 60);
          ball.vx *= gain;
          ball.vy *= gain;
        } else {
          ball.vx += accel.x * BOOST_KICK_FROM_REST * dt;
          ball.vy += -accel.y * BOOST_KICK_FROM_REST * dt;
        }
      } else if (t.kind === 'slow') {
        onSlow = true;
        const drag = Math.pow(SLOW_FRICTION_PER_FRAME, dt * 60);
        ball.vx *= drag;
        ball.vy *= drag;
      }
    }

    // --- Cap velocity ------------------------------------------------
    const baseMaxV = MAX_VELOCITY_PX_S * lapMult;
    const maxV = onBoost ? baseMaxV * 1.4 : baseMaxV;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > maxV) {
      ball.vx = (ball.vx / speed) * maxV;
      ball.vy = (ball.vy / speed) * maxV;
    }

    // --- Integrate position ------------------------------------------
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // --- Path proximity ratio (0..1+ where >1 is off path) ------------
    const prox = pathProximityRatio(ball.x, ball.y, lvl.path, lvl.width);
    setProximity(prox);

    if (prox > 1) {
      triggerFail('OFF THE PATH');
      return;
    }

    // --- Edge haptic -------------------------------------------------
    if (prox > EDGE_WARN_RATIO) {
      const interval = prox > EDGE_DANGER_RATIO ? 220 : 480;
      if (now - lastHapticRef.current > interval) {
        lastHapticRef.current = now;
        Haptics.impactAsync(
          prox > EDGE_DANGER_RATIO
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => {});
      }
    }

    // --- Hazard collision --------------------------------------------
    for (const hz of lvl.hazards) {
      const pos = hazardPosition(hz, now, lapMult);
      const d = Math.hypot(ball.x - pos.x, ball.y - pos.y);
      if (d < BALL_RADIUS + hz.radius) {
        triggerFail('HIT BY HAZARD');
        return;
      }
    }

    // --- Reached end? ------------------------------------------------
    const end = lvl.path[lvl.path.length - 1];
    const distToEnd = Math.hypot(ball.x - end.x, ball.y - end.y);
    if (distToEnd < LEVEL_CLEAR_DIST) {
      onLevelClear();
      return;
    }

    setTick((t) => t + 1);
    scheduleFrame();
  }

  function onLevelClear() {
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    setPhaseSafe('level-clear');

    transitionTimeoutRef.current = setTimeout(() => {
      // Infinite progression: levels keep climbing past LEVELS.length.
      // Layout loops via mod-index; difficulty stacks per lap.
      const next = levelIdxRef.current + 1;
      levelIdxRef.current = next;
      setLevelIdx(next);
      initBallForLevel(next);
      setPhaseSafe('playing');
      lastFrameRef.current = Date.now();
      scheduleFrame();
    }, LEVEL_CLEAR_HOLD_MS);
  }

  function triggerFail(_reason: string) {
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
    setPhaseSafe('fail');
    finalize(false);
  }

  function finalize(_beatAll: boolean) {
    // Always score by absolute level reached. Composite score keeps
    // climbing without a cap.
    const reached = levelIdxRef.current + 1;
    const elapsedMs = elapsedMsRef.current;
    const score = reached * 1_000_000 - elapsedMs;

    transitionTimeoutRef.current = setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: {
          id: 'tilt-maze',
          score: String(Math.max(0, score)),
          level: String(reached),
          taps: String(elapsedMs),
          duration: (elapsedMs / 1000).toFixed(1),
        },
      });
    }, FAIL_FREEZE_MS);
  }

  // ---- Render --------------------------------------------------------
  const lvl = LEVELS[levelIdxRef.current % LEVELS.length];
  const ball = ballRef.current;
  const now = Date.now();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* HUD */}
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            paddingLeft: 44, // room for EXIT chip on the left
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'LEVEL'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={ACCENT} glowColor={ACCENT}>
              {`L${levelIdx + 1}`}
            </ArcadeText>
            {(() => {
              const lap = lapForAbs(levelIdx);
              return (
                <ArcadeText
                  variant="pixel"
                  size={7}
                  color={lap > 1 ? neon('yellow') : colors.textDim}
                  glowColor={lap > 1 ? neon('yellow') : undefined}
                >
                  {lap > 1
                    ? `LAP ${lap} · ${lvl.name}`
                    : phase === 'playing'
                      ? lvl.name
                      : ''}
                </ArcadeText>
              );
            })()}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'TIME'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={22}
              color={neon('yellow')}
              glowColor={neon('yellow')}
            >
              {(elapsedMsRef.current / 1000).toFixed(1)}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      {/* Play area — fills the rest of the screen. The SVG viewBox handles
          aspect-correct scaling for whatever space we get. */}
      <View
        style={{
          flex: 1,
          marginHorizontal: 4,
          marginBottom: 4,
          backgroundColor: colors.bgSurface,
          borderWidth: 2,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${LEVEL_VIEW_W} ${LEVEL_VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <RadialGradient id="endGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={neon('yellow')} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={neon('yellow')} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* PATH RIBBON — three layers: outer halo, main fill, dark inner channel.
              Each is a sequence of quads (one per segment) plus circles (one per
              waypoint) so variable widths join smoothly. */}
          <PathRibbon path={lvl.path} levelWidth={lvl.width} fill={ACCENT} fillOpacity={0.2} expand={4} />
          <PathRibbon path={lvl.path} levelWidth={lvl.width} fill={ACCENT} fillOpacity={0.85} expand={0} />
          <PathRibbon
            path={lvl.path}
            levelWidth={lvl.width}
            fill={colors.bg}
            fillOpacity={0.55}
            expand={-8}
          />

          {/* Edge warning — red ribbon overlay when ball is close */}
          {phase === 'playing' && proximity > EDGE_WARN_RATIO ? (
            <PathRibbon
              path={lvl.path}
              levelWidth={lvl.width}
              fill={neon('red')}
              fillOpacity={proximity > EDGE_DANGER_RATIO ? 0.45 : 0.22}
              expand={2}
            />
          ) : null}

          {/* TILE EFFECTS — oriented rectangles aligned along the path
              tangent, width matching the local path width, with chevron
              arrows: >> for boost (yellow), << for slow (purple). */}
          {(lvl.tiles ?? []).map((t, i) => (
            <TileRect key={`tile-${i}`} tile={t} path={lvl.path} levelWidth={lvl.width} />
          ))}

          {/* Start marker */}
          <Circle
            cx={lvl.path[0].x}
            cy={lvl.path[0].y}
            r={(lvl.path[0].width ?? lvl.width) / 2 + 4}
            fill="none"
            stroke={colors.textDim}
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />

          {/* End marker */}
          <Circle
            cx={lvl.path[lvl.path.length - 1].x}
            cy={lvl.path[lvl.path.length - 1].y}
            r={(lvl.path[lvl.path.length - 1].width ?? lvl.width) / 2 - 4}
            fill="url(#endGlow)"
          />
          <Circle
            cx={lvl.path[lvl.path.length - 1].x}
            cy={lvl.path[lvl.path.length - 1].y}
            r={BALL_RADIUS + 2}
            fill="none"
            stroke={neon('yellow')}
            strokeWidth={2}
          />

          {/* Hazards */}
          {lvl.hazards.map((hz, i) => {
            const pos = hazardPosition(hz, now, lapMultiplier(lapForAbs(levelIdxRef.current)));
            return (
              <G key={`hz-${i}`}>
                <Circle cx={hz.pivot.x} cy={hz.pivot.y} r={4} fill={colors.textMute} />
                <Line
                  x1={hz.pivot.x}
                  y1={hz.pivot.y}
                  x2={pos.x}
                  y2={pos.y}
                  stroke={colors.textMute}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                />
                <Circle cx={pos.x} cy={pos.y} r={hz.radius} fill={neon('red')} fillOpacity={0.9} />
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={hz.radius - 4}
                  fill={neon('red')}
                  fillOpacity={0.5}
                />
              </G>
            );
          })}

          {/* Ball — outer glow, core, highlight */}
          <Circle cx={ball.x} cy={ball.y} r={BALL_RADIUS + 5} fill={ACCENT} fillOpacity={0.35} />
          <Circle cx={ball.x} cy={ball.y} r={BALL_RADIUS} fill={ACCENT} />
          <Circle
            cx={ball.x - 2}
            cy={ball.y - 2}
            r={BALL_RADIUS / 2.5}
            fill={colors.bgSurface}
            fillOpacity={0.7}
          />
        </Svg>

        <ScanlineOverlay opacity={0.04} />

        {/* READY — tilt-to-start */}
        {phase === 'ready' ? (
          <View style={overlayStyle('25%')}>
            <ArcadeText
              variant="pixel"
              size={20}
              color={ACCENT}
              glowColor={ACCENT}
              align="center"
            >
              {'TILT MAZE'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText
              variant="mono"
              size={16}
              color={colors.textDim}
              align="center"
            >
              {`STAY ON THE PATH.\nLOOPS WITH STACKING DIFFICULTY.\nONE LIFE.`}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <Blink>
              <ArcadeText
                variant="pixel"
                size={11}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {'TILT TO START'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="pixel" size={8} color={colors.textMute}>
              {'(3-2-1 BEFORE BALL ROLLS)'}
            </ArcadeText>
          </View>
        ) : null}

        {/* COUNTDOWN — 3, 2, 1, GO with ball already at start */}
        {phase === 'countdown' ? (
          <View style={overlayStyle('38%')}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'GET READY'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText
              variant="pixel"
              size={72}
              color={countdown === 0 ? neon('green') : ACCENT}
              glowColor={countdown === 0 ? neon('green') : ACCENT}
              glowRadius={18}
            >
              {countdown === 0 ? 'GO' : String(countdown)}
            </ArcadeText>
          </View>
        ) : null}

        {/* LEVEL-CLEAR */}
        {phase === 'level-clear' ? (
          <View style={overlayStyle('40%')}>
            <ArcadeText
              variant="pixel"
              size={18}
              color={neon('green')}
              glowColor={neon('green')}
              align="center"
            >
              {'CLEARED!'}
            </ArcadeText>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="mono" size={16} color={colors.textDim}>
              {`L${levelIdx + 1} → L${levelIdx + 2}`}
            </ArcadeText>
          </View>
        ) : null}

        {/* FAIL */}
        {phase === 'fail' ? (
          <View style={overlayStyle('40%')}>
            <Blink intervalMs={300} minOpacity={0.3}>
              <ArcadeText
                variant="pixel"
                size={20}
                color={neon('red')}
                glowColor={neon('red')}
                glowRadius={14}
                align="center"
              >
                {'OFF THE PATH'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="mono" size={16} color={colors.textDim}>
              {`L${levelIdx + 1} · ${(elapsedMsRef.current / 1000).toFixed(1)}s`}
            </ArcadeText>
          </View>
        ) : null}

        {/* ALL CLEAR */}
        {phase === 'all-clear' ? (
          <View style={overlayStyle('40%')}>
            <Blink intervalMs={400} minOpacity={0.4}>
              <ArcadeText
                variant="pixel"
                size={22}
                color={neon('yellow')}
                glowColor={neon('yellow')}
                glowRadius={18}
                align="center"
              >
                {'!! ALL CLEAR !!'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="mono" size={16} color={colors.textDim}>
              {`${(elapsedMsRef.current / 1000).toFixed(1)}s`}
            </ArcadeText>
          </View>
        ) : null}
      </View>
      <InGameExit />
    </View>
  );
}

// =====================================================================
// PathRibbon — renders a path with variable per-waypoint widths as a
// continuous ribbon: a polygon per segment plus a cap circle at each
// waypoint to smooth the joins. `expand` adds (or removes, if negative)
// a uniform amount to the half-width on every vertex — used to render
// halo/inner-channel layers.
// =====================================================================
function PathRibbon({
  path,
  levelWidth,
  fill,
  fillOpacity,
  expand = 0,
}: {
  path: Point[];
  levelWidth: number;
  fill: string;
  fillOpacity: number;
  expand?: number;
}) {
  const halfWidthAt = (p: Point) => Math.max(1, (p.width ?? levelWidth) / 2 + expand);

  const segments: React.ReactNode[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const wA = halfWidthAt(a);
    const wB = halfWidthAt(b);
    const points = [
      `${a.x + px * wA},${a.y + py * wA}`,
      `${b.x + px * wB},${b.y + py * wB}`,
      `${b.x - px * wB},${b.y - py * wB}`,
      `${a.x - px * wA},${a.y - py * wA}`,
    ].join(' ');
    segments.push(
      <SvgPolygon
        key={`seg-${i}-${expand}`}
        points={points}
        fill={fill}
        fillOpacity={fillOpacity}
      />,
    );
  }

  // Cap circles at every waypoint smooth the joins (especially at sharp
  // bends and width transitions).
  const caps = path.map((p, i) => (
    <Circle
      key={`cap-${i}-${expand}`}
      cx={p.x}
      cy={p.y}
      r={halfWidthAt(p)}
      fill={fill}
      fillOpacity={fillOpacity}
    />
  ));

  return (
    <>
      {segments}
      {caps}
    </>
  );
}

function overlayStyle(top: string) {
  return {
    position: 'absolute' as const,
    top: top as any,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.lg,
  };
}

// =====================================================================
// Math helpers
// =====================================================================

/**
 * Returns a "proximity ratio" of (px,py) to the path:
 *   0 = on the centerline
 *   1 = exactly at the path edge
 *   >1 = off the path (failure)
 *
 * Path width is interpolated linearly between segment endpoints' widths.
 */
function pathProximityRatio(
  px: number,
  py: number,
  path: Point[],
  defaultWidth: number,
): number {
  let bestDist = Infinity;
  let bestHalfWidth = defaultWidth / 2;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen2 = dx * dx + dy * dy;
    if (segLen2 < 1e-6) continue;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / segLen2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;
    if (d2 < bestDist) {
      bestDist = d2;
      const wA = a.width ?? defaultWidth;
      const wB = b.width ?? defaultWidth;
      bestHalfWidth = (wA + (wB - wA) * t) / 2;
    }
  }
  return Math.sqrt(bestDist) / bestHalfWidth;
}

/**
 * Returns the unit tangent vector of the path at the closest point to p.
 * Used to orient tile-effect rectangles along the path direction and to
 * project the ball onto the along-path axis for tile collision.
 */
function pathTangentAt(p: Point, path: Point[]): { tx: number; ty: number } {
  let bestDist = Infinity;
  let tx = 1, ty = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen2 = dx * dx + dy * dy;
    if (segLen2 < 1e-6) continue;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / segLen2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d2 < bestDist) {
      bestDist = d2;
      const len = Math.sqrt(segLen2);
      tx = dx / len;
      ty = dy / len;
    }
  }
  return { tx, ty };
}

/**
 * Returns the path's local half-width at p — interpolated along the
 * closest segment. Used to size the tile rectangle to match the path.
 */
function pathHalfWidthAt(p: Point, path: Point[], defaultWidth: number): number {
  let bestDist = Infinity;
  let half = defaultWidth / 2;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen2 = dx * dx + dy * dy;
    if (segLen2 < 1e-6) continue;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / segLen2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d2 < bestDist) {
      bestDist = d2;
      const wA = a.width ?? defaultWidth;
      const wB = b.width ?? defaultWidth;
      half = (wA + (wB - wA) * t) / 2;
    }
  }
  return half;
}

/**
 * Renders a single tile effect as an oriented rectangle with chevron
 * arrows. Boost = yellow with >> chevrons pointing along path direction;
 * slow = purple with << chevrons pointing against. Width matches the
 * path's local width so the tile reads as "this entire stretch of path
 * is sticky / fast."
 */
function TileRect({
  tile,
  path,
  levelWidth,
}: {
  tile: { pos: Point; length: number; kind: 'boost' | 'slow' };
  path: Point[];
  levelWidth: number;
}) {
  const tan = pathTangentAt(tile.pos, path);
  const angleDeg = (Math.atan2(tan.ty, tan.tx) * 180) / Math.PI;
  const halfL = tile.length / 2;
  const halfW = pathHalfWidthAt(tile.pos, path, levelWidth);
  const isBoost = tile.kind === 'boost';
  const fill = isBoost ? neon('yellow') : neon('purple');

  // Chevron count — scales with tile length so longer tiles get more arrows.
  const arrowCount = Math.max(2, Math.floor(tile.length / 26));
  const arrowSpan = Math.min(tile.length - 18, 80);
  const arrowStep = arrowCount > 1 ? arrowSpan / (arrowCount - 1) : 0;
  const arrowStart = -arrowSpan / 2;

  // Each chevron is a small "V" in tile-local space. For boost we point
  // forward (>>), for slow we point backward (<<).
  function chevron(cx: number) {
    const sz = 4.5;
    if (isBoost) {
      return `M ${cx - sz} ${-sz} L ${cx + sz} 0 L ${cx - sz} ${sz}`;
    }
    return `M ${cx + sz} ${-sz} L ${cx - sz} 0 L ${cx + sz} ${sz}`;
  }

  return (
    <G transform={`translate(${tile.pos.x}, ${tile.pos.y}) rotate(${angleDeg})`}>
      {/* Soft halo */}
      <Rect
        x={-halfL - 2}
        y={-halfW - 2}
        width={halfL * 2 + 4}
        height={halfW * 2 + 4}
        fill={fill}
        fillOpacity={0.18}
        rx={3}
      />
      {/* Main fill */}
      <Rect
        x={-halfL}
        y={-halfW}
        width={halfL * 2}
        height={halfW * 2}
        fill={fill}
        fillOpacity={0.6}
        rx={2}
      />
      {/* Edge stripes — turbo-sign feel */}
      <Line x1={-halfL} y1={-halfW} x2={halfL} y2={-halfW} stroke={fill} strokeWidth={2} />
      <Line x1={-halfL} y1={halfW} x2={halfL} y2={halfW} stroke={fill} strokeWidth={2} />
      {/* Chevron arrows */}
      {Array.from({ length: arrowCount }).map((_, i) => (
        <SvgPath
          key={`ch-${i}`}
          d={chevron(arrowStart + i * arrowStep)}
          stroke="#08080f"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </G>
  );
}

function hazardPosition(hz: Hazard, nowMs: number, speedMult: number = 1): Point {
  const phase = hz.phase ?? 0;
  const amp = hz.amplitude ?? Math.PI / 2.6;
  // Faster swing in higher laps: shorter effective period.
  const period = hz.periodMs / Math.max(0.2, speedMult);
  const angle =
    Math.sin(2 * Math.PI * (nowMs / period) + phase * 2 * Math.PI) * amp;
  return {
    x: hz.pivot.x + Math.sin(angle) * hz.armLength,
    y: hz.pivot.y + Math.cos(angle) * hz.armLength,
  };
}
