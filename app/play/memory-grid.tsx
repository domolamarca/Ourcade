// MEMORY GRID — Simon-says with a neon arcade grid.
//
// Each round:
//   1. The grid plays back a sequence of cell flashes.
//   2. Player taps the same cells in the same order.
//   3. Tap them all right → next round, ONE new cell appended to the
//      same sequence. The first 3 cells you saw stay first, every run.
//   4. Tap wrong → run ends.
//
// Classic Simon behavior: the sequence is persistent and grows by one
// each round, so the first cells become muscle memory and only the
// new tail tests you. Show-time per cell tightens slightly with each
// round so memorization gets harder.
//
// Score per round cleared: sequence_length × 100. Cumulative.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const SHOW_MS_BASE = 600;
const SHOW_MS_MIN = 240;
const GAP_MS = 150;
const PRE_SEQUENCE_DELAY = 700;
const FEEDBACK_MS = 220;
const ROUND_TRANSITION_MS = 750;
const GAMEOVER_HOLD_MS = 1500;
const STARTING_LEN = 3;
const GRID_SIZE = 3; // fixed 3x3 so the persistent sequence stays positionally stable

const ACCENT = neon('purple');
const SUCCESS = neon('green');
const FAIL = neon('red');

type Phase = 'showing' | 'input' | 'correct' | 'gameover';

