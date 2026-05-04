// REACTION LIGHT — pure reflex test, with mid-run mind games.
//
// Round 1–5: full-screen RED. After a random 1.2–4s delay, the screen
// flips GREEN. Tap as fast as possible after green.
//
// Round 6+: HARD MODE. The wait phase now occasionally flashes a
// "distractor" color — pink, orange, or yellow — for a brief moment
// before flipping back to red. Distractors don't bust (you can keep
// the run going if you tap one), but they prime your finger and slow
// your real green reaction. Higher rounds add more distractors and
// move them closer to green in hue.
//
// Tap during RED = BUST (round void, counts as a fail).
// Tap during a DISTRACTOR = neutral, no bust, no points, no end.
// Tap during GREEN = reaction time recorded.
//
// 10 rounds total. Score = average reaction time across non-bust
// rounds, in milliseconds. LOWER IS BETTER. All-bust runs end with a
// max-penalty score so the leaderboard still has a row.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const TOTAL_ROUNDS = 10;
const MIN_WAIT_MS = 1200;
const MAX_WAIT_MS = 4000;
const RESULT_HOLD_MS = 1500;
const BUST_HOLD_MS = 1700;
const MAX_PENALTY_MS = 2000; // recorded for an all-bust run

// Distractor tunables (hard mode = round 6+).
const DISTRACTOR_MS = 280; // visible duration of each flash
const DISTRACTOR_INSET_MS = 350; // never flash within this window of the green flip

type DistractorColor = 'pink' | 'orange' | 'yellow';
const DISTRACTOR_HEX: Record<DistractorColor, string> = {
  pink: '#ff6db5', // unmistakably not red, not green
  orange: '#ff9d2e',
  yellow: '#ffd92e',
};

type Phase = 'ready' | 'red' | 'distractor' | 'green' | 'result' | 'bust' | 'over';

