// Minesweep — read-the-chaos color-wipe survival.
//
// A field of moving dots in 5 colors. Tap a spot:
//   - The most-represented color inside an 80px blast radius is selected.
//   - Only dots of THAT color INSIDE the radius vanish. Dots of the same
//     color elsewhere on the field survive — you have to find them and
//     blast them too.
//   - Empty blast (zero dots in the radius) ends the game immediately.
//   - Tie inside the blast: break by lookup order (deterministic).
//
// Levels add more, smaller, faster dots — quantity is the primary
// difficulty axis, speed is a supporting one. Between levels we play a
// short "pipe drops in / loads the next batch" transition that scales
// with level (early levels feel snappier).
//
// Score model is composite: level_reached * 10000 - taps_used. This packs
// "levels cleared" as the primary leaderboard sort and "fewest taps" as
// the natural tiebreaker into a single sortable number, while the result
// screen pulls them back apart for a "L4 · 23" display.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { GameIcon } from '../../src/components/GameIcon';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

// --- Tunables ----------------------------------------------------------
const BLAST_RADIUS_PX = 40;
const HUD_RESERVE_PX = 100;
const TICK_MS = 33; // ~30Hz — smooth enough, half the cost of 60Hz
const GAME_OVER_FREEZE_MS = 1500;
const DEATH_FX_MS = 380; // expanding-ring shockwave per dead dot
const TAP_FX_MS = 700; // floating "+N" at the blast point

// Ordered palette — also the rendering order for the SVG circles.
const DOT_COLORS = ['cyan', 'magenta', 'yellow', 'green', 'purple'] as const;
type DotColor = (typeof DOT_COLORS)[number];

// Per-level shape of the field. Anything past the table extends with a
// flat dot count and a slightly bumped speed each level — past level 5 we
// stop adding dots (the screen is already dense) and just turn up the
// pressure.
type LevelSpec = {
  level: number;
  totalDots: number;
  perColor: number;
  radius: number;
  speed: number;
};

function specForLevel(level: number): LevelSpec {
  const QUANTITIES = [25, 50, 100, 200, 400];
  const RADII = [12, 10, 8, 7, 6];
  const totalDots = QUANTITIES[Math.min(level, 5) - 1];
  const radius = level <= 5 ? RADII[level - 1] : 5;
  const speed = 100 + (level - 1) * 15;
  return {
    level,
    totalDots,
    perColor: totalDots / DOT_COLORS.length,
    radius,
    speed,
  };
}

// Transition duration scales mildly with level so early levels feel snappier.
function transitionMsForLevel(level: number): number {
  return Math.min(1500, 700 + level * 100);
}

const ACCENT = neon('orange');

// --- Types -------------------------------------------------------------
type Phase = 'ready' | 'transitioning' | 'live' | 'done';

