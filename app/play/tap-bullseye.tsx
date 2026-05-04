// Tap Bullseye — continuous-spawn survival mode.
//
// Targets keep appearing at an accelerating cadence. Each one lives 3.5
// seconds, fading from full opacity to invisible — when it disappears,
// the game is over. Tap within 40px of a target's center to consume it
// (closer to dead-center scores higher). Tap *outside* any present target
// and the game ends immediately. Tapping in a brief gap with no targets
// alive is a no-op (so the moment after countdown isn't a death-trap).
//
// Combo multiplier: hits 5/10/15 unlock x2/x3/x4 score on every consume.
//
// Spawn cadence:   0.9s start → -0.06s every 3s elapsed → 0.35s floor.
// Per-target life: 3,500ms (full fade 1.0 → 0).
// Per-tap score:   (speed + accuracy) × multiplier, base max 2,000.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { GameIcon } from '../../src/components/GameIcon';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const TARGET_SIZE = 72;
const TARGET_LIFE_MS = 3500;
const CONSUME_RADIUS_PX = 40;
const MIN_TARGET_SPACING = 96;
const MAX_PLACEMENT_ATTEMPTS = 60;

const SPAWN_INITIAL_MS = 900;
const SPAWN_FLOOR_MS = 350;
const SPAWN_RAMP_STEP_MS = 60;
const SPAWN_RAMP_INTERVAL_S = 3;

// "Perfect" hit zone — tap inside this radius (well tighter than the
// CONSUME_RADIUS_PX survival zone) and it counts toward the combo streak.
// A safe-but-not-perfect tap still consumes the target; it just resets
// the streak. So the multiplier rewards precision, not survival.
const PERFECT_RADIUS_PX = 8;

// Streak unlocks: consecutive perfect taps → multiplier.
const COMBO_TIERS: ReadonlyArray<{ at: number; multiplier: number }> = [
  { at: 10, multiplier: 4 },
  { at: 6, multiplier: 3 },
  { at: 3, multiplier: 2 },
];

// Score milestones — each fires once when the running total crosses it.
// They get progressively larger, more rotated, longer-lived, and at the
// upper tiers add a translucent screen flash. Pure distraction by design:
// the popups *are* an obstacle the player has to play around at scale.
type Milestone = {
  threshold: number;
  label: string;
  size: number;
  durationMs: number;
  color: 'green' | 'cyan' | 'magenta' | 'yellow' | 'red';
  rotationDeg: number;
  flashOpacity: number; // 0 means no screen flash
};

const MILESTONES: ReadonlyArray<Milestone> = [
  { threshold: 5_000,   label: 'GOOD!',    size: 26, durationMs: 600,  color: 'green',   rotationDeg: 0,  flashOpacity: 0 },
  { threshold: 12_500,  label: 'GREAT!',   size: 34, durationMs: 700,  color: 'cyan',    rotationDeg: -2, flashOpacity: 0 },
  { threshold: 25_000,  label: 'NICE!',    size: 48, durationMs: 800,  color: 'magenta', rotationDeg: 3,  flashOpacity: 0.08 },
  { threshold: 50_000,  label: 'AMAZING!', size: 38, durationMs: 900,  color: 'yellow',  rotationDeg: -4, flashOpacity: 0.12 },
  { threshold: 75_000,  label: 'WOW!',     size: 64, durationMs: 950,  color: 'magenta', rotationDeg: 5,  flashOpacity: 0.16 },
  { threshold: 100_000, label: 'EPIC!',    size: 72, durationMs: 1000, color: 'yellow',  rotationDeg: -6, flashOpacity: 0.20 },
  { threshold: 150_000, label: 'GODLIKE!', size: 50, durationMs: 1100, color: 'cyan',    rotationDeg: 7,  flashOpacity: 0.24 },
  { threshold: 200_000, label: 'LEGEND!',  size: 60, durationMs: 1200, color: 'red',     rotationDeg: -8, flashOpacity: 0.28 },
];

const COUNTDOWN_STEP_MS = 800;
const GAME_OVER_FREEZE_MS = 1500;

const HUD_RESERVE_PX = 110;
const EDGE_MARGIN_PX = 56;

const ACCENT = neon('magenta');

type Phase = 'ready' | 'countdown' | 'live' | 'done';

type LiveTarget = {
  id: number;
  x: number;
  y: number;
  spawnedAt: number;
  opacity: Animated.Value;
};

