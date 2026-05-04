// STROOP RUSH — color word vs ink color cognitive interference test.
//
// Each round:
//   - A color WORD ("RED", "GREEN", etc.) is shown in a different INK
//     color. ~80% of questions are mismatched (word ≠ ink). The other
//     20% match (sanity), to keep you honest.
//   - Player taps the INK COLOR — not the word.
//   - Wrong answer or timeout = strike.
//   - 3 strikes ends the run.
//
// Question time tightens with rounds. Speed bonus + streak multiplier
// reward fast accurate calls.
//
// Score per correct = (100 + speed_bonus) × streak_multiplier.
//   speed_bonus = up to 200 based on time remaining.
//   streak: 3+ → x1.5, 6+ → x2, 9+ → x2.5, 12+ → x3.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, NeonColor, spacing } from '../../src/theme';

const TICK_MS = 60;
const REVEAL_HOLD_MS = 700;
const RESULT_DELAY_MS = 2400;
const MAX_STRIKES = 3;
const MISMATCH_RATE = 0.8;

const ACCENT = neon('red');

type ColorEntry = {
  key: NeonColor;
  word: string;
  hex: string;
};

// The candidate colors. Pick 4 per question; one is the ink, one is the
// word, two are decoys.
const COLOR_POOL: ColorEntry[] = [
  { key: 'red', word: 'RED', hex: neon('red') },
  { key: 'cyan', word: 'CYAN', hex: neon('cyan') },
  { key: 'yellow', word: 'YELLOW', hex: neon('yellow') },
  { key: 'green', word: 'GREEN', hex: neon('green') },
  { key: 'magenta', word: 'PINK', hex: neon('magenta') },
  { key: 'orange', word: 'ORANGE', hex: neon('orange') },
  { key: 'purple', word: 'PURPLE', hex: neon('purple') },
  { key: 'blue', word: 'BLUE', hex: neon('blue') },
];

type Question = {
  word: ColorEntry; // what the text spells
  ink: ColorEntry; // what color the text is rendered in (the answer)
  options: ColorEntry[]; // 4 buttons (always includes ink)
};

type Phase = 'asking' | 'reveal' | 'gameover';

