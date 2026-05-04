// TRIVIA — infinite-mode quiz cabinet.
//
// Run rules:
//   - Questions stream forever, drawn from a shuffled bag that refills
//     when exhausted (so a long run still feels varied).
//   - 8 seconds per question.
//   - 3 strikes and you're out (timeout = strike, wrong answer = strike).
//   - Every 10 correct earns a SHIELD that absorbs the next strike.
//
// Scoring per correct answer (max ~1500 with all bonuses):
//   500 base
//   + speed bonus (0–500, scales with how fast you tapped)
//   × streak multiplier (3+ → x2, 6+ → x3, 9+ → x4, capped at x4)
//
// Game-over recap:
//   - Total correct
//   - Best & worst category (by correct rate, with min sample threshold)
//   - Per-category breakdown
//
// Final score sent to leaderboard is the running point total.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
  TriviaCategory,
  TRIVIA_CATEGORIES,
  TriviaQuestion,
  TriviaSequence,
} from '../../src/data/trivia-questions';

const QUESTION_MS = 8000;
const REVEAL_HOLD_MS = 1100;
const TICK_MS = 60;
const MAX_STRIKES = 3;
const SHIELDS_PER_BONUS = 10;
const RESULT_DELAY_MS = 2400;

const ACCENT = neon('magenta');

type Phase = 'asking' | 'reveal' | 'gameover';

type CatStats = {
  correct: number;
  total: number;
};