type HitFx = {
  id: number;
  x: number;
  y: number;
  score: number;
  perfect: boolean;
};

let targetIdCounter = 0;
let hitFxIdCounter = 0;

export default function TapBullseyeGame() {
  // Visible state.
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [targets, setTargets] = useState<LiveTarget[]>([]);
  const [hitFxs, setHitFxs] = useState<HitFx[]>([]);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 0>(3);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [killerId, setKillerId] = useState<number | null>(null);
  const [missAt, setMissAt] = useState<{ x: number; y: number } | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);

  // Refs for callbacks/timers — async code can't read state directly.
  const phaseRef = useRef<Phase>('ready');
  const scoreRef = useRef(0);
  const targetsRef = useRef<LiveTarget[]>([]);
  const gameStartAtRef = useRef(0);
  const boundsRef = useRef({ width: 0, height: 0 });
  const spawnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryTimeoutsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const perfectStreakRef = useRef(0);
  const multiplierRef = useRef(1);
  const milestoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  function clearAllTimers() {
    if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
    expiryTimeoutsRef.current.forEach((t) => clearTimeout(t));
    expiryTimeoutsRef.current.clear();
    spawnTimeoutRef.current = null;
    elapsedIntervalRef.current = null;
    finishTimeoutRef.current = null;
    countdownTimeoutRef.current = null;
    milestoneTimeoutRef.current = null;
  }

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }
  function setScoreSafe(s: number) {
    scoreRef.current = s;
    setScore(s);
  }
  function setTargetsSafe(t: LiveTarget[]) {
    targetsRef.current = t;
    setTargets(t);
  }

  function startCountdown() {
    setPhaseSafe('countdown');
    setScoreSafe(0);
    setElapsedSec(0);
    setKillerId(null);
    setMissAt(null);
    perfectStreakRef.current = 0;
    multiplierRef.current = 1;
    setMultiplier(1);
    setActiveMilestone(null);
    setCountdown(3);

    countdownTimeoutRef.current = setTimeout(() => {
      setCountdown(2);
      countdownTimeoutRef.current = setTimeout(() => {
        setCountdown(1);
        countdownTimeoutRef.current = setTimeout(() => {
          setCountdown(0);
          beginPlay();
        }, COUNTDOWN_STEP_MS);
      }, COUNTDOWN_STEP_MS);
    }, COUNTDOWN_STEP_MS);
  }

  function beginPlay() {
    setPhaseSafe('live');
    gameStartAtRef.current = Date.now();
    setTargetsSafe([]);

    // Tick elapsed time at 10Hz so the HUD reads tenths of a second.
    elapsedIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - gameStartAtRef.current) / 1000;
      setElapsedSec(elapsed);
    }, 100);

    // Kick the spawn loop. First target arrives quickly so the game starts
    // hot — no awkward dead air after the countdown.
    spawnTimeoutRef.current = setTimeout(() => spawnAndSchedule(), 250);
  }

  function currentCadenceMs(): number {
    const elapsedSeconds = (Date.now() - gameStartAtRef.current) / 1000;
    const steps = Math.floor(elapsedSeconds / SPAWN_RAMP_INTERVAL_S);
    return Math.max(SPAWN_FLOOR_MS, SPAWN_INITIAL_MS - steps * SPAWN_RAMP_STEP_MS);
  }

  function spawnAndSchedule() {
    if (phaseRef.current !== 'live') return;
    spawnOne();
    spawnTimeoutRef.current = setTimeout(() => spawnAndSchedule(), currentCadenceMs());
  }

  function spawnOne() {
    const pos = pickPosition();
    if (!pos) return; // bounds not ready yet
    const id = ++targetIdCounter;
    const opacity = new Animated.Value(1);

    // Full fade — when it hits 0, the target is gone and so is the run.
    // The visual decay IS the timer; no separate ring or numeric needed.
    Animated.timing(opacity, {
      toValue: 0,
      duration: TARGET_LIFE_MS,
      useNativeDriver: true,
    }).start();

    const t: LiveTarget = { id, x: pos.x, y: pos.y, spawnedAt: Date.now(), opacity };
    const updated = [...targetsRef.current, t];
    setTargetsSafe(updated);

    const expiry = setTimeout(() => onTargetExpired(id), TARGET_LIFE_MS);
    expiryTimeoutsRef.current.set(id, expiry);
  }

  function pickPosition(): { x: number; y: number } | null {
    const { width, height } = boundsRef.current;
    if (width === 0 || height === 0) return null;
    const minX = EDGE_MARGIN_PX;
    const maxX = Math.max(minX + 1, width - EDGE_MARGIN_PX);
    const minY = HUD_RESERVE_PX + EDGE_MARGIN_PX;
    const maxY = Math.max(minY + 1, height - EDGE_MARGIN_PX);

    let spacingPx = MIN_TARGET_SPACING;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const tooClose = targetsRef.current.some(
        (p) => Math.hypot(p.x - x, p.y - y) < spacingPx,
      );
      if (!tooClose) return { x, y };
      // Relax gradually so the board never refuses to spawn.
      if (attempt > 0 && attempt % 15 === 0) spacingPx = Math.max(60, spacingPx - 8);
    }
    // Last-resort: just place it.
    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  }

  function onTargetExpired(id: number) {
    if (phaseRef.current !== 'live') return;
    triggerGameOver({ kind: 'timeout', killer: id });
  }

  type GameOverCause =
    | { kind: 'timeout'; killer: number }
    | { kind: 'miss'; at: { x: number; y: number } };

  function triggerGameOver(cause: GameOverCause) {
    if (phaseRef.current !== 'live') return;
    setPhaseSafe('done');

    if (cause.kind === 'timeout') setKillerId(cause.killer);
    if (cause.kind === 'miss') setMissAt(cause.at);

    // Kill all running animations + scheduled spawns/expiries.
    if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    expiryTimeoutsRef.current.forEach((t) => clearTimeout(t));
    expiryTimeoutsRef.current.clear();
    targetsRef.current.forEach((t) => {
      t.opacity.stopAnimation();
      // Re-light the killer so its red highlight is unmistakable — it had
      // just animated down to 0 on its way to expiring.
      if (cause.kind === 'timeout' && t.id === cause.killer) t.opacity.setValue(1);
    });

    finishTimeoutRef.current = setTimeout(() => routeToResult(), GAME_OVER_FREEZE_MS);
  }

  function routeToResult() {
    const elapsed = (Date.now() - gameStartAtRef.current) / 1000;
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'tap-bullseye',
        score: String(Math.max(0, scoreRef.current)),
        duration: elapsed.toFixed(1),
      },
    });
  }

  function pushHitFx(x: number, y: number, score: number, perfect: boolean) {
    const fx: HitFx = { id: ++hitFxIdCounter, x, y, score, perfect };
    setHitFxs((prev) => [...prev, fx]);
    setTimeout(() => {
      setHitFxs((prev) => prev.filter((f) => f.id !== fx.id));
    }, 700);
  }

  function consumeTarget(target: LiveTarget, tapX: number, tapY: number) {
    const reactionMs = Date.now() - target.spawnedAt;
    const distance = Math.hypot(target.x - tapX, target.y - tapY);
    const baseScore = scoreForTap(reactionMs, distance);

    // Precision streak: only dead-center hits count. Anything outside the
    // PERFECT zone is a safe-but-sloppy hit that resets the streak. The
    // multiplier the player just earned is applied to *this* hit so the
    // tier-up moments feel like a payoff, not a promise.
    const isPerfect = distance <= PERFECT_RADIUS_PX;
    if (isPerfect) {
      perfectStreakRef.current += 1;
    } else {
      perfectStreakRef.current = 0;
    }
    const newMul = multiplierForStreak(perfectStreakRef.current);
    if (newMul !== multiplierRef.current) {
      multiplierRef.current = newMul;
      setMultiplier(newMul);
    }
    const finalScore = baseScore * newMul;

    // Cancel its expiry timer.
    const t = expiryTimeoutsRef.current.get(target.id);
    if (t) {
      clearTimeout(t);
      expiryTimeoutsRef.current.delete(target.id);
    }

    // Stop the opacity animation.
    target.opacity.stopAnimation();

    // Remove from board.
    const updated = targetsRef.current.filter((x) => x.id !== target.id);
    setTargetsSafe(updated);

    // Score + feedback.
    const prevScore = scoreRef.current;
    const newScore = prevScore + finalScore;
    setScoreSafe(newScore);
    pushHitFx(tapX, tapY, finalScore, isPerfect);
    checkMilestones(prevScore, newScore);
  }

  function checkMilestones(prevScore: number, newScore: number) {
    // If a single tap straddles multiple thresholds (rare — would need a
    // tap worth >7,500), show the most impressive one.
    let crossed: Milestone | null = null;
    for (const m of MILESTONES) {
      if (prevScore < m.threshold && newScore >= m.threshold) crossed = m;
    }
    if (crossed) showMilestone(crossed);
  }

  function showMilestone(m: Milestone) {
    if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
    setActiveMilestone(m);
    milestoneTimeoutRef.current = setTimeout(() => {
      setActiveMilestone(null);
      milestoneTimeoutRef.current = null;
    }, m.durationMs);
  }

  function handleTap(e: GestureResponderEvent) {
    const tapX = e.nativeEvent.locationX;
    const tapY = e.nativeEvent.locationY;
    const p = phaseRef.current;

    if (p === 'ready') {
      startCountdown();
      return;
    }
    if (p !== 'live') return;

    const all = targetsRef.current;
    // Tapping a screen with no live targets is a no-op — we don't kill the
    // player for tapping in a brief gap between spawns. Once any target is
    // present, the rule kicks in: tap inside the target or die.
    if (all.length === 0) return;

    // Find nearest target.
    let nearest: LiveTarget | null = null;
    let nearestDist = Infinity;
    for (const t of all) {
      const d = Math.hypot(t.x - tapX, t.y - tapY);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }

    // Outside the consume radius — that's a miss, and that's fatal.
    if (!nearest || nearestDist > CONSUME_RADIUS_PX) {
      triggerGameOver({ kind: 'miss', at: { x: tapX, y: tapY } });
      return;
    }

    consumeTarget(nearest, tapX, tapY);
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    boundsRef.current = { width, height };
  }

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
              paddingLeft: 44, // room for EXIT chip on the left
            }}
          >
            <View>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'TIME'}
              </ArcadeText>
              <ArcadeText variant="mono" size={22} color={ACCENT}>
                {formatElapsed(elapsedSec)}
              </ArcadeText>
              {phase === 'live' ? (
                <ArcadeText variant="pixel" size={7} color={colors.textDim}>
                  {`${targets.length} ALIVE`}
                </ArcadeText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'SCORE'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {formatScoreReadout(score)}
              </ArcadeText>
              {phase === 'live' && multiplier > 1 ? (
                <ArcadeText
                  variant="pixel"
                  size={11}
                  color={multiplierColor(multiplier)}
                  glowColor={multiplierColor(multiplier)}
                >
                  {`PERFECT x${multiplier}`}
                </ArcadeText>
              ) : null}
            </View>
          </View>
        </SafeAreaView>

        {/* READY */}
        {phase === 'ready' && (
          <View style={overlayStyle('36%')}>
            <GameIcon id="tap-bullseye" size={80} color={ACCENT} />
            <View style={{ height: spacing.lg }} />
            <ArcadeText
              variant="pixel"
              size={18}
              color={ACCENT}
              glowColor={ACCENT}
              align="center"
            >
              {'TAP BULLSEYE'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText
              variant="mono"
              size={18}
              color={colors.textDim}
              align="center"
            >
              {'TAP EVERY TARGET BEFORE\nIT FADES. AIM DEAD-CENTER\nFOR PERFECT-STREAK BONUS.'}
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
        )}

        {/* COUNTDOWN */}
        {phase === 'countdown' && (
          <View style={overlayStyle('40%')}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'GET READY'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText
              variant="pixel"
              size={84}
              color={countdown === 0 ? neon('green') : ACCENT}
              glowColor={countdown === 0 ? neon('green') : ACCENT}
              glowRadius={20}
            >
              {countdown === 0 ? 'GO' : String(countdown)}
            </ArcadeText>
          </View>
        )}

        {/* TARGETS */}
        {(phase === 'live' || phase === 'done') &&
          targets.map((t) => (
            <Animated.View
              key={t.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: t.x - TARGET_SIZE / 2,
                top: t.y - TARGET_SIZE / 2,
                width: TARGET_SIZE,
                height: TARGET_SIZE,
                opacity: t.opacity,
              }}
            >
              <GameIcon
                id="tap-bullseye"
                size={TARGET_SIZE}
                color={t.id === killerId ? neon('red') : ACCENT}
              />
            </Animated.View>
          ))}

        {/* FLOATING +SCORE */}
        {hitFxs.map((fx) => (
          <FloatingScore
            key={fx.id}
            x={fx.x}
            y={fx.y}
            score={fx.score}
            perfect={fx.perfect}
          />
        ))}

        {/* MILESTONE CELEBRATION — escalating distraction by design */}
        {activeMilestone ? (
          <MilestonePopup
            key={`${activeMilestone.threshold}-${score}`}
            milestone={activeMilestone}
          />
        ) : null}

        {/* MISS MARKER — red X right where the player whiffed */}
        {phase === 'done' && missAt ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: missAt.x - 24,
              top: missAt.y - 24,
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArcadeText
              variant="pixel"
              size={32}
              color={neon('red')}
              glowColor={neon('red')}
              glowRadius={14}
            >
              {'X'}
            </ArcadeText>
          </View>
        ) : null}

        {/* GAME OVER FREEZE */}
        {phase === 'done' && (
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
                {missAt ? 'MISSED!' : 'OUT  OF  TIME!'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="mono" size={20} color={colors.textDim}>
              {`SURVIVED ${formatElapsed(elapsedSec)}`}
            </ArcadeText>
          </View>
        )}

        <ScanlineOverlay opacity={0.06} />
        <InGameExit />
      </Pressable>
    </View>
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

function FloatingScore({
  x,
  y,
  score,
  perfect,
}: {
  x: number;
  y: number;
  score: number;
  perfect: boolean;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -40,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const color = perfect ? neon('yellow') : score > 0 ? neon('green') : neon('red');
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 70,
        top: y - 24,
        width: 140,
        alignItems: 'center',
        opacity,
        transform: [{ translateY }],
      }}
    >
      {perfect ? (
        <ArcadeText variant="pixel" size={9} color={color} glowColor={color}>
          {'PERFECT!'}
        </ArcadeText>
      ) : null}
      <ArcadeText variant="mono" size={22} color={color} glowColor={color}>
        {score > 0 ? `+${score}` : `${score}`}
      </ArcadeText>
    </Animated.View>
  );
}