export default function ReactionLightGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [results, setResults] = useState<number[]>([]); // valid (non-bust) rounds only
  const [distractorColor, setDistractorColor] = useState<DistractorColor | null>(null);

  const phaseRef = useRef<Phase>('ready');
  const greenAtRef = useRef(0);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const distractorTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resultsRef = useRef<number[]>([]);
  const roundRef = useRef(1);

  useEffect(() => {
    return () => {
      if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      clearDistractorTimers();
    };
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function clearDistractorTimers() {
    distractorTimeoutsRef.current.forEach((t) => clearTimeout(t));
    distractorTimeoutsRef.current = [];
  }

  function startRound() {
    clearDistractorTimers();
    setPhaseSafe('red');
    setReactionMs(null);
    setDistractorColor(null);
    Haptics.selectionAsync().catch(() => {});

    const wait = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);

    // Hard mode (round 6+): schedule distractor color flashes during
    // the wait. Tapping during a distractor is neutral.
    scheduleDistractors(wait, roundRef.current);

    waitTimeoutRef.current = setTimeout(() => {
      // Either red or distractor at the moment of green flip — both are
      // valid wait states; bail out only if we're in bust/result/etc.
      if (phaseRef.current !== 'red' && phaseRef.current !== 'distractor') return;
      setDistractorColor(null);
      greenAtRef.current = Date.now();
      setPhaseSafe('green');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, wait);
  }

  function scheduleDistractors(waitMs: number, roundN: number) {
    if (roundN <= 5) return;
    const count = roundN <= 7 ? 1 : roundN <= 9 ? 2 : 3;
    const colors = pickDistractorColors(roundN, count);

    // Distractors live in the window [600ms, wait - DISTRACTOR_INSET_MS].
    // The inset before green prevents a distractor masking the actual
    // green flip (would feel unfair).
    const usableStart = 600;
    const usableEnd = waitMs - DISTRACTOR_INSET_MS;
    if (usableEnd <= usableStart + 200) return;

    for (let i = 0; i < count; i++) {
      const slotFrac = (i + 1) / (count + 1);
      const baseAt = usableStart + (usableEnd - usableStart) * slotFrac;
      const jitter = (Math.random() - 0.5) * 300;
      const at = clamp(baseAt + jitter, usableStart, usableEnd - DISTRACTOR_MS);
      const color = colors[i];
      distractorTimeoutsRef.current.push(
        setTimeout(() => {
          if (phaseRef.current !== 'red') return;
          setDistractorColor(color);
          setPhaseSafe('distractor');
        }, at),
      );
      distractorTimeoutsRef.current.push(
        setTimeout(() => {
          if (phaseRef.current === 'distractor') {
            setDistractorColor(null);
            setPhaseSafe('red');
          }
        }, at + DISTRACTOR_MS),
      );
    }
  }

  function tap() {
    if (phaseRef.current === 'ready') {
      startRound();
      return;
    }
    if (phaseRef.current === 'red') {
      // Tapped too early on the actual red.
      if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
      clearDistractorTimers();
      setPhaseSafe('bust');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      transitionTimeoutRef.current = setTimeout(advanceRound, BUST_HOLD_MS);
      return;
    }
    if (phaseRef.current === 'distractor') {
      // Distractor tap = neutral. No bust, no advance, no points. Soft
      // haptic confirms the tap registered. Round continues.
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (phaseRef.current === 'green') {
      const ms = Date.now() - greenAtRef.current;
      setReactionMs(ms);
      resultsRef.current = [...resultsRef.current, ms];
      setResults(resultsRef.current);
      setPhaseSafe('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      transitionTimeoutRef.current = setTimeout(advanceRound, RESULT_HOLD_MS);
      return;
    }
  }

  function advanceRound() {
    if (roundRef.current >= TOTAL_ROUNDS) {
      finalize();
      return;
    }
    roundRef.current += 1;
    setRound(roundRef.current);
    startRound();
  }

  function finalize() {
    setPhaseSafe('over');
    // Final score = average of valid rounds. If all rounds busted,
    // submit a max-penalty score so the player still has a leaderboard
    // entry (last place).
    const valid = resultsRef.current;
    const avg =
      valid.length > 0
        ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
        : MAX_PENALTY_MS;

    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'reaction-light', score: String(avg) },
      });
    }, 900);
  }

  // ---- Render --------------------------------------------------------

  if (phase === 'red' || phase === 'green' || phase === 'bust' || phase === 'distractor') {
    // Full-screen colored stage.
    const bg =
      phase === 'green'
        ? neon('green')
        : phase === 'bust'
          ? neon('red')
          : phase === 'distractor' && distractorColor
            ? DISTRACTOR_HEX[distractorColor]
            : '#a3142a';
    return (
      <Pressable
        onPress={tap}
        style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      >
        {phase === 'red' ? (
          <ArcadeText
            variant="pixel"
            size={20}
            color={'#fff'}
            glowColor={'#fff'}
            align="center"
          >
            {'WAIT...'}
          </ArcadeText>
        ) : phase === 'distractor' ? (
          <ArcadeText
            variant="pixel"
            size={20}
            color={'#08080f'}
            align="center"
          >
            {'NOT  YET'}
          </ArcadeText>
        ) : phase === 'green' ? (
          <ArcadeText
            variant="pixel"
            size={42}
            color={'#08080f'}
            align="center"
          >
            {'TAP!'}
          </ArcadeText>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Blink intervalMs={250} minOpacity={0.4}>
              <ArcadeText
                variant="pixel"
                size={28}
                color={'#fff'}
                glowColor={'#fff'}
                align="center"
              >
                {'TOO  EARLY'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="pixel" size={11} color={'#fff'}>
              {'ROUND BUSTED'}
            </ArcadeText>
          </View>
        )}
        <InGameExit />
      </Pressable>
    );
  }

  // Ready / result / over — neutral background with HUD.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            paddingLeft: 44,
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'ROUND'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={neon('green')} glowColor={neon('green')}>
              {`${round}/${TOTAL_ROUNDS}`}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'BEST'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={neon('yellow')} glowColor={neon('yellow')}>
              {results.length > 0 ? `${Math.min(...results)}` : '—'}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {'MS'}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        {phase === 'ready' ? (
          <>
            <ArcadeText
              variant="pixel"
              size={22}
              color={neon('green')}
              glowColor={neon('green')}
              align="center"
            >
              {'REACTION  LIGHT'}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
              {'WAIT FOR THE GREEN.\nTAP AS FAST AS YOU CAN.\nTAP DURING RED = BUST.'}
            </ArcadeText>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="pixel" size={8} color={colors.textMute} align="center">
              {'★ ROUND 6+ : DISTRACTOR FLASHES ★\nPINK / ORANGE / YELLOW = NOT GREEN'}
            </ArcadeText>
            <View style={{ height: spacing.xl }} />
            <Pressable onPress={startRound}>
              <NeonFrame color={neon('green')} thickness={3} padding={spacing.lg} glow>
                <Blink>
                  <ArcadeText
                    variant="pixel"
                    size={14}
                    color={neon('green')}
                    glowColor={neon('green')}
                  >
                    {'START >>'}
                  </ArcadeText>
                </Blink>
              </NeonFrame>
            </Pressable>
          </>
        ) : phase === 'result' && reactionMs != null ? (
          <>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'YOUR REACTION'}
            </ArcadeText>
            <View style={{ height: spacing.sm }} />
            <ArcadeText
              variant="mono"
              size={72}
              color={
                reactionMs < 200
                  ? neon('yellow')
                  : reactionMs < 300
                    ? neon('green')
                    : neon('cyan')
              }
              glowColor={
                reactionMs < 200
                  ? neon('yellow')
                  : reactionMs < 300
                    ? neon('green')
                    : neon('cyan')
              }
              glowRadius={20}
            >
              {String(reactionMs)}
            </ArcadeText>
            <ArcadeText variant="pixel" size={11} color={colors.textDim}>
              {'MS'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="pixel" size={8} color={colors.textMute}>
              {round < TOTAL_ROUNDS ? 'NEXT ROUND...' : 'FINAL ROUND DONE'}
            </ArcadeText>
          </>
        ) : phase === 'over' ? (
          <>
            <Blink intervalMs={400} minOpacity={0.4}>
              <ArcadeText
                variant="pixel"
                size={20}
                color={neon('yellow')}
                glowColor={neon('yellow')}
                align="center"
              >
                {'!! RUN COMPLETE !!'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'AVERAGE'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={56}
              color={neon('green')}
              glowColor={neon('green')}
            >
              {results.length > 0
                ? Math.round(
                    results.reduce((a, b) => a + b, 0) / results.length,
                  )
                : MAX_PENALTY_MS}
            </ArcadeText>
            <ArcadeText variant="pixel" size={9} color={colors.textDim}>
              {`MS · ${results.length}/${TOTAL_ROUNDS} VALID`}
            </ArcadeText>
          </>
        ) : null}
      </View>

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

function pickDistractorColors(round: number, count: number): DistractorColor[] {
  // Round 6: pink only.
  // Round 7–8: pink + orange.
  // Round 9+: pink + orange + yellow (yellow's the closest to green —
  // hardest to dismiss without the brain firing TAP first).
  let pool: DistractorColor[];
  if (round <= 6) pool = ['pink'];
  else if (round <= 8) pool = ['pink', 'orange'];
  else pool = ['pink', 'orange', 'yellow'];

  // Fisher-Yates so distractor order varies run to run.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // If count > pool size, repeat from the top.
  const result: DistractorColor[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
