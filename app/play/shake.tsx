// SHAKE METER — 10 seconds of pure cardio.
//
// Player shakes the phone as vigorously as possible. Score is the
// integrated shake energy: at each accelerometer sample, we compute
// (|a| - 1g)² and multiply by the sample dt. Sum over the 10-second
// window = final score.
//
// Why squared: a leisurely shake (|a| - 1g ≈ 0.3g per sample) scores
// ~0.09 per sample-second. A vigorous shake (|a| - 1g ≈ 1.0g) scores
// ~1.0. The squaring exaggerates the gap so a determined shaker
// dominates the leaderboard.
//
// Live meter: the current per-sample (|a| - 1g)² drives a horizontal
// intensity bar so the player can see they're going hard enough.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const ACCENT = neon('orange');
const RUN_MS = 10_000;
const TICK_MS = 33;
const ACCEL_HZ = 50;

// Live-meter scaling — at peak shake (|a|-1g)² ≈ 1.0+, so this caps the
// bar's "full" reading at ~1.4 to give some headroom for inhuman shakes.
const METER_FULL = 1.4;

type Phase = 'ready' | 'countdown' | 'shaking' | 'result';

export default function ShakeGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [intensity, setIntensity] = useState(0); // 0..1 normalized for meter
  const [remainingMs, setRemainingMs] = useState(RUN_MS);
  const [countdown, setCountdown] = useState(3);

  const phaseRef = useRef<Phase>('ready');
  const startedAtRef = useRef(0);
  const lastSampleAtRef = useRef(0);
  const scoreRef = useRef(0);
  const peakRef = useRef(0);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stopAccel();
      if (tickRef.current) clearInterval(tickRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function stopAccel() {
    accelSubRef.current?.remove();
    accelSubRef.current = null;
  }

  function startCountdown() {
    setPhaseSafe('countdown');
    let n = 3;
    setCountdown(n);
    Haptics.selectionAsync().catch(() => {});
    countdownRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startShaking();
      } else {
        setCountdown(n);
        Haptics.selectionAsync().catch(() => {});
      }
    }, 700);
  }

  function startShaking() {
    setPhaseSafe('shaking');
    scoreRef.current = 0;
    peakRef.current = 0;
    setScore(0);
    setIntensity(0);
    setRemainingMs(RUN_MS);
    startedAtRef.current = Date.now();
    lastSampleAtRef.current = Date.now();

    Accelerometer.setUpdateInterval(Math.round(1000 / ACCEL_HZ));
    accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      const dt = Math.max(0, now - lastSampleAtRef.current) / 1000;
      lastSampleAtRef.current = now;
      const mag = Math.sqrt(x * x + y * y + z * z);
      const excess = Math.max(0, mag - 1);
      const energy = excess * excess; // squared excess g
      scoreRef.current += energy * dt * 1000; // scale up for nicer numbers
      if (energy > peakRef.current) peakRef.current = energy;
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, RUN_MS - elapsed);
      setRemainingMs(remaining);
      setScore(Math.round(scoreRef.current));
      // Decay the displayed intensity so it tracks current effort.
      setIntensity((prev) => {
        const decayed = prev * 0.78;
        const current = Math.min(1, peakRef.current / METER_FULL);
        peakRef.current = 0;
        return Math.max(decayed, current);
      });
      if (remaining <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        finishRun();
      }
    }, TICK_MS);
  }

  function finishRun() {
    stopAccel();
    setPhaseSafe('result');
    const finalScore = Math.round(scoreRef.current);
    setScore(finalScore);
    Haptics.notificationAsync(
      finalScore >= 15000
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'shake', score: String(finalScore) },
      });
    }, 1800);
  }

  // ---- Render ---------------------------------------------------------

  if (phase === 'ready') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView edges={['top']} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <ArcadeText
            variant="pixel"
            size={22}
            color={ACCENT}
            glowColor={ACCENT}
            align="center"
          >
            {'SHAKE  METER'}
          </ArcadeText>
          <View style={{ height: spacing.lg }} />
          <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
            {'10 SECONDS.\nSHAKE THE PHONE AS HARD\nAND AS LONG AS YOU CAN.'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute} align="center">
            {'GRIP TIGHT — DON\'T LET IT FLY.'}
          </ArcadeText>
          <View style={{ height: spacing.xl }} />
          <Pressable onPress={startCountdown}>
            <NeonFrame color={ACCENT} thickness={3} padding={spacing.lg} glow>
              <Blink>
                <ArcadeText
                  variant="pixel"
                  size={14}
                  color={ACCENT}
                  glowColor={ACCENT}
                >
                  {'START >>'}
                </ArcadeText>
              </Blink>
            </NeonFrame>
          </Pressable>
        </View>
        <ScanlineOverlay opacity={0.05} />
        <InGameExit />
      </View>
    );
  }

  if (phase === 'countdown') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArcadeText variant="pixel" size={11} color={colors.textDim}>
          {'GET READY'}
        </ArcadeText>
        <View style={{ height: spacing.lg }} />
        <ArcadeText
          variant="mono"
          size={120}
          color={ACCENT}
          glowColor={ACCENT}
          glowRadius={28}
        >
          {String(countdown)}
        </ArcadeText>
        <InGameExit />
      </View>
    );
  }

  const timerPct = remainingMs / RUN_MS;

  if (phase === 'shaking') {
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
                {'TIME LEFT'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={
                  timerPct > 0.5 ? neon('green') : timerPct > 0.25 ? neon('yellow') : neon('red')
                }
                glowColor={
                  timerPct > 0.5 ? neon('green') : timerPct > 0.25 ? neon('yellow') : neon('red')
                }
              >
                {`${(remainingMs / 1000).toFixed(1)}s`}
              </ArcadeText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'SCORE'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={ACCENT}
                glowColor={ACCENT}
              >
                {String(score).padStart(5, '0')}
              </ArcadeText>
            </View>
          </View>
          {/* Time-remaining bar */}
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

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
          }}
        >
          <Blink intervalMs={200} minOpacity={0.5}>
            <ArcadeText
              variant="pixel"
              size={28}
              color={ACCENT}
              glowColor={ACCENT}
              align="center"
            >
              {'SHAKE!'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.xl }} />

          {/* Live intensity meter */}
          <ArcadeText variant="pixel" size={8} color={colors.textMute}>
            {'INTENSITY'}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />
          <View
            style={{
              width: '85%',
              height: 26,
              backgroundColor: colors.bgElevated,
              borderWidth: 2,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${intensity * 100}%`,
                height: '100%',
                backgroundColor:
                  intensity > 0.66
                    ? neon('red')
                    : intensity > 0.33
                      ? ACCENT
                      : neon('yellow'),
              }}
            />
          </View>
          <View style={{ height: spacing.xl }} />

          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'KEEP THE BAR FULL'}
          </ArcadeText>
        </View>

        <ScanlineOverlay opacity={0.05} />
        <InGameExit />
      </View>
    );
  }

  // Result
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <Blink intervalMs={350} minOpacity={0.4}>
          <ArcadeText
            variant="pixel"
            size={20}
            color={neon('green')}
            glowColor={neon('green')}
            align="center"
          >
            {'TIME!'}
          </ArcadeText>
        </Blink>
        <View style={{ height: spacing.lg }} />
        <ArcadeText variant="pixel" size={9} color={colors.textMute}>
          {'SHAKE  ENERGY'}
        </ArcadeText>
        <ArcadeText
          variant="mono"
          size={72}
          color={ACCENT}
          glowColor={ACCENT}
          glowRadius={22}
        >
          {String(score)}
        </ArcadeText>
        <ArcadeText variant="pixel" size={11} color={colors.textDim}>
          {'PTS'}
        </ArcadeText>
      </View>
      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}
