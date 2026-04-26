// DRAW IT — infinite-mode shape drawing cabinet.
//
// Each round:
//   1. Target shape flashes for SHOW_TARGET_MS.
//   2. Canvas blanks. Player drags one continuous stroke.
//   3. Lift finger; after a short idle pause, score is computed.
//
// Difficulty progression (no cap):
//   - Round 1-3: TIER 1 — circle, square, triangle
//   - Round 4: BONUS — bisect a shape down the middle
//   - Round 5-7: TIER 2 — diamond, pentagon, hexagon
//   - Round 8: BONUS
//   - Round 9-11: TIER 3 — octagon, star, plus, arrow, house
//   - Round 12: BONUS
//   - Round 13+: TIER 4 — heart, crescent, infinity, lightning, spiral
//   ...with a BONUS round every 4. Shapes drawn from a per-tier shuffled
//   bag without immediate repeats.
//
// Miss condition: a non-bonus round scoring below MISS_THRESHOLD ends
// the run. Bonus rounds never end the run — they only add points.
//
// Per-round preview time also tightens with difficulty so it gets
// genuinely harder to memorize past tier 1.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import Svg, { Polyline, Polygon as SvgPolygon } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';
import {
  BISECT_SHAPES,
  isBonusRound,
  Pt,
  renderTemplate,
  scoreBisect,
  scoreShape,
  ShapeKind,
  SHAPES,
  tierForRound,
  TIER_POOLS,
} from '../../src/data/draw-shapes';

const SUBMIT_DELAY_MS = 800;
const RESULT_HOLD_MS = 1700;
const MISS_THRESHOLD = 250; // round score below this on a non-bonus = run over

const ACCENT = neon('green');
const BONUS_ACCENT = neon('yellow');

type Phase = 'show' | 'draw' | 'reveal' | 'over';

type RoundPlan = {
  round: number;
  bonus: boolean;
  shape: ShapeKind;
  showMs: number;
};