type Dot = {
  id: number;
  color: DotColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

// Visual feedback when a dot is killed — an expanding stroked ring in the
// dot's color. Lives DEATH_FX_MS, then garbage-collected by the game loop.
type DeathFx = {
  id: number;
  color: DotColor;
  x: number;
  y: number;
  initialR: number;
  spawnedAt: number;
};

// Floating "+N" at the blast point — tells you how many you killed.
type TapFx = {
  id: number;
  x: number;
  y: number;
  count: number;
  color: DotColor;
  spawnedAt: number;
};

let dotIdCounter = 0;
let fxIdCounter = 0;

export default function MinesweepGame() {
  // State (drives renders).
  const [phase, setPhase] = useState<Phase>('ready');
  const [level, setLevel] = useState(1);
  const [tapsThisLevel, setTapsThisLevel] = useState(0);
  const [totalTaps, setTotalTaps] = useState(0);
  const [tick, setTick] = useState(0); // bumped each frame to force re-render
  const [lastBlast, setLastBlast] = useState<{ x: number; y: number } | null>(null);
  const [transitionLevel, setTransitionLevel] = useState(1);

  // Refs (canonical for async/timer callbacks).
  const phaseRef = useRef<Phase>('ready');
  const levelRef = useRef(1);
  const tapsThisLevelRef = useRef(0);
  const totalTapsRef = useRef(0);
  const dotsRef = useRef<Dot[]>([]);
  const deathFxRef = useRef<DeathFx[]>([]);
  const tapFxRef = useRef<TapFx[]>([]);
  const boundsRef = useRef({ width: 0, height: 0 });
  const lastFrameRef = useRef(Date.now());
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blastFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  function clearAllTimers() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    if (blastFadeTimeoutRef.current) clearTimeout(blastFadeTimeoutRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    rafRef.current = null;
    transitionTimeoutRef.current = null;
    blastFadeTimeoutRef.current = null;
    finishTimeoutRef.current = null;
  }

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }
  function setLevelSafe(n: number) {
    levelRef.current = n;
    setLevel(n);
  }

  function startGame() {
    levelRef.current = 1;
    tapsThisLevelRef.current = 0;
    totalTapsRef.current = 0;
    setLevel(1);
    setTapsThisLevel(0);
    setTotalTaps(0);
    startTimeRef.current = Date.now();
    enterTransition(1);
  }

  function enterTransition(targetLevel: number) {
    setLevelSafe(targetLevel);
    setTransitionLevel(targetLevel);
    setPhaseSafe('transitioning');
    // Hide dots during transition so the pipe "drops" in clean.
    dotsRef.current = [];
    setTick((t) => t + 1);

    const dur = transitionMsForLevel(targetLevel);
    transitionTimeoutRef.current = setTimeout(() => {
      spawnDotsForLevel(targetLevel);
      beginLive();
    }, dur);
  }

  function spawnDotsForLevel(targetLevel: number) {
    const spec = specForLevel(targetLevel);
    const { width, height } = boundsRef.current;
    const dots: Dot[] = [];
    for (let i = 0; i < spec.totalDots; i++) {
      const color = DOT_COLORS[i % DOT_COLORS.length];
      const x = spec.radius + Math.random() * Math.max(1, width - 2 * spec.radius);
      const yMin = HUD_RESERVE_PX + spec.radius;
      const yMax = Math.max(yMin + 1, height - spec.radius);
      const y = yMin + Math.random() * (yMax - yMin);
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * spec.speed;
      const vy = Math.sin(angle) * spec.speed;
      dots.push({ id: ++dotIdCounter, color, x, y, vx, vy, r: spec.radius });
    }
    dotsRef.current = dots;
    tapsThisLevelRef.current = 0;
    setTapsThisLevel(0);
  }

  function beginLive() {
    setPhaseSafe('live');
    lastFrameRef.current = Date.now();
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  function gameLoop() {
    if (phaseRef.current !== 'live') return;
    const now = Date.now();
    if (now - lastFrameRef.current >= TICK_MS) {
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      stepDots(dt);
      reapFx(now);
      setTick((t) => t + 1);
    }
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  // Drop expired visual effects so they don't pile up forever.
  function reapFx(now: number) {
    if (deathFxRef.current.length > 0) {
      deathFxRef.current = deathFxRef.current.filter(
        (fx) => now - fx.spawnedAt < DEATH_FX_MS,
      );
    }
    if (tapFxRef.current.length > 0) {
      tapFxRef.current = tapFxRef.current.filter(
        (fx) => now - fx.spawnedAt < TAP_FX_MS,
      );
    }
  }

  function stepDots(dt: number) {
    const { width, height } = boundsRef.current;
    const ceilY = HUD_RESERVE_PX;
    // Mutate in place — with ~400 dots, allocating new objects per frame
    // is the difference between buttery and choppy.
    const arr = dotsRef.current;
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < d.r) {
        d.x = d.r;
        d.vx = -d.vx;
      } else if (d.x > width - d.r) {
        d.x = width - d.r;
        d.vx = -d.vx;
      }
      if (d.y < ceilY + d.r) {
        d.y = ceilY + d.r;
        d.vy = -d.vy;
      } else if (d.y > height - d.r) {
        d.y = height - d.r;
        d.vy = -d.vy;
      }
    }
  }

  function handleTap(e: GestureResponderEvent) {
    const tapX = e.nativeEvent.locationX;
    const tapY = e.nativeEvent.locationY;
    const p = phaseRef.current;

    if (p === 'ready') {
      startGame();
      return;
    }
    if (p !== 'live') return;

    // Bookkeeping — every tap counts.
    tapsThisLevelRef.current += 1;
    totalTapsRef.current += 1;
    setTapsThisLevel(tapsThisLevelRef.current);
    setTotalTaps(totalTapsRef.current);

    // Show the blast ring momentarily, regardless of outcome.
    setLastBlast({ x: tapX, y: tapY });
    if (blastFadeTimeoutRef.current) clearTimeout(blastFadeTimeoutRef.current);
    blastFadeTimeoutRef.current = setTimeout(() => setLastBlast(null), 240);

    // Find dots within the blast.
    const all = dotsRef.current;
    const inBlast: Dot[] = [];
    for (const d of all) {
      if (Math.hypot(d.x - tapX, d.y - tapY) <= BLAST_RADIUS_PX) inBlast.push(d);
    }

    // Empty blast = game over. The unforgiving rule that gives the late
    // game (when only one color is left) its bite.
    if (inBlast.length === 0) {
      triggerGameOver();
      return;
    }

    // Most-represented color within the blast wins. Tie → first inserted
    // (deterministic, no need to peek at the global field).
    const blastCounts = new Map<DotColor, number>();
    for (const d of inBlast) blastCounts.set(d.color, (blastCounts.get(d.color) ?? 0) + 1);

    let topColor: DotColor | null = null;
    let topBlast = 0;
    for (const [c, n] of blastCounts) {
      if (n > topBlast) {
        topColor = c;
        topBlast = n;
      }
    }

    if (!topColor) return; // shouldn't happen, but guard anyway

    // Local wipe: remove only the dominant-color dots that were inside the
    // blast radius. Same-color dots elsewhere on the field stay alive and
    // have to be hunted down with future blasts.
    const removeIds = new Set<number>();
    const nowMs = Date.now();
    const newDeaths: DeathFx[] = [];
    for (const d of inBlast) {
      if (d.color === topColor) {
        removeIds.add(d.id);
        newDeaths.push({
          id: ++fxIdCounter,
          color: d.color,
          x: d.x,
          y: d.y,
          initialR: d.r,
          spawnedAt: nowMs,
        });
      }
    }
    if (newDeaths.length > 0) {
      deathFxRef.current = [...deathFxRef.current, ...newDeaths];
      tapFxRef.current = [
        ...tapFxRef.current,
        {
          id: ++fxIdCounter,
          x: tapX,
          y: tapY,
          count: newDeaths.length,
          color: topColor,
          spawnedAt: nowMs,
        },
      ];
    }
    dotsRef.current = all.filter((d) => !removeIds.has(d.id));
    setTick((t) => t + 1);

    // Cleared the field — advance.
    if (dotsRef.current.length === 0) {
      enterTransition(levelRef.current + 1);
    }
  }

  function triggerGameOver() {
    if (phaseRef.current !== 'live') return;
    setPhaseSafe('done');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    finishTimeoutRef.current = setTimeout(routeToResult, GAME_OVER_FREEZE_MS);
  }

  function routeToResult() {
    const reachedLevel = levelRef.current;
    const taps = totalTapsRef.current;
    // Composite encoding — see header comment.
    const composite = reachedLevel * 10000 - taps;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'minesweep',
        score: String(composite),
        level: String(reachedLevel),
        taps: String(taps),
        duration: elapsed.toFixed(1),
      },
    });
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    boundsRef.current = { width, height };
  }

  // Pull from refs at render time so the SVG always sees the live array
  // even though the trigger for re-render is the `tick` counter.
  const dotsForRender = dotsRef.current;
  const deathFxForRender = deathFxRef.current;
  const tapFxForRender = tapFxRef.current;
  const renderNow = Date.now();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable onPress={handleTap} onLayout={onLayout} style={{ flex: 1 }}>
        {/* HUD */}
        <SafeAreaView edges={['top']} pointerEvents="none">
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
                {'LEVEL'}
              </ArcadeText>
              <ArcadeText variant="mono" size={22} color={ACCENT} glowColor={ACCENT}>
                {`L${level}`}
              </ArcadeText>
              {phase === 'live' ? (
                <ArcadeText variant="pixel" size={7} color={colors.textDim}>
                  {`${dotsForRender.length} DOTS`}
                </ArcadeText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'TAPS'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {String(totalTaps).padStart(3, '0')}
              </ArcadeText>
              <ArcadeText variant="pixel" size={7} color={colors.textDim}>
                {`+${tapsThisLevel} THIS LV`}
              </ArcadeText>
            </View>
          </View>
        </SafeAreaView>

        {/* Dot field + death-shockwaves. Re-renders driven by the tick
            counter; positions read from the live refs. Death FX render
            after the dots so they layer on top. */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {dotsForRender.map((d) => (
            <Circle
              key={d.id}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill={neon(d.color)}
            />
          ))}
          {deathFxForRender.map((fx) => {
            const age = Math.min(1, (renderNow - fx.spawnedAt) / DEATH_FX_MS);
            const r = fx.initialR * (1 + age * 2.8);
            const op = 1 - age;
            return (
              <Circle
                key={`fx-${fx.id}`}
                cx={fx.x}
                cy={fx.y}
                r={r}
                stroke={neon(fx.color)}
                strokeWidth={3}
                fill="none"
                opacity={op}
              />
            );
          })}
        </Svg>

        {/* Floating "+N" tags at each blast point */}
        {tapFxForRender.map((fx) => {
          const age = Math.min(1, (renderNow - fx.spawnedAt) / TAP_FX_MS);
          // Quick fade-in (0–20%), hold, then fade out the rest of the way.
          const op = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 0.8;
          const lift = -age * 44;
          return (
            <View
              key={`tapfx-${fx.id}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: fx.x - 50,
                top: fx.y - 14 + lift,
                width: 100,
                alignItems: 'center',
                opacity: Math.max(0, op),
              }}
            >
              <ArcadeText
                variant="mono"
                size={fx.count >= 3 ? 26 : 22}
                color={neon(fx.color)}
                glowColor={neon(fx.color)}
              >
                {`+${fx.count}`}
              </ArcadeText>
            </View>
          );
        })}

        {/* Blast ring */}
        {lastBlast ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: lastBlast.x - BLAST_RADIUS_PX,
              top: lastBlast.y - BLAST_RADIUS_PX,
              width: BLAST_RADIUS_PX * 2,
              height: BLAST_RADIUS_PX * 2,
              borderRadius: BLAST_RADIUS_PX,
              borderWidth: 2,
              borderColor: ACCENT,
              opacity: 0.6,
            }}
          />
        ) : null}

        {/* READY */}
        {phase === 'ready' ? (
          <View style={overlayStyle('30%')}>
            <GameIcon id="minesweep" size={88} color={ACCENT} />
            <View style={{ height: spacing.lg }} />
            <ArcadeText
              variant="pixel"
              size={20}
              color={ACCENT}
              glowColor={ACCENT}
              align="center"
            >
              {'MINESWEEP'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="mono" size={17} color={colors.textDim} align="center">
              {'READ THE FIELD.\nBLAST CLEARS THE DOMINANT\nCOLOR INSIDE THE RADIUS ONLY.\nEMPTY BLAST = GAME OVER.'}
            </ArcadeText>
            <View style={{ height: spacing.xl }} />
            <Blink>
              <ArcadeText
                variant="pixel"
                size={12}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {'TAP TO BEGIN'}
              </ArcadeText>
            </Blink>
          </View>
        ) : null}

        {/* TRANSITION — the pipe + level callout */}
        {phase === 'transitioning' ? (
          <PipeTransition level={transitionLevel} totalDots={specForLevel(transitionLevel).totalDots} />
        ) : null}

        {/* GAME OVER */}
        {phase === 'done' ? (
          <View style={overlayStyle('38%')}>
            <Blink intervalMs={280} minOpacity={0.3}>
              <ArcadeText
                variant="pixel"
                size={22}
                color={neon('red')}
                glowColor={neon('red')}
                glowRadius={16}
                align="center"
              >
                {'EMPTY  BLAST!'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="mono" size={20} color={colors.textDim}>
              {`L${levelRef.current}  ·  ${totalTapsRef.current} TAPS`}
            </ArcadeText>
          </View>
        ) : null}

        <ScanlineOverlay opacity={0.05} />
        <InGameExit />
      </Pressable>
    </View>
  );
}

// ----------------------------------------------------------------------
// PipeTransition — drops a stylized pipe in from above the play field,
// holds the LEVEL N callout, then retracts. The pipe doesn't literally
// produce dots; the implication carries the moment.
function PipeTransition({ level, totalDots }: { level: number; totalDots: number }) {
  const pipeY = useRef(new Animated.Value(-160)).current;
  const textOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const slideMs = 260;
    const fadeMs = 240;
    const total = transitionMsForLevel(level);
    const holdMs = Math.max(0, total - slideMs - fadeMs);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(pipeY, {
          toValue: 0,
          duration: slideMs,
          useNativeDriver: true,
        }),
        Animated.timing(textOp, {
          toValue: 1,
          duration: slideMs,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(holdMs),
      Animated.parallel([
        Animated.timing(pipeY, {
          toValue: -160,
          duration: fadeMs,
          useNativeDriver: true,
        }),
        Animated.timing(textOp, {
          toValue: 0,
          duration: fadeMs,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [level, pipeY, textOp]);

  const pipeColor = neon('cyan');

  return (
    <>
      {/* Pipe — body + flared mouth, slides in from above. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: HUD_RESERVE_PX - 60,
          left: '50%',
          marginLeft: -34,
          width: 68,
          transform: [{ translateY: pipeY }],
        }}
      >
        <View
          style={{
            width: 60,
            height: 64,
            marginLeft: 4,
            backgroundColor: pipeColor,
          }}
        />
        {/* Flared mouth — slightly wider, bottom edge of the pipe. */}
        <View
          style={{
            width: 68,
            height: 14,
            backgroundColor: pipeColor,
          }}
        />
        {/* Inner highlight stripe — gives the pipe a tiny bit of depth. */}
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            width: 6,
            height: 56,
            backgroundColor: colors.bgElevated,
            opacity: 0.5,
          }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '38%',
          left: 0,
          right: 0,
          alignItems: 'center',
          opacity: textOp,
        }}
      >
        <ArcadeText
          variant="pixel"
          size={36}
          color={neon('yellow')}
          glowColor={neon('yellow')}
          glowRadius={16}
        >
          {level === 1 ? 'GET  READY' : `LEVEL  ${level}`}
        </ArcadeText>
        <View style={{ height: spacing.sm }} />
        <ArcadeText variant="pixel" size={9} color={colors.textDim}>
          {`${totalDots} DOTS LOADING`}
        </ArcadeText>
        {level > 1 ? (
          <View style={{ marginTop: spacing.sm }}>
            <ArcadeText variant="pixel" size={8} color={neon('green')} glowColor={neon('green')}>
              {'NICE CLEAR!'}
            </ArcadeText>
          </View>
        ) : null}
      </Animated.View>
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
    paddingHorizontal: spacing.xl,
  };
}