export default function MemoryGridGame() {
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('showing');
  const [sequence, setSequence] = useState<number[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [flashIdx, setFlashIdx] = useState<{ idx: number; color: string } | null>(null);
  const [inputProgress, setInputProgress] = useState(0);

  const phaseRef = useRef<Phase>('showing');
  const sequenceRef = useRef<number[]>([]);
  const inputIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const roundRef = useRef(1);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const gridSize = GRID_SIZE;

  // Start round 1.
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

  function armRound(n: number) {
    clearTimers();
    roundRef.current = n;
    setRound(n);

    const cellCount = GRID_SIZE * GRID_SIZE;

    // Sequence is PERSISTENT across rounds. On round 1 we seed it with
    // STARTING_LEN cells. On every subsequent round we append exactly
    // ONE new cell — the front of the sequence stays exactly what the
    // player saw on round 1.
    let seq: number[];
    if (n === 1) {
      seq = [];
      let lastCell = -1;
      for (let i = 0; i < STARTING_LEN; i++) {
        let pick = Math.floor(Math.random() * cellCount);
        if (pick === lastCell) {
          pick = (pick + 1 + Math.floor(Math.random() * (cellCount - 1))) % cellCount;
        }
        seq.push(pick);
        lastCell = pick;
      }
    } else {
      seq = [...sequenceRef.current];
      const lastCell = seq[seq.length - 1];
      let pick = Math.floor(Math.random() * cellCount);
      if (pick === lastCell) {
        pick = (pick + 1 + Math.floor(Math.random() * (cellCount - 1))) % cellCount;
      }
      seq.push(pick);
    }

    sequenceRef.current = seq;
    setSequence(seq);
    setInputProgress(0);
    inputIdxRef.current = 0;

    setPhaseSafe('showing');
    setActiveIdx(null);

    pushTimer(setTimeout(() => playSequence(0), PRE_SEQUENCE_DELAY));
  }

  function playSequence(stepIdx: number) {
    if (phaseRef.current === 'gameover') return;
    if (stepIdx >= sequenceRef.current.length) {
      setActiveIdx(null);
      setPhaseSafe('input');
      return;
    }
    setActiveIdx(sequenceRef.current[stepIdx]);
    Haptics.selectionAsync().catch(() => {});
    const showMs = clamp(
      SHOW_MS_BASE - roundRef.current * 22,
      SHOW_MS_MIN,
      SHOW_MS_BASE,
    );
    pushTimer(
      setTimeout(() => {
        setActiveIdx(null);
        pushTimer(setTimeout(() => playSequence(stepIdx + 1), GAP_MS));
      }, showMs),
    );
  }

  function tapCell(idx: number) {
    if (phaseRef.current !== 'input') return;
    const expected = sequenceRef.current[inputIdxRef.current];
    if (idx === expected) {
      // Correct.
      setFlashIdx({ idx, color: SUCCESS });
      pushTimer(setTimeout(() => setFlashIdx(null), FEEDBACK_MS));
      const next = inputIdxRef.current + 1;
      inputIdxRef.current = next;
      setInputProgress(next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      if (next >= sequenceRef.current.length) {
        // Round cleared.
        const points = sequenceRef.current.length * 100;
        scoreRef.current += points;
        setScore(scoreRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPhaseSafe('correct');
        pushTimer(
          setTimeout(() => armRound(roundRef.current + 1), ROUND_TRANSITION_MS),
        );
      }
    } else {
      // Wrong.
      setFlashIdx({ idx, color: FAIL });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPhaseSafe('gameover');
      pushTimer(setTimeout(() => finalize(), GAMEOVER_HOLD_MS));
    }
  }

  function finalize() {
    router.replace({
      pathname: '/result/[id]',
      params: { id: 'memory-grid', score: String(scoreRef.current) },
    });
  }

  const cellCount = gridSize * gridSize;
  const totalLen = sequence.length;

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
            <ArcadeText variant="mono" size={22} color={ACCENT} glowColor={ACCENT}>
              {`#${round}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {`+${sequence.length} CELLS`}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'center' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'SEQUENCE'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={22}
              color={
                phase === 'input'
                  ? SUCCESS
                  : phase === 'showing'
                    ? ACCENT
                    : colors.text
              }
              glowColor={phase === 'input' ? SUCCESS : ACCENT}
            >
              {`${inputProgress}/${totalLen}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {phase === 'showing'
                ? 'WATCH'
                : phase === 'input'
                  ? 'TAP IT BACK'
                  : phase === 'correct'
                    ? 'NICE'
                    : 'STRIKE'}
            </ArcadeText>
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
              {String(score).padStart(5, '0')}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      {/* Grid */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          justifyContent: 'center',
        }}
      >
        <View style={{ aspectRatio: 1, gap: spacing.sm }}>
          {Array.from({ length: gridSize }).map((_, row) => (
            <View
              key={row}
              style={{
                flex: 1,
                flexDirection: 'row',
                gap: spacing.sm,
              }}
            >
              {Array.from({ length: gridSize }).map((_, col) => {
                const idx = row * gridSize + col;
                const isActive = activeIdx === idx;
                const flash = flashIdx?.idx === idx ? flashIdx.color : null;
                const cellColor =
                  flash ??
                  (isActive ? ACCENT : colors.bgSurface);
                const borderColor = flash
                  ? flash
                  : isActive
                    ? ACCENT
                    : colors.border;
                const glow = isActive || flash != null;
                return (
                  <Pressable
                    key={col}
                    onPress={() => tapCell(idx)}
                    disabled={phase !== 'input'}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: cellColor,
                      borderWidth: 2,
                      borderColor,
                      opacity: pressed && phase === 'input' ? 0.7 : 1,
                      ...(glow
                        ? {
                            shadowColor: borderColor,
                            shadowOpacity: 0.9,
                            shadowRadius: 14,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 8,
                          }
                        : {}),
                    })}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Phase banner */}
      <View
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
        pointerEvents="none"
      >
        {phase === 'correct' ? (
          <Blink intervalMs={200}>
            <ArcadeText
              variant="pixel"
              size={20}
              color={SUCCESS}
              glowColor={SUCCESS}
              glowRadius={14}
            >
              {`+${sequence.length * 100}`}
            </ArcadeText>
          </Blink>
        ) : phase === 'gameover' ? (
          <Blink intervalMs={250}>
            <ArcadeText
              variant="pixel"
              size={28}
              color={FAIL}
              glowColor={FAIL}
              glowRadius={16}
            >
              {'GAME  OVER'}
            </ArcadeText>
          </Blink>
        ) : null}
      </View>

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