function MilestonePopup({ milestone }: { milestone: Milestone }) {
  // Three independent animated values driving:
  //   opacity — fade in fast, hold, fade out
  //   scale   — pop in with a spring overshoot, drift outward as it leaves
  //   flash   — full-screen colored tint at the higher tiers
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const inMs = 180;
    const outMs = 280;
    const holdMs = Math.max(0, milestone.durationMs - inMs - outMs);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: inMs,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: 1,
          duration: inMs,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(holdMs),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: outMs,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.5,
          duration: outMs,
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: outMs,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [milestone, opacity, scale, flash]);

  const tint = neon(milestone.color);

  return (
    <>
      {milestone.flashOpacity > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: tint,
            opacity: flash.interpolate({
              inputRange: [0, 1],
              outputRange: [0, milestone.flashOpacity],
            }),
          }}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '36%',
          left: 0,
          right: 0,
          alignItems: 'center',
          opacity,
          transform: [
            { scale },
            { rotate: `${milestone.rotationDeg}deg` },
          ],
        }}
      >
        <ArcadeText
          variant="pixel"
          size={milestone.size}
          color={tint}
          glowColor={tint}
          glowRadius={20}
          align="center"
        >
          {milestone.label}
        </ArcadeText>
      </Animated.View>
    </>
  );
}

function multiplierForStreak(streak: number): number {
  for (const tier of COMBO_TIERS) {
    if (streak >= tier.at) return tier.multiplier;
  }
  return 1;
}

function multiplierColor(m: number): string {
  if (m >= 4) return neon('yellow');
  if (m >= 3) return neon('cyan');
  if (m >= 2) return neon('green');
  return colors.textDim;
}

function scoreForTap(reactionMs: number, distance: number): number {
  // Speed: 1000 at ≤200ms, 0 at ≥700ms.
  const speed = clamp(1000 - (reactionMs - 200) * 2, 0, 1000);

  // Accuracy: 1000 dead-center, two linear segments out to 60px.
  let accuracy: number;
  if (distance <= 4) accuracy = 1000;
  else if (distance <= 28) accuracy = 1000 - ((distance - 4) / 24) * 500;
  else if (distance <= 60) accuracy = 500 - ((distance - 28) / 32) * 500;
  else accuracy = 0;

  return Math.round(speed + accuracy);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function formatScoreReadout(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(n)).padStart(6, '0');
}

function formatElapsed(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}
