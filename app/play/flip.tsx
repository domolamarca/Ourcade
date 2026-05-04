// FLIP — total-rotation challenge.
//
// 5-second window. Player flips, spins, or rolls the phone any way they
// like. We integrate the magnitude of the gyroscope's angular velocity
// vector to get total rotation in degrees. Direction agnostic — yaw,
// pitch, roll, all equally counted.
//
// Why integrate magnitude vs each axis separately: rewards continuous
// motion, doesn't punish multi-axis flips. A clean wrist-spinner can
// pile up degrees on yaw alone; a true flipper does pitch + roll. Both
// strategies are competitive on the leaderboard.
//
// SAFETY: phone never has to leave the hand. Tossing is allowed but
// not required, and we don't display any "throw it up" copy.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Gyroscope } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const ACCENT = neon('red');
const RUN_MS = 5000;
const TICK_MS = 33;
const GYRO_HZ = 60; // smoother integration; gyro is cheap
const RAD_TO_DEG = 180 / Math.PI;

type Phase = 'ready' | 'countdown' | 'spinning' | 'result';

export default function FlipGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [degrees, setDegrees] = useState(0);
  const [remainingMs, setRemainingMs] = useState(RUN_MS);
  const [countdown, setCountdown] = useState(3);

  const phaseRef = useRef<Phase>('ready');
  const startedAtRef = useRef(0);
  const degreesRef = useRef(0);
  const lastSampleAtRef = useRef(0);
  const gyroSubRef = useRef<{ remove: () => void } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stopGyro();
      if (tickRef.current) clearInterval(tickRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function stopGyro() {
    gyroSubRef.current?.remove();
    gyroSubRef.current = null;
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
        startSpinning();
      } else {
        setCountdown(n);
        Haptics.selectionAsync().catch(() => {});
      }
    }, 700);
  }

  function startSpinning() {
    setPhaseSafe('spinning');
    degreesRef.current = 0;
    setDegrees(0);
    setRemainingMs(RUN_MS);
    startedAtRef.current = Date.now();
    lastSampleAtRef.current = Date.now();

    Gyroscope.setUpdateInterval(Math.round(1000 / GYRO_HZ));
    gyroSubRef.current = Gyroscope.addListener(({ x, y, z }) => {
      const now = Date.now();
      const dt = Math.max(0, now - lastSampleAtRef.current) / 1000;
      lastSampleAtRef.current = now;
      // Magnitude of angular velocity vector, in radians/sec.
      const omega = Math.sqrt(x * x + y * y + z * z);
      // Integrate: degrees += |ω| * dt * (180/π).
      degreesRef.current += omega * dt * RAD_TO_DEG;
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, RUN_MS - elapsed);
      setRemainingMs(remaining);
      setDegrees(Math.round(degreesRef.current));
      if (remaining <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        finishRun();
      }
    }, TICK_MS);
  }

  function finishRun() {
    stopGyro();
    setPhaseSafe('result');
    const final = Math.max(0, Math.round(degreesRef.current));
    setDegrees(final);
    Haptics.notificationAsync(
      final >= 1500
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'flip', score: String(final) },
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
            {'FLIP'}
          </ArcadeText>
          <View style={{ height: spacing.lg }} />
          <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
            {'5 SECONDS TO ROTATE\nTHE PHONE AS MUCH AS POSSIBLE.\nSPIN, FLIP, ROLL — ALL COUNTS.'}
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

  if (phase === 'spinning') {
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
                {'ROTATION'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={ACCENT}
                glowColor={ACCENT}
              >
                {`${degrees}°`}
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
            padding: spacing.lg,
          }}
        >
          <Blink intervalMs={250} minOpacity={0.5}>
            <ArcadeText
              variant="pixel"
              size={20}
              color={ACCENT}
              glowColor={ACCENT}
              align="center"
            >
              {'FLIP  IT'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.xl }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'TOTAL DEGREES'}
          </ArcadeText>
          <ArcadeText
            variant="mono"
            size={88}
            color={ACCENT}
            glowColor={ACCENT}
            glowRadius={22}
          >
            {String(degrees)}
          </ArcadeText>
          <ArcadeText variant="pixel" size={9} color={colors.textDim}>
            {`${(degrees / 360).toFixed(1)} ROTATIONS`}
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
          {'TOTAL ROTATION'}
        </ArcadeText>
        <ArcadeText
          variant="mono"
          size={96}
          color={ACCENT}
          glowColor={ACCENT}
          glowRadius={24}
        >
          {String(degrees)}
        </ArcadeText>
        <ArcadeText variant="pixel" size={11} color={colors.textDim}>
          {'DEGREES'}
        </ArcadeText>
      </View>
      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}
