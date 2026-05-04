// REACTION LIGHT — infinite-survival reflex test.
//
// Each round: full-screen RED. After a random 1.2–4s delay, the screen
// flips GREEN for a finite window. You must tap before the window
// closes. Each round the window shrinks — early rounds give you 800ms,
// late rounds give you under 200ms. Eventually you either fail to react
// in time or you tap too soon trying to anticipate.
//
// Bust conditions (any one ends the run):
//   - Tap during RED                    → "TOO EARLY"
//   - Fail to tap before the green window closes → "TOO LATE"
//
// Distractor flashes (round 6+):
//   Pink / orange / yellow flashes during the wait. Tapping a
//   distractor is neutral — no bust, no points, no end. Their job is
//   to prime your finger so the real green flip is harder to commit
//   to.
//
// Score = rounds survived. HIGHER IS BETTER. The run ends on first
// bust; final score is the count of clean green-window taps before
// the failure.

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

const MIN_WAIT_MS = 1200;
const MAX_WAIT_MS = 4000;
const RESULT_HOLD_MS = 750;   // shorter than before — keep run flowing
const BUST_HOLD_MS = 1700;
const GREEN_WINDOW_FLOOR_MS = 150;
const GREEN_WINDOW_INITIAL_MS = 800;
const GREEN_WINDOW_DECAY_MS = 25; // ms shed per round past round 1

// Distractor tunables (hard mode = round 6+).
const DISTRACTOR_MS = 280; // visible duration of each flash
const DISTRACTOR_INSET_MS = 350; // never flash within this window of the green flip

type DistractorColor = 'pink' | 'orange' | 'yellow';
const DISTRACTOR_HEX: Record<DistractorColor, string> = {
  pink: '#ff6db5',
  orange: '#ff9d2e',
  yellow: '#ffd92e',
};

type Phase = 'ready' | 'red' | 'distractor' | 'green' | 'result' | 'bust' | 'over';
type BustReason = 'early' | 'late';

/** Green-window duration shrinks each round, floors at GREEN_WINDOW_FLOOR_MS. */
function greenWindowForRound(round: number): number {
  return Math.max(
    GREEN_WINDOW_FLOOR_MS,
    GREEN_WINDOW_INITIAL_MS - (round - 1) * GREEN_WINDOW_DECAY_MS,
  );
}

export default function ReactionLightGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [distractorColor, setDistractorColor] = useState<DistractorColor | null>(null);
  const [bustReason, setBustReason] = useState<BustReason | null>(null);

  const phaseRef = useRef<Phase>('ready');
  const greenAtRef = useRef(0);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greenCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const distractorTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const roundRef = useRef(1);
  // Snapshotted round count at the moment of bust — used as the score
  // we submit. roundRef.current is the *current* round (1-indexed),
  // and the score is rounds *successfully completed*, so it's
  // (roundRef.current - 1) at bust time.
  const survivedRoundsRef = useRef(0);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  function clearAllTimers() {
    if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
    if (greenCloseTimeoutRef.current) clearTimeout(greenCloseTimeoutRef.current);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    clearDistractorTimers();
  }

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function clearDistractorTimers() {
    distractorTimeoutsRef.current.forEach((t) => clearTimeout(t));
    distractorTimeoutsRef.current = [];
  }

  function startRound() {
    clearAllTimers();
    setPhaseSafe('red');
    setReactionMs(null);
    setDistractorColor(null);
    setBustReason(null);
    Haptics.selectionAsync().catch(() => {});

    const wait = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);

    scheduleDistractors(wait, roundRef.current);

    waitTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== 'red' && phaseRef.current !== 'distractor') return;
      setDistractorColor(null);
      greenAtRef.current = Date.now();
      setPhaseSafe('green');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

      // Schedule the green-window close. If the player doesn't tap
      // before this fires, they bust with reason 'late'.
      const window = greenWindowForRound(roundRef.current);
      greenCloseTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current !== 'green') return;
        // Window closed without a tap — TOO LATE bust.
        survivedRoundsRef.current = roundRef.current - 1;
        setBustReason('late');
        setPhaseSafe('bust');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        transitionTimeoutRef.current = setTimeout(finalize, BUST_HOLD_MS);
      }, window);
    }, wait);
  }

  function scheduleDistractors(waitMs: number, roundN: number) {
    if (roundN <= 5) return;
    // Past round 5: 1 distractor. Past round 9: 2. Past round 14: 3.
    // Past round 20: 4. Caps at 5.
    const count = Math.min(5, 1 + Math.floor((roundN - 5) / 5));
    const colors = pickDistractorColors(roundN, count);

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
      // TOO EARLY bust. Round count completed = current round - 1.
      clearAllTimers();
      survivedRoundsRef.current = roundRef.current - 1;
      setBustReason('early');
      setPhaseSafe('bust');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      transitionTimeoutRef.current = setTimeout(finalize, BUST_HOLD_MS);
      return;
    }
    if (phaseRef.current === 'distractor') {
      // Distractor tap is neutral. Soft haptic, round continues.
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (phaseRef.current === 'green') {
      const ms = Date.now() - greenAtRef.current;
      // Window closed already? Defensive — shouldn't happen because the
      // close timer would have flipped to 'bust', but guard anyway.
      if (ms > greenWindowForRound(roundRef.current)) return;
      if (greenCloseTimeoutRef.current) clearTimeout(greenCloseTimeoutRef.current);
      setReactionMs(ms);
      setPhaseSafe('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      transitionTimeoutRef.current = setTimeout(advanceRound, RESULT_HOLD_MS);
      return;
    }
  }

  function advanceRound() {
    roundRef.current += 1;
    setRound(roundRef.current);
    startRound();
  }

  function finalize() {
    setPhaseSafe('over');
    const score = survivedRoundsRef.current;
    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'reaction-light', score: String(score) },
      });
    }, 900);
  }

  // ---- Render --------------------------------------------------------

  if (phase === 'red' || phase === 'green' || phase === 'bust' || phase === 'distractor') {
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
                {bustReason === 'early' ? 'TOO  EARLY' : 'TOO  LATE'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="pixel" size={11} color={'#fff'}>
              {`SURVIVED ${survivedRoundsRef.current} ROUND${survivedRoundsRef.current === 1 ? '' : 'S'}`}
            </ArcadeText>
          </View>
        )}
        <InGameExit />
      </Pressable>
    );
  }

  // Ready / result / over — neutral background with HUD.
  const greenWindowDisplay = greenWindowForRound(round);
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
              {String(round).padStart(2, '0')}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'WINDOW'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={neon('yellow')} glowColor={neon('yellow')}>
              {String(greenWindowDisplay)}
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
              {'WAIT FOR THE GREEN.\nTAP BEFORE IT CLOSES.\nTAP DURING RED = BUST.'}
            </ArcadeText>
            <View style={{ height: spacing.sm }} />
            <ArcadeText variant="pixel" size={8} color={colors.textMute} align="center">
              {'★ THE GREEN WINDOW SHRINKS EACH ROUND ★\nDISTRACTOR FLASHES PAST ROUND 6'}
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
              {'NEXT ROUND...'}
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
                {'!! RUN OVER !!'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'ROUNDS SURVIVED'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={64}
              color={neon('green')}
              glowColor={neon('green')}
            >
              {String(survivedRoundsRef.current)}
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
  let pool: DistractorColor[];
  if (round <= 6) pool = ['pink'];
  else if (round <= 8) pool = ['pink', 'orange'];
  else pool = ['pink', 'orange', 'yellow'];

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: DistractorColor[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