export default function TriviaGame() {
  const sequenceRef = useRef<TriviaSequence | null>(null);
  if (!sequenceRef.current) sequenceRef.current = new TriviaSequence();
  const [currentQ, setCurrentQ] = useState<TriviaQuestion>(() =>
    sequenceRef.current!.next(),
  );

  const [phase, setPhase] = useState<Phase>('asking');
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastDelta, setLastDelta] = useState(0);
  const [remainingMs, setRemainingMs] = useState(QUESTION_MS);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [strikes, setStrikes] = useState(0);
  const [shields, setShields] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [shieldFlash, setShieldFlash] = useState(false);

  const phaseRef = useRef<Phase>('asking');
  const startedAtRef = useRef(Date.now());
  const totalScoreRef = useRef(0);
  const streakRef = useRef(0);
  const strikesRef = useRef(0);
  const shieldsRef = useRef(0);
  const correctCountRef = useRef(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-category running stats — used to compute best/worst at game over.
  const catStatsRef = useRef<Map<TriviaCategory, CatStats>>(new Map());

  useEffect(() => {
    armQuestion();
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (finalizeTimeoutRef.current) clearTimeout(finalizeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function armQuestion() {
    setPickedIdx(null);
    setRemainingMs(QUESTION_MS);
    setPhaseSafe('asking');
    startedAtRef.current = Date.now();
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, QUESTION_MS - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        revealAnswer(null);
      }
    }, TICK_MS);
  }

  function recordCategory(cat: TriviaCategory, correct: boolean) {
    const existing = catStatsRef.current.get(cat) ?? { correct: 0, total: 0 };
    existing.total += 1;
    if (correct) existing.correct += 1;
    catStatsRef.current.set(cat, existing);
  }

  function pickAnswer(choiceIdx: number) {
    if (phaseRef.current !== 'asking') return;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    revealAnswer(choiceIdx);
  }

  function revealAnswer(choiceIdx: number | null) {
    if (phaseRef.current !== 'asking') return;
    const elapsed = Date.now() - startedAtRef.current;
    const q = currentQ;
    setPickedIdx(choiceIdx);

    const correct = choiceIdx !== null && choiceIdx === q.correctIdx;
    let delta = 0;
    let strikeOut = false;

    if (correct) {
      const speed = clamp(1 - elapsed / QUESTION_MS, 0, 1);
      const speedBonus = Math.round(500 * speed);
      const base = 500;
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setStreak(newStreak);
      const mult = streakMultiplier(newStreak);
      delta = Math.round((base + speedBonus) * mult);

      const newCorrect = correctCountRef.current + 1;
      correctCountRef.current = newCorrect;
      setCorrectCount(newCorrect);

      // Shield grant at every 10 correct.
      if (newCorrect % SHIELDS_PER_BONUS === 0) {
        shieldsRef.current += 1;
        setShields(shieldsRef.current);
        setShieldFlash(true);
        setTimeout(() => setShieldFlash(false), 900);
      }
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } else {
      streakRef.current = 0;
      setStreak(0);
      // Wrong / timeout — try to consume a shield first.
      if (shieldsRef.current > 0) {
        shieldsRef.current -= 1;
        setShields(shieldsRef.current);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      } else {
        strikesRef.current += 1;
        setStrikes(strikesRef.current);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
        if (strikesRef.current >= MAX_STRIKES) {
          strikeOut = true;
        }
      }
    }

    recordCategory(q.category, correct);

    totalScoreRef.current += delta;
    setTotalScore(totalScoreRef.current);
    setLastDelta(delta);
    setPhaseSafe('reveal');

    transitionTimeoutRef.current = setTimeout(() => {
      if (strikeOut) {
        finishRun();
      } else {
        setQuestionNumber((n) => n + 1);
        const next = sequenceRef.current!.next();
        setCurrentQ(next);
        armQuestion();
      }
    }, REVEAL_HOLD_MS);
  }

  function finishRun() {
    setPhaseSafe('gameover');
    finalizeTimeoutRef.current = setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'trivia', score: String(totalScoreRef.current) },
      });
    }, RESULT_DELAY_MS);
  }

  // Best/worst category from the snapshot at game-over.
  const recap = useMemo(() => {
    const entries = Array.from(catStatsRef.current.entries()).map(
      ([cat, s]) => ({
        cat,
        correct: s.correct,
        total: s.total,
        rate: s.total > 0 ? s.correct / s.total : 0,
      }),
    );
    const eligible = entries.filter((e) => e.total >= 2);
    const sorted = [...eligible].sort((a, b) => b.rate - a.rate);
    const best = sorted[0] ?? null;
    const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    return { best, worst };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const q = currentQ;
  const mult = streakMultiplier(streak);
  const timerPct = remainingMs / QUESTION_MS;

  if (phase === 'gameover') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView edges={['top']} />
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            alignItems: 'center',
            paddingBottom: spacing.huge,
          }}
        >
          <View style={{ height: spacing.lg }} />
          <Blink intervalMs={300} minOpacity={0.4}>
            <ArcadeText
              variant="pixel"
              size={22}
              color={neon('red')}
              glowColor={neon('red')}
              align="center"
            >
              {'GAME  OVER'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'3 STRIKES — RUN ENDED'}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'CORRECT'}
          </ArcadeText>
          <ArcadeText
            variant="mono"
            size={56}
            color={neon('green')}
            glowColor={neon('green')}
          >
            {String(correctCount)}
          </ArcadeText>
          <ArcadeText variant="pixel" size={9} color={colors.textDim}>
            {`OUT OF ${questionNumber} ASKED`}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'SCORE'}
          </ArcadeText>
          <ArcadeText variant="mono" size={36} color={ACCENT} glowColor={ACCENT}>
            {String(totalScoreRef.current)}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={10} color={neon('yellow')} glowColor={neon('yellow')}>
            {'★ CATEGORY RECAP ★'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />

          {recap.best ? (
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <ArcadeText variant="pixel" size={8} color={colors.textMute}>
                {'STRONGEST'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={20}
                color={neon('green')}
                glowColor={neon('green')}
              >
                {recap.best.cat}
              </ArcadeText>
              <ArcadeText variant="pixel" size={8} color={colors.textDim}>
                {`${recap.best.correct}/${recap.best.total} — ${Math.round(recap.best.rate * 100)}%`}
              </ArcadeText>
            </View>
          ) : null}

          {recap.worst ? (
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <ArcadeText variant="pixel" size={8} color={colors.textMute}>
                {'BRUSH UP ON'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={20}
                color={neon('red')}
                glowColor={neon('red')}
              >
                {recap.worst.cat}
              </ArcadeText>
              <ArcadeText variant="pixel" size={8} color={colors.textDim}>
                {`${recap.worst.correct}/${recap.worst.total} — ${Math.round(recap.worst.rate * 100)}%`}
              </ArcadeText>
            </View>
          ) : null}

          <View style={{ height: spacing.lg }} />
          <NeonFrame color={colors.border} thickness={1} padding={spacing.md} fill={colors.bgSurface} glow={false}>
            {TRIVIA_CATEGORIES.map((cat) => {
              const s = catStatsRef.current.get(cat);
              if (!s || s.total === 0) return null;
              return (
                <View
                  key={cat}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 3,
                    minWidth: 240,
                  }}
                >
                  <ArcadeText variant="pixel" size={8} color={colors.textDim}>
                    {cat}
                  </ArcadeText>
                  <ArcadeText
                    variant="mono"
                    size={14}
                    color={
                      s.correct / s.total >= 0.7
                        ? neon('green')
                        : s.correct / s.total >= 0.4
                          ? neon('yellow')
                          : neon('red')
                    }
                  >
                    {`${s.correct}/${s.total}`}
                  </ArcadeText>
                </View>
              );
            })}
          </NeonFrame>
        </ScrollView>
        <ScanlineOverlay opacity={0.05} />
        <InGameExit />
      </View>
    );
  }

  if (!q) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ArcadeText variant="pixel" size={12} color={neon('red')} align="center">
          {'NO QUESTIONS LOADED'}
        </ArcadeText>
        <InGameExit />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            paddingLeft: 44, // room for the EXIT chip on the left
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'QUESTION'}
            </ArcadeText>
            <ArcadeText variant="mono" size={20} color={ACCENT} glowColor={ACCENT}>
              {`#${questionNumber}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {q.category}
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
                  color={strikes > i ? neon('red') : colors.textMute}
                  glowColor={strikes > i ? neon('red') : undefined}
                >
                  {'X'}
                </ArcadeText>
              ))}
            </View>
            {shields > 0 ? (
              <ArcadeText
                variant="pixel"
                size={9}
                color={shieldFlash ? neon('yellow') : neon('cyan')}
                glowColor={shieldFlash ? neon('yellow') : neon('cyan')}
              >
                {`+${shields} SHIELD${shields > 1 ? 'S' : ''}`}
              </ArcadeText>
            ) : (
              <ArcadeText variant="pixel" size={7} color={colors.textDim}>
                {`${SHIELDS_PER_BONUS - (correctCount % SHIELDS_PER_BONUS)} TO SHIELD`}
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
              {String(totalScore).padStart(5, '0')}
            </ArcadeText>
            {streak >= 2 ? (
              <ArcadeText
                variant="pixel"
                size={9}
                color={mult >= 4 ? neon('yellow') : mult >= 3 ? neon('cyan') : neon('green')}
                glowColor={mult >= 4 ? neon('yellow') : mult >= 3 ? neon('cyan') : neon('green')}
              >
                {`STREAK x${mult > 1 ? mult : 1}`}
              </ArcadeText>
            ) : null}
          </View>
        </View>

        {/* Timer bar */}
        <View
          style={{
            height: 6,
            marginHorizontal: spacing.lg,
            backgroundColor: colors.bgElevated,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${timerPct * 100}%`,
              height: '100%',
              backgroundColor:
                timerPct > 0.5 ? neon('green') : timerPct > 0.25 ? neon('yellow') : neon('red'),
            }}
          />
        </View>
      </SafeAreaView>

      {/* Question + choices */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
        }}
      >
        <ArcadeText
          variant="mono"
          size={20}
          color={colors.text}
          align="center"
          style={{ minHeight: 80 }}
        >
          {q.question}
        </ArcadeText>

        <View style={{ height: spacing.lg }} />

        {q.choices.map((choice, i) => {
          const isPicked = pickedIdx === i;
          const isCorrect = i === q.correctIdx;
          const reveal = phase === 'reveal';
          let borderColor: string = colors.border;
          let fill: string | undefined = colors.bgSurface;
          if (reveal) {
            if (isCorrect) {
              borderColor = neon('green');
              fill = 'rgba(57,255,20,0.15)';
            } else if (isPicked && !isCorrect) {
              borderColor = neon('red');
              fill = 'rgba(255,46,46,0.15)';
            } else {
              borderColor = colors.border;
              fill = colors.bgSurface;
            }
          }
          return (
            <Pressable
              key={i}
              onPress={() => pickAnswer(i)}
              disabled={phase !== 'asking'}
              style={{ marginBottom: spacing.sm }}
            >
              <NeonFrame
                color={borderColor}
                thickness={reveal && (isCorrect || isPicked) ? 2 : 1}
                padding={spacing.md}
                glow={reveal && isCorrect}
                fill={fill}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <ArcadeText
                    variant="pixel"
                    size={11}
                    color={ACCENT}
                  >
                    {String.fromCharCode(65 + i)}
                  </ArcadeText>
                  <ArcadeText
                    variant="mono"
                    size={16}
                    color={colors.text}
                    style={{ flex: 1 }}
                  >
                    {choice}
                  </ArcadeText>
                  {reveal && isCorrect ? (
                    <ArcadeText variant="pixel" size={10} color={neon('green')} glowColor={neon('green')}>
                      {'✓'}
                    </ArcadeText>
                  ) : null}
                  {reveal && isPicked && !isCorrect ? (
                    <ArcadeText variant="pixel" size={10} color={neon('red')} glowColor={neon('red')}>
                      {'✕'}
                    </ArcadeText>
                  ) : null}
                </View>
              </NeonFrame>
            </Pressable>
          );
        })}
      </View>

      {/* Reveal flash — score delta or strike message */}
      {phase === 'reveal' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '20%',
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <Blink intervalMs={250} minOpacity={0.5}>
            <ArcadeText
              variant="mono"
              size={48}
              color={lastDelta > 0 ? neon('green') : neon('red')}
              glowColor={lastDelta > 0 ? neon('green') : neon('red')}
            >
              {lastDelta > 0 ? `+${lastDelta}` : 'STRIKE'}
            </ArcadeText>
          </Blink>
        </View>
      ) : null}

      {/* Shield grant flash */}
      {shieldFlash ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <NeonFrame color={neon('cyan')} thickness={2} padding={spacing.md} glow>
            <ArcadeText
              variant="pixel"
              size={14}
              color={neon('cyan')}
              glowColor={neon('cyan')}
            >
              {'+1 SHIELD'}
            </ArcadeText>
          </NeonFrame>
        </View>
      ) : null}

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

function streakMultiplier(streak: number): number {
  if (streak >= 9) return 4;
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
