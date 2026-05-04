// CARD SHARK — three-card-monte that grows up.
//
// Classic shell-game flow:
//   1. Card backs at fixed slots. The QUEEN flashes face-up at one of
//      them (REVEAL_MS).
//   2. Cards flip back, then SHUFFLE: a sequence of pair-swaps that
//      animate cards along the row.
//   3. Cards stop. Player taps a position. Right = points; wrong = strike.
//
// Difficulty tiers (infinite — no upper cap):
//   - Round 1–5: 3 cards, gentle ramp (520→460ms per swap, +1 swap every 2 rounds)
//   - Round 6–10: 3 cards, accelerated ramp (drop 22ms/round, +1 swap/round)
//   - Round 11–15: FOUR cards (cards shrink to fit), continuing ramp
//   - Round 16+: DECOY FLIPS — non-queen cards briefly flash face-up
//     during the shuffle, mimicking the real queen reveal. Tracks any
//     player who was following the wrong card.
//
// Score per correct: 100 + speed bonus (up to 200) × streak multiplier.
// Streak: 3+ x1.5, 6+ x2, 9+ x2.5, 12+ x3.
// 3 strikes ends the run. Rounds are unbounded — leaderboard stays open.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const ACCENT = neon('green');
const QUEEN_COLOR = neon('magenta');
const FAIL = neon('red');
const SUCCESS = neon('green');

const MAX_STRIKES = 3;
const REVEAL_MS = 1500; // queen flash time
const SHUFFLE_DELAY_BEFORE = 600; // pause after reveal before shuffle
const SHUFFLE_DELAY_AFTER = 400; // pause after shuffle before accepting taps
const REVEAL_HOLD_MS = 1100; // result display before next round

// Layout — adapts to current slot count so 4-card / 5-card rounds fit.
const MAX_SLOTS = 5;
const CARD_GAP = 14;

function numSlotsForRound(round: number): number {
  if (round <= 10) return 3;
  // Past round 10 a 4th card joins. Could push to 5 in a future tier;
  // keep at 4 for now so the ramp doesn't get unfair too fast.
  return 4;
}

function cardWForSlots(numSlots: number): number {
  // Total play area ~340 wide. Reserve room for margins.
  if (numSlots === 3) return 84;
  if (numSlots === 4) return 68;
  return 56;
}

function slotX(slot: number, cardW: number): number {
  return slot * (cardW + CARD_GAP);
}

// Decoy mechanic gates on round.
function shouldRunDecoys(round: number): boolean {
  return round >= 16;
}

type Phase =
  | 'idle'
  | 'reveal'
  | 'pre-shuffle'
  | 'shuffling'
  | 'guess'
  | 'result'
  | 'gameover';