export default function StroopGame() {
  const [phase, setPhase] = useState<Phase>('asking');
  const [question, setQuestion] = useState<Question>(() => buildQuestion());
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [pickedKey, setPickedKey] = useState<NeonColor | null>(null);
  const [remainingMs, setRemainingMs] = useState(timeLimitForRound(1));
  const [lastDelta, setLastDelta] = useState(0);
  const [endReason, setEndReason] = useState<'STRIKES' | null>(null);

  const phaseRef = useRef<Phase>('asking');
  const questionRef = useRef<Question>(question);
  const startedAtRef = useRef(Date.now());
  const roundRef = useRef(1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const strikesRef = useRef(0);
  const correctRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    armQuestion();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
      if (finalizeRef.current) clearTimeout(finalizeRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function armQuestion() {
    const q = questionRef.current;
    setRemainingMs(timeLimitForRound(roundRef.current));
    setPickedKey(null);
    setPhaseSafe('asking');
    startedAtRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    const limit = timeLimitForRound(roundRef.current);
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, limit - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        revealAnswer(null);
      }
    }, TICK_MS);
    // questionRef.current is the active question — q just for ts no-warn
    void q;
  }

  function pickAnswer(key: NeonColor) {
    if (phaseRef.current !== 'asking') return;
    if (tickRef.current) clearInterval(tickRef.current);
    revealAnswer(key);
  }

  function revealAnswer(key: NeonColor | null) {
    if (phaseRef.current !== 'asking') return;
    const elapsed = Date.now() - startedAtRef.current;
    const limit = timeLimitForRound(roundRef.current);
    const correct = key !== null && key === questionRef.current.ink.key;

    setPickedKey(key);

    let delta = 0;
    let strikeOut = false;

    if (correct) {
      const speed = clamp(1 - elapsed / limit, 0, 1);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      streakRef.current = 0;
      setStreak(0);
      strikesRef.current += 1;
      setStrikes(strikesRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (strikesRef.current >= MAX_STRIKES) strikeOut = true;
    }

    scoreRef.current += delta;
    setScore(scoreRef.current);
    setLastDelta(delta);
    setPhaseSafe('reveal');

    transitionRef.current = setTimeout(() => {
      if (strikeOut) {
        finishRun();
      } else {
        roundRef.current += 1;
        setRound(roundRef.current);
        const next = buildQuestion();
        questionRef.current = next;
        setQuestion(next);
        armQuestion();
      }
    }, REVEAL_HOLD_MS);
  }

  function finishRun() {
    setPhaseSafe('gameover');
    setEndReason('STRIKES');
    finalizeRef.current = setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'stroop', score: String(scoreRef.current) },
      });
    }, RESULT_DELAY_MS);
  }

  const q = question;
  const mult = streakMultiplier(streak);
  const limit = timeLimitForRound(round);
  const timerPct = remainingMs / limit;

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
              color={FAIL}
              glowColor={FAIL}
              align="center"
            >
              {'GAME  OVER'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {endReason === 'STRIKES' ? '3 STRIKES — RUN ENDED' : ''}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'CORRECT'}
          </ArcadeText>
          <ArcadeText variant="mono" size={56} color={SUCCESS} glowColor={SUCCESS}>
            {String(correctCount)}
          </ArcadeText>
          <ArcadeText variant="pixel" size={9} color={colors.textDim}>
            {`OUT OF ${round} ASKED`}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'SCORE'}
          </ArcadeText>
          <ArcadeText variant="mono" size={36} color={ACCENT} glowColor={ACCENT}>
            {String(scoreRef.current)}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'BEST STREAK'}
          </ArcadeText>
          <ArcadeText variant="mono" size={28} color={neon('yellow')} glowColor={neon('yellow')}>
            {`x${bestStreak}`}
          </ArcadeText>
        </ScrollView>
        <ScanlineOverlay opacity={0.05} />
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
                color={
                  mult >= 3
                    ? neon('yellow')
                    : mult >= 2.5
                      ? neon('cyan')
                      : SUCCESS
                }
                glowColor={
                  mult >= 3
                    ? neon('yellow')
                    : mult >= 2.5
                      ? neon('cyan')
                      : SUCCESS
                }
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
                timerPct > 0.5 ? SUCCESS : timerPct > 0.25 ? neon('yellow') : FAIL,
            }}
          />
        </View>
      </SafeAreaView>

      {/* Question stage — the WORD displayed in INK */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArcadeText variant="pixel" size={9} color={colors.textMute}>
          {'TAP THE INK COLOR'}
        </ArcadeText>
        <View style={{ height: spacing.lg }} />
        <ArcadeText
          variant="pixel"
          size={56}
          color={q.ink.hex}
          glowColor={q.ink.hex}
          glowRadius={20}
          align="center"
        >
          {q.word.word}
        </ArcadeText>

        <View style={{ height: spacing.xl }} />

        {/* 4 color buttons in 2x2 layout */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
            justifyContent: 'center',
          }}
        >
          {q.options.map((opt) => {
            const isPicked = pickedKey === opt.key;
            const isCorrect = opt.key === q.ink.key;
            const reveal = phase === 'reveal';
            const showCorrect = reveal && isCorrect;
            const showWrong = reveal && isPicked && !isCorrect;
            const borderColor = showCorrect
              ? SUCCESS
              : showWrong
                ? FAIL
                : opt.hex;
            return (
              <Pressable
                key={opt.key}
                onPress={() => pickAnswer(opt.key)}
                disabled={phase !== 'asking'}
                style={({ pressed }) => ({
                  width: '44%',
                  opacity: pressed && phase === 'asking' ? 0.6 : 1,
                })}
              >
                <NeonFrame
                  color={borderColor}
                  thickness={showCorrect || showWrong ? 3 : 2}
                  padding={spacing.md}
                  glow={showCorrect}
                  fill={
                    showCorrect
                      ? 'rgba(57,255,20,0.15)'
                      : showWrong
                        ? 'rgba(255,46,46,0.15)'
                        : colors.bgSurface
                  }
                >
                  <View
                    style={{
                      alignItems: 'center',
                      paddingVertical: spacing.sm,
                    }}
                  >
                    {/* Color swatch — actual color is on the SWATCH, not
                        the label, so the player has to click the right
                        one even if they read the label first. */}
                    <View
                      style={{
                        width: 56,
                        height: 28,
                        backgroundColor: opt.hex,
                        marginBottom: spacing.xs,
                      }}
                    />
                    <ArcadeText
                      variant="pixel"
                      size={10}
                      color={colors.textDim}
                    >
                      {opt.word}
                    </ArcadeText>
                  </View>
                </NeonFrame>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Reveal flash */}
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
              color={lastDelta > 0 ? SUCCESS : FAIL}
              glowColor={lastDelta > 0 ? SUCCESS : FAIL}
            >
              {lastDelta > 0 ? `+${lastDelta}` : 'STRIKE'}
            </ArcadeText>
          </Blink>
        </View>
      ) : null}

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

// =====================================================================
// Question generation
// =====================================================================

function buildQuestion(): Question {
  // Pick 4 distinct colors.
  const pool = [...COLOR_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = pool.slice(0, 4);
  const ink = options[Math.floor(Math.random() * options.length)];
  // Mismatch most of the time — pick a different color for the WORD.
  let word = ink;
  if (Math.random() < MISMATCH_RATE) {
    const others = options.filter((o) => o.key !== ink.key);
    word = others[Math.floor(Math.random() * others.length)];
  }
  return { ink, word, options };
}

function timeLimitForRound(round: number): number {
  if (round <= 5) return 4000;
  if (round <= 15) return 3500;
  if (round <= 30) return 3000;
  return 2500;
}

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

const SUCCESS = neon('green');
const FAIL = neon('red');