export default function DrawItGame() {
  const [phase, setPhase] = useState<Phase>('show');
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [path, setPath] = useState<Pt[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [canvas, setCanvas] = useState({ w: 320, h: 320 });
  const [missed, setMissed] = useState(false);

  const phaseRef = useRef<Phase>('show');
  const roundRef = useRef(1);
  const pathRef = useRef<Pt[]>([]);
  const drawingRef = useRef(false);
  const totalScoreRef = useRef(0);
  const liftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-tier shape bag — shuffled, walked through, refilled when empty.
  const tierBagsRef = useRef<Record<1 | 2 | 3 | 4, ShapeKind[]>>({
    1: shuffle(TIER_POOLS[1]),
    2: shuffle(TIER_POOLS[2]),
    3: shuffle(TIER_POOLS[3]),
    4: shuffle(TIER_POOLS[4]),
  });
  const bisectBagRef = useRef<ShapeKind[]>(shuffle(BISECT_SHAPES));

  const currentPlanRef = useRef<RoundPlan | null>(null);
  const [currentPlan, setCurrentPlan] = useState<RoundPlan | null>(null);

  useEffect(() => {
    armRound(1);
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (liftTimeoutRef.current) clearTimeout(liftTimeoutRef.current);
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function nextShape(forRound: number): RoundPlan {
    if (isBonusRound(forRound)) {
      if (bisectBagRef.current.length === 0) {
        bisectBagRef.current = shuffle(BISECT_SHAPES);
      }
      return {
        round: forRound,
        bonus: true,
        shape: bisectBagRef.current.shift()!,
        showMs: 1700,
      };
    }
    const tier = tierForRound(forRound);
    if (tierBagsRef.current[tier].length === 0) {
      tierBagsRef.current[tier] = shuffle(TIER_POOLS[tier]);
    }
    const shape = tierBagsRef.current[tier].shift()!;
    // Show time tightens by tier (give less memorization time as it gets harder).
    const showMs =
      tier === 1 ? 1600 : tier === 2 ? 1300 : tier === 3 ? 1100 : 900;
    return { round: forRound, bonus: false, shape, showMs };
  }

  function armRound(r: number) {
    roundRef.current = r;
    setRound(r);
    setPath([]);
    pathRef.current = [];
    drawingRef.current = false;
    setLastScore(null);

    const plan = nextShape(r);
    currentPlanRef.current = plan;
    setCurrentPlan(plan);

    setPhaseSafe('show');
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => {
      setPhaseSafe('draw');
    }, plan.showMs);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  function onCanvasLayout(e: LayoutChangeEvent) {
    setCanvas({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  }

  function onTouchStart(e: GestureResponderEvent) {
    if (phaseRef.current !== 'draw') return;
    drawingRef.current = true;
    if (liftTimeoutRef.current) clearTimeout(liftTimeoutRef.current);
    const { locationX, locationY } = e.nativeEvent;
    pathRef.current = [{ x: locationX, y: locationY }];
    setPath([{ x: locationX, y: locationY }]);
  }

  function onTouchMove(e: GestureResponderEvent) {
    if (phaseRef.current !== 'draw' || !drawingRef.current) return;
    const { locationX, locationY } = e.nativeEvent;
    const last = pathRef.current[pathRef.current.length - 1];
    // Skip duplicate / tiny steps.
    if (last && Math.hypot(locationX - last.x, locationY - last.y) < 1.5) return;
    const next = { x: locationX, y: locationY };
    pathRef.current.push(next);
    setPath([...pathRef.current]);
  }

  function onTouchEnd() {
    if (phaseRef.current !== 'draw' || !drawingRef.current) return;
    drawingRef.current = false;
    // After lift, wait briefly then submit. If user starts drawing
    // again, we cancel and they can keep going.
    liftTimeoutRef.current = setTimeout(() => submit(), SUBMIT_DELAY_MS);
  }

  function submit() {
    if (phaseRef.current !== 'draw') return;
    const plan = currentPlanRef.current!;
    const player = pathRef.current;

    let score = 0;
    if (plan.bonus) {
      const r = computeShapeRadius();
      score = scoreBisect(player, canvas.w, canvas.h, r);
    } else {
      score = scoreShape(plan.shape, player);
    }

    totalScoreRef.current += score;
    setTotalScore(totalScoreRef.current);
    setLastScore(score);
    setPhaseSafe('reveal');

    const isMiss = !plan.bonus && score < MISS_THRESHOLD;
    setMissed(isMiss);

    if (isMiss) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (plan.bonus && score >= 1000) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (score >= 800) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    resultTimeoutRef.current = setTimeout(() => {
      if (isMiss) {
        finalize();
      } else {
        armRound(roundRef.current + 1);
      }
    }, RESULT_HOLD_MS);
  }

  function finalize() {
    setPhaseSafe('over');
    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'draw-it', score: String(totalScoreRef.current) },
      });
    }, 800);
  }

  function computeShapeRadius() {
    return Math.min(canvas.w, canvas.h) * 0.36;
  }

  // Pre-render the target template for the current round (in canvas coords).
  const target = useMemo(() => {
    const plan = currentPlan;
    if (!plan) return [];
    const r = computeShapeRadius();
    return renderTemplate(plan.shape, canvas.w / 2, canvas.h / 2, r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, canvas.w, canvas.h]);

  const plan = currentPlan;
  const accent = plan?.bonus ? BONUS_ACCENT : ACCENT;
  const def = plan ? SHAPES[plan.shape] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            paddingRight: 70, // room for EXIT chip
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'ROUND'}
            </ArcadeText>
            <ArcadeText variant="mono" size={20} color={accent} glowColor={accent}>
              {`#${round}`}
            </ArcadeText>
            <ArcadeText
              variant="pixel"
              size={7}
              color={plan?.bonus ? BONUS_ACCENT : colors.textDim}
              glowColor={plan?.bonus ? BONUS_ACCENT : undefined}
            >
              {plan?.bonus
                ? '★ BONUS · BISECT'
                : `TIER ${tierForRound(round)} · ${def?.label ?? ''}`}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'SCORE'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={20}
              color={neon('yellow')}
              glowColor={neon('yellow')}
            >
              {String(totalScore).padStart(5, '0')}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {`MISS BELOW ${MISS_THRESHOLD}`}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      {/* Phase banner */}
      <View style={{ alignItems: 'center', paddingVertical: spacing.xs }}>
        {phase === 'show' ? (
          <ArcadeText
            variant="pixel"
            size={11}
            color={accent}
            glowColor={accent}
          >
            {plan?.bonus
              ? '★ BISECT — SLICE THE SHAPE ★'
              : `MEMORIZE THE ${def?.label ?? 'SHAPE'}`}
          </ArcadeText>
        ) : phase === 'draw' ? (
          <Blink intervalMs={650} minOpacity={0.3}>
            <ArcadeText variant="pixel" size={11} color={accent} glowColor={accent}>
              {plan?.bonus ? 'ANY ANGLE — STRAIGHT THROUGH THE CENTER' : 'DRAW IT'}
            </ArcadeText>
          </Blink>
        ) : phase === 'reveal' && lastScore != null ? (
          <ArcadeText
            variant="pixel"
            size={11}
            color={
              missed
                ? neon('red')
                : lastScore >= 800
                  ? neon('green')
                  : neon('yellow')
            }
            glowColor={
              missed
                ? neon('red')
                : lastScore >= 800
                  ? neon('green')
                  : neon('yellow')
            }
          >
            {missed
              ? 'TOO  ROUGH  —  GAME OVER'
              : plan?.bonus
                ? `BISECT BONUS +${lastScore}`
                : `+${lastScore}`}
          </ArcadeText>
        ) : null}
      </View>

      {/* Canvas */}
      <View
        onLayout={onCanvasLayout}
        onStartShouldSetResponder={() => phase === 'draw'}
        onMoveShouldSetResponder={() => phase === 'draw'}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}
        onResponderTerminate={onTouchEnd}
        style={{
          flex: 1,
          marginHorizontal: spacing.md,
          marginBottom: spacing.lg,
          backgroundColor: '#040408',
          borderWidth: 2,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <Svg width="100%" height="100%">
          {/* Target shape — visible during 'show', kept for bisect rounds */}
          {(phase === 'show' || (plan?.bonus && phase !== 'over')) && target.length > 0 ? (
            def?.closed ? (
              <SvgPolygon
                points={target.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(57,255,20,0.06)"
                stroke={accent}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={phase === 'show' ? 1 : 0.4}
              />
            ) : (
              <Polyline
                points={target.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={accent}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={phase === 'show' ? 1 : 0.4}
              />
            )
          ) : null}

          {/* Player path */}
          {path.length > 1 ? (
            <Polyline
              points={path.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={
                phase === 'reveal'
                  ? missed
                    ? neon('red')
                    : (lastScore ?? 0) >= 800
                      ? neon('green')
                      : neon('yellow')
                  : neon('cyan')
              }
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Reveal: also show the target as ghost so player can compare */}
          {phase === 'reveal' && !plan?.bonus && target.length > 0 ? (
            def?.closed ? (
              <SvgPolygon
                points={target.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                strokeDasharray="6,4"
                opacity={0.5}
              />
            ) : (
              <Polyline
                points={target.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                strokeDasharray="6,4"
                opacity={0.5}
              />
            )
          ) : null}
        </Svg>

        {/* Bonus badge — top-right inside canvas */}
        {plan?.bonus ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
            }}
          >
            <NeonFrame color={BONUS_ACCENT} thickness={1} padding={6} fill="rgba(8,8,15,0.7)" glow={false}>
              <ArcadeText
                variant="pixel"
                size={9}
                color={BONUS_ACCENT}
                glowColor={BONUS_ACCENT}
              >
                {'★ BONUS — NO PENALTY'}
              </ArcadeText>
            </NeonFrame>
          </View>
        ) : null}
      </View>

      {/* Reveal flash overlay — score delta + "MISS" or "+X" */}
      {phase === 'reveal' && lastScore != null ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '38%',
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <Blink intervalMs={250} minOpacity={0.5}>
            <ArcadeText
              variant="mono"
              size={56}
              color={
                missed
                  ? neon('red')
                  : (lastScore ?? 0) >= 800
                    ? neon('green')
                    : neon('yellow')
              }
              glowColor={
                missed
                  ? neon('red')
                  : (lastScore ?? 0) >= 800
                    ? neon('green')
                    : neon('yellow')
              }
            >
              {missed ? 'MISS' : `+${lastScore}`}
            </ArcadeText>
          </Blink>
        </View>
      ) : null}

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