export default function CardSharkGame() {
  // The truth: which slot index currently holds the queen. Starts where
  // the reveal showed it; updates as we swap.
  const queenSlotRef = useRef(0);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealQueenAt, setRevealQueenAt] = useState<number | null>(null); // for the initial flash
  const [lastDelta, setLastDelta] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const phaseRef = useRef<Phase>('idle');
  const roundRef = useRef(1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const strikesRef = useRef(0);
  const correctRef = useRef(0);
  const guessStartRef = useRef(0);
  const guessLimitMsRef = useRef(0);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animated positions: pre-allocated for MAX_SLOTS so we can dial up
  // the active count per round without rebuilding the Animated.Value
  // array (which would lose mid-animation state).
  const slotForCardRef = useRef<number[]>([0, 1, 2, 3, 4]); // cardId -> slot
  const cardTranslateXRef = useRef<Animated.Value[]>(
    Array.from({ length: MAX_SLOTS }, (_, i) => new Animated.Value(slotX(i, cardWForSlots(3)))),
  );
  const queenCardIdRef = useRef(0);

  // Decoy mechanic: which non-queen card (if any) is currently flashing
  // a fake face-up queen. null = no decoy active.
  const [decoyCardId, setDecoyCardId] = useState<number | null>(null);
  const decoyTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Active layout dimensions for the current round.
  const activeNumSlotsRef = useRef<number>(numSlotsForRound(1));
  const activeCardWRef = useRef<number>(cardWForSlots(numSlotsForRound(1)));

  useEffect(() => {
    armRound(1);
    return () => {
      timerRefs.current.forEach((t) => clearTimeout(t));
      timerRefs.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function clearTimers() {
    timerRefs.current.forEach((t) => clearTimeout(t));
    timerRefs.current = [];
  }

  function pushTimer(t: ReturnType<typeof setTimeout>) {
    timerRefs.current.push(t);
  }

  // Each round: pick a starting slot for the queen, plan a shuffle
  // sequence, animate it, accept the player's tap.
  function armRound(n: number) {
    clearTimers();
    clearDecoyTimers();
    setDecoyCardId(null);
    roundRef.current = n;
    setRound(n);
    setPicked(null);
    setResult(null);

    // Set per-round layout dimensions.
    const numSlots = numSlotsForRound(n);
    const cardW = cardWForSlots(numSlots);
    activeNumSlotsRef.current = numSlots;
    activeCardWRef.current = cardW;

    // Reset card positions: slot[i] = i for i < numSlots; cards beyond
    // numSlots are off-screen / unrendered.
    slotForCardRef.current = Array.from({ length: MAX_SLOTS }, (_, i) => i);
    cardTranslateXRef.current.forEach((v, i) => v.setValue(slotX(i, cardW)));

    // Pick which card (by id) holds the queen — random over the active
    // slot count.
    const queenCard = Math.floor(Math.random() * numSlots);
    queenCardIdRef.current = queenCard;
    queenSlotRef.current = slotForCardRef.current[queenCard];
    setRevealQueenAt(queenSlotRef.current);

    setPhaseSafe('reveal');

    pushTimer(
      setTimeout(() => {
        setRevealQueenAt(null); // hide queen face
        setPhaseSafe('pre-shuffle');
        pushTimer(setTimeout(() => beginShuffle(), SHUFFLE_DELAY_BEFORE));
      }, REVEAL_MS),
    );
  }

  function clearDecoyTimers() {
    decoyTimeoutsRef.current.forEach((t) => clearTimeout(t));
    decoyTimeoutsRef.current = [];
  }

  // Round 16+: occasionally flip a non-queen card face-up briefly
  // during the shuffle. Looks identical to the real queen reveal, so
  // a player tracking the wrong card has no visual cue to recover.
  function maybeTriggerDecoy() {
    if (!shouldRunDecoys(roundRef.current)) return;
    if (Math.random() > 0.35) return; // ~35% chance per swap
    const numSlots = activeNumSlotsRef.current;
    const candidates: number[] = [];
    for (let i = 0; i < numSlots; i++) {
      if (i !== queenCardIdRef.current) candidates.push(i);
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setDecoyCardId(pick);
    decoyTimeoutsRef.current.push(
      setTimeout(
        () => {
          setDecoyCardId(null);
        },
        220 + Math.random() * 80,
      ),
    );
  }

  function shuffleCountForRound(n: number): number {
    // Tier 1 (rounds 1–5): +1 swap every 2 rounds. Easy intro.
    // Tier 2 (rounds 6+):  +1 swap every round. Steeper ramp.
    // Hard cap of 30 swaps so an extreme run still ends in a few seconds.
    if (n <= 5) {
      return 5 + Math.floor((n - 1) / 2);
    }
    return Math.min(30, 7 + (n - 6));
  }
  function swapMsForRound(n: number): number {
    // Tier 1 (rounds 1–5): drops 14ms/round → 520, 506, 492, 478, 464.
    // Tier 2 (rounds 6+):  drops 22ms/round, floor 140ms.
    if (n <= 5) {
      return 520 - (n - 1) * 14;
    }
    return Math.max(140, 464 - (n - 5) * 22);
  }
  function guessLimitForRound(n: number): number {
    // Plenty of time on early rounds; tighter past 10.
    if (n < 5) return 6000;
    if (n < 10) return 5000;
    if (n < 20) return 4000;
    return 3500;
  }

  function beginShuffle() {
    setPhaseSafe('shuffling');
    const swaps = shuffleCountForRound(roundRef.current);
    const stepMs = swapMsForRound(roundRef.current);
    runSwap(0, swaps, stepMs);
  }

  function runSwap(swapIdx: number, totalSwaps: number, stepMs: number) {
    if (swapIdx >= totalSwaps) {
      // Shuffle done. Sync queenSlotRef from the now-finalized
      // slot-for-card mapping.
      queenSlotRef.current = slotForCardRef.current[queenCardIdRef.current];
      pushTimer(
        setTimeout(() => {
          guessStartRef.current = Date.now();
          guessLimitMsRef.current = guessLimitForRound(roundRef.current);
          setPhaseSafe('guess');
          // Auto-fail if the player doesn't tap in time.
          pushTimer(
            setTimeout(() => {
              if (phaseRef.current === 'guess') resolveGuess(null);
            }, guessLimitMsRef.current),
          );
        }, SHUFFLE_DELAY_AFTER),
      );
      return;
    }
    const numSlots = activeNumSlotsRef.current;
    const cardW = activeCardWRef.current;

    // Pick two distinct slots within the active count to swap.
    const a = Math.floor(Math.random() * numSlots);
    let b = Math.floor(Math.random() * numSlots);
    if (b === a) b = (a + 1 + Math.floor(Math.random() * (numSlots - 1))) % numSlots;

    // Find which cards currently sit in slots a and b.
    const cardA = slotForCardRef.current.indexOf(a);
    const cardB = slotForCardRef.current.indexOf(b);

    // Swap their slot assignments.
    slotForCardRef.current[cardA] = b;
    slotForCardRef.current[cardB] = a;

    // Animate the two cards to their new positions.
    Animated.parallel([
      Animated.timing(cardTranslateXRef.current[cardA], {
        toValue: slotX(b, cardW),
        duration: stepMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateXRef.current[cardB], {
        toValue: slotX(a, cardW),
        duration: stepMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Past round 16 we may briefly flash a non-queen card face-up
      // to mimic the queen reveal — done after each swap so the
      // decoy doesn't overlap the swap animation visually.
      maybeTriggerDecoy();
      runSwap(swapIdx + 1, totalSwaps, stepMs);
    });
  }

  function pickSlot(slotIdx: number) {
    if (phaseRef.current !== 'guess') return;
    resolveGuess(slotIdx);
  }

  function resolveGuess(slotIdx: number | null) {
    clearTimers();
    setPicked(slotIdx);
    const correct = slotIdx !== null && slotIdx === queenSlotRef.current;
    let delta = 0;
    let strikeOut = false;

    if (correct) {
      const elapsed = Date.now() - guessStartRef.current;
      const speed = clamp(1 - elapsed / guessLimitMsRef.current, 0, 1);
      const speedBonus = Math.round(200 * speed);
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setStreak(newStreak);
      if (newStreak > bestStreakRef.current) {
        bestStreakRef.current = newStreak;
        setBestStreak(newStreak);
      }
      const mult = streakMultiplier(newStreak);
      delta = Math.round((100 + speedBonus) * mult);
      correctRef.current += 1;
      setCorrectCount(correctRef.current);
      setResult('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      streakRef.current = 0;
      setStreak(0);
      strikesRef.current += 1;
      setStrikes(strikesRef.current);
      setResult('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (strikesRef.current >= MAX_STRIKES) strikeOut = true;
    }

    scoreRef.current += delta;
    setScore(scoreRef.current);
    setLastDelta(delta);
    setPhaseSafe('result');

    pushTimer(
      setTimeout(() => {
        if (strikeOut) {
          finishRun();
        } else {
          armRound(roundRef.current + 1);
        }
      }, REVEAL_HOLD_MS),
    );
  }

  function finishRun() {
    setPhaseSafe('gameover');
    pushTimer(
      setTimeout(() => {
        router.replace({
          pathname: '/result/[id]',
          params: { id: 'card-shark', score: String(scoreRef.current) },
        });
      }, 2000),
    );
  }

  // ---- Render ---------------------------------------------------------

  const mult = streakMultiplier(streak);
  const numSlots = activeNumSlotsRef.current;
  const cardW = activeCardWRef.current;
  const rowWidth = cardW * numSlots + CARD_GAP * (numSlots - 1);

  // Which slot to flash the queen face-up:
  // - During 'reveal' phase: revealQueenAt
  // - During 'result' phase: queenSlotRef.current
  const showQueenAtSlot =
    phase === 'reveal' && revealQueenAt != null
      ? revealQueenAt
      : phase === 'result'
        ? queenSlotRef.current
        : null;

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
            <ArcadeText variant="mono" size={20} color={ACCENT} glowColor={ACCENT}>
              {`#${round}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {`${shuffleCountForRound(round)} SWAPS · ${numSlots} CARDS`}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'center' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'STRIKES'}
            </ArcadeText>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              {[0, 1, 2].map((i) => (
                <ArcadeText
                  key={i}
                  variant="pixel"
                  size={16}
                  color={strikes > i ? FAIL : colors.textMute}
                  glowColor={strikes > i ? FAIL : undefined}
                >
                  {'X'}
                </ArcadeText>
              ))}
            </View>
            {streak >= 2 ? (
              <ArcadeText
                variant="pixel"
                size={9}
                color={mult >= 3 ? neon('yellow') : SUCCESS}
                glowColor={mult >= 3 ? neon('yellow') : SUCCESS}
              >
                {`STREAK x${mult}`}
              </ArcadeText>
            ) : (
              <ArcadeText variant="pixel" size={7} color={colors.textDim}>
                {`${correctCount} CORRECT`}
              </ArcadeText>
            )}
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
              {String(score).padStart(5, '0')}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      {/* Phase banner */}
      <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
        {phase === 'reveal' ? (
          <ArcadeText variant="pixel" size={11} color={QUEEN_COLOR} glowColor={QUEEN_COLOR}>
            {'WATCH  THE  QUEEN'}
          </ArcadeText>
        ) : phase === 'pre-shuffle' || phase === 'shuffling' ? (
          <ArcadeText variant="pixel" size={11} color={colors.textDim}>
            {'TRACK  HER...'}
          </ArcadeText>
        ) : phase === 'guess' ? (
          <Blink intervalMs={400} minOpacity={0.5}>
            <ArcadeText variant="pixel" size={11} color={ACCENT} glowColor={ACCENT}>
              {'TAP  THE  QUEEN'}
            </ArcadeText>
          </Blink>
        ) : phase === 'result' ? (
          <ArcadeText
            variant="pixel"
            size={11}
            color={result === 'correct' ? SUCCESS : FAIL}
            glowColor={result === 'correct' ? SUCCESS : FAIL}
          >
            {result === 'correct' ? `+${lastDelta}` : 'STRIKE'}
          </ArcadeText>
        ) : phase === 'gameover' ? (
          <Blink intervalMs={300} minOpacity={0.4}>
            <ArcadeText variant="pixel" size={20} color={FAIL} glowColor={FAIL} align="center">
              {'GAME  OVER'}
            </ArcadeText>
          </Blink>
        ) : null}
      </View>

      {/* Card row */}
      <View
        style={{
          height: 200,
          marginTop: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Slot tap-zones — count adapts to the round's numSlots. */}
        <View
          style={{
            flexDirection: 'row',
            position: 'absolute',
            top: 20,
            left: 0,
            right: 0,
            justifyContent: 'center',
            gap: CARD_GAP,
            zIndex: 1,
          }}
        >
          {Array.from({ length: numSlots }).map((_, slotIdx) => {
            const isPickedHere = picked === slotIdx;
            const isCorrectSlot =
              phase === 'result' && queenSlotRef.current === slotIdx;
            return (
              <Pressable
                key={slotIdx}
                onPress={() => pickSlot(slotIdx)}
                disabled={phase !== 'guess'}
                style={{
                  width: cardW,
                  height: 130,
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    top: 130 + 8,
                    left: 0,
                    right: 0,
                    height: 4,
                    backgroundColor:
                      isPickedHere && result === 'wrong'
                        ? FAIL
                        : isCorrectSlot
                          ? SUCCESS
                          : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        {/* The cards themselves — Animated.Views, each pinned to its
            slot via translateX. Count adapts to numSlots; the unused
            cardTranslateX values stay at default and aren't rendered. */}
        {Array.from({ length: numSlots }).map((_, cardId) => {
          const queen = cardId === queenCardIdRef.current;
          // Decoy: a non-queen card briefly flips face-up to spoof the
          // queen reveal during shuffle. Visually identical so a player
          // tracking the wrong card has no recovery cue.
          const isDecoyFlash = decoyCardId === cardId && !queen;
          const isQueenFaceUp =
            (phase === 'reveal' && queen) ||
            (phase === 'result' && queen);
          const showFakeFace = isDecoyFlash;
          return (
            <Animated.View
              key={cardId}
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                right: 0,
                alignItems: 'flex-start',
                paddingLeft: '50%',
                marginLeft: -(rowWidth / 2),
                transform: [{ translateX: cardTranslateXRef.current[cardId] }],
                zIndex: phase === 'shuffling' ? 2 : 0,
              }}
            >
              <Card
                faceUp={isQueenFaceUp || showFakeFace}
                queen={queen}
                width={cardW}
              />
            </Animated.View>
          );
        })}
      </View>

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

// =====================================================================
// Card — back-face is a neon checker pattern; queen face shows a Q.
// `width` adapts per-round so 3-card / 4-card / 5-card layouts all fit.
// `queen` says whether THIS card is the actual queen (used by the
// caller to decide when face-up should look like a real queen vs a
// decoy flash — but visually we render the same Q both ways so the
// player can't tell decoys from the real reveal).
function Card({
  faceUp,
  queen,
  width,
}: {
  faceUp: boolean;
  queen: boolean;
  width: number;
}) {
  // We treat any face-up state as a queen reveal visually — that's the
  // whole point of a decoy. `queen` is only used by the caller to
  // gate which CARD to flash, not what to render.
  void queen;
  if (faceUp) {
    return (
      <View
        style={{
          width,
          height: 130,
          borderWidth: 3,
          borderColor: QUEEN_COLOR,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: QUEEN_COLOR,
          shadowOpacity: 0.9,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        }}
      >
        <ArcadeText
          variant="pixel"
          size={width >= 80 ? 48 : width >= 64 ? 38 : 30}
          color={QUEEN_COLOR}
          glowColor={QUEEN_COLOR}
        >
          {'Q'}
        </ArcadeText>
        {width >= 64 ? (
          <>
            <View style={{ height: 4 }} />
            <ArcadeText variant="pixel" size={9} color={'#08080f'}>
              {'QUEEN'}
            </ArcadeText>
          </>
        ) : null}
      </View>
    );
  }
  // Card back.
  return (
    <View
      style={{
        width,
        height: 130,
        borderWidth: 2,
        borderColor: ACCENT,
        backgroundColor: '#0c2018',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: width - 16,
          height: 114,
          borderWidth: 1,
          borderColor: ACCENT,
          opacity: 0.4,
        }}
      />
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArcadeText variant="pixel" size={18} color={ACCENT} glowColor={ACCENT}>
          {'★'}
        </ArcadeText>
      </View>
    </View>
  );
}

// =====================================================================
// Helpers
function streakMultiplier(streak: number): number {
  if (streak >= 12) return 3;
  if (streak >= 9) return 2.5;
  if (streak >= 6) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
