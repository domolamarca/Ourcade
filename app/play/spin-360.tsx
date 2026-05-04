// 360 SPIN — rotate the phone exactly one full turn on the yaw axis.
//
// Hold phone flat-ish and pivot in place (or set on a swivel chair).
// The game tracks total rotation by integrating yaw deltas from
// DeviceMotion. When the player taps LOCK, the run ends.
//
// Score = |360 − totalRotation°|. Lower is better. A perfect spin
// scores 0; bailing out at 90° scores 270; over-rotating to 540°
// scores 180. Negative spin direction is allowed (some people pivot
// counter-clockwise) — we use the absolute total magnitude.
//
// Visual: a rotating dial that mirrors the player's measured rotation.
// Once they pass 360°, a "LOCK NOW" prompt blinks to encourage tapping.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { DeviceMotion } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const ACCENT = neon('yellow');
const RESULT_HOLD_MS = 1700;
const TICK_MS = 50;

type Phase = 'permission' | 'denied' | 'ready' | 'spinning' | 'result';

export default function SpinGame() {
  const [phase, setPhase] = useState<Phase>('permission');
  const [totalDeg, setTotalDeg] = useState(0);
  const [score, setScore] = useState<number | null>(null);

  const phaseRef = useRef<Phase>('permission');
  const totalDegRef = useRef(0);
  const lastYawRef = useRef<number | null>(null);
  const motionSubRef = useRef<{ remove: () => void } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const available = await DeviceMotion.isAvailableAsync().catch(() => false);
        if (!available) {
          setPhaseSafe('denied');
          return;
        }
        if (DeviceMotion.requestPermissionsAsync) {
          const perm = await DeviceMotion.requestPermissionsAsync().catch(() => null);
          if (perm && perm.status !== 'granted' && perm.status !== undefined) {
            setPhaseSafe('denied');
            return;
          }
        }
        setPhaseSafe('ready');
      } catch {
        setPhaseSafe('denied');
      }
    })();
    return () => {
      stopMotion();
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function startMotion() {
    DeviceMotion.setUpdateInterval(40);
    motionSubRef.current = DeviceMotion.addListener((data) => {
      if (!data.rotation) return;
      const yawDeg = (data.rotation.alpha * 180) / Math.PI;
      if (lastYawRef.current === null) {
        lastYawRef.current = yawDeg;
        return;
      }
      // Accumulate deltas. alpha wraps at ±180°, so unwrap.
      let delta = yawDeg - lastYawRef.current;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      lastYawRef.current = yawDeg;
      // Use absolute delta — direction-agnostic spin total.
      totalDegRef.current += Math.abs(delta);
    });
  }

  function stopMotion() {
    motionSubRef.current?.remove();
    motionSubRef.current = null;
  }

  function startSpin() {
    totalDegRef.current = 0;
    setTotalDeg(0);
    lastYawRef.current = null;
    setPhaseSafe('spinning');
    startMotion();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Drive the dial render via a low-rate render tick.
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setTotalDeg(totalDegRef.current);
    }, TICK_MS);
  }

  function lock() {
    if (phaseRef.current !== 'spinning') return;
    if (tickRef.current) clearInterval(tickRef.current);
    stopMotion();
    const total = totalDegRef.current;
    setTotalDeg(total);
    const error = Math.abs(360 - total);
    setScore(Math.round(error * 10) / 10);
    setPhaseSafe('result');
    Haptics.notificationAsync(
      error < 5
        ? Haptics.NotificationFeedbackType.Success
        : error < 25
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});

    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        // Score is the error in degrees; stored as a number with 1 decimal.
        // The leaderboard sort treats spin-360 as lower-better.
        params: { id: 'spin-360', score: String(Math.round(error * 10) / 10) },
      });
    }, RESULT_HOLD_MS);
  }

  // ---- Render ---------------------------------------------------------

  if (phase === 'permission') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ArcadeText variant="pixel" size={12} color={ACCENT}>
          {'WAITING FOR MOTION...'}
        </ArcadeText>
        <InGameExit />
      </View>
    );
  }

  if (phase === 'denied') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
        <ArcadeText variant="pixel" size={14} color={neon('red')} glowColor={neon('red')} align="center">
          {'MOTION  BLOCKED'}
        </ArcadeText>
        <View style={{ height: spacing.md }} />
        <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
          {'360 SPIN NEEDS\nMOTION ACCESS.\nENABLE IT IN SETTINGS.'}
        </ArcadeText>
        <InGameExit />
      </View>
    );
  }

  const turns = totalDeg / 360;
  // Color-codes: green when close to 360, yellow under-rotated, orange over.
  const errSigned = totalDeg - 360;
  const dialColor =
    Math.abs(errSigned) < 5
      ? neon('green')
      : errSigned < 0
        ? neon('cyan')
        : neon('orange');

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
              {'TARGET'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={ACCENT} glowColor={ACCENT}>
              {'360°'}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'MEASURED'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={dialColor} glowColor={dialColor}>
              {`${totalDeg.toFixed(1)}°`}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <SpinDial degrees={totalDeg} color={dialColor} />

        <View style={{ height: spacing.lg }} />

        {phase === 'ready' ? (
          <>
            <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
              {'HOLD PHONE FLAT.\nPIVOT IN PLACE 360°.\nTAP LOCK WHEN DONE.'}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <Pressable onPress={startSpin}>
              <NeonFrame color={ACCENT} thickness={3} padding={spacing.md} glow>
                <Blink>
                  <ArcadeText
                    variant="pixel"
                    size={14}
                    color={ACCENT}
                    glowColor={ACCENT}
                  >
                    {'TAP TO START'}
                  </ArcadeText>
                </Blink>
              </NeonFrame>
            </Pressable>
          </>
        ) : phase === 'spinning' ? (
          <>
            <ArcadeText
              variant="pixel"
              size={11}
              color={turns >= 0.95 ? neon('green') : colors.textDim}
              glowColor={turns >= 0.95 ? neon('green') : undefined}
            >
              {turns >= 0.95 && turns <= 1.1
                ? '★ LOCK  NOW ★'
                : turns >= 1.1
                  ? 'OVER-ROTATED'
                  : `${(1 - turns).toFixed(2)} TURNS LEFT`}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <Pressable onPress={lock}>
              <NeonFrame
                color={dialColor}
                thickness={3}
                padding={spacing.md}
                glow
              >
                <ArcadeText
                  variant="pixel"
                  size={14}
                  color={dialColor}
                  glowColor={dialColor}
                >
                  {'LOCK >>'}
                </ArcadeText>
              </NeonFrame>
            </Pressable>
          </>
        ) : score != null ? (
          <>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'OFF BY'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={56}
              color={
                score < 5 ? neon('green') : score < 25 ? neon('yellow') : neon('red')
              }
              glowColor={
                score < 5 ? neon('green') : score < 25 ? neon('yellow') : neon('red')
              }
              glowRadius={20}
            >
              {`${score}°`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={9} color={colors.textDim}>
              {totalDeg < 360 ? 'UNDER-ROTATED' : totalDeg > 360 ? 'OVER-ROTATED' : 'PERFECT'}
            </ArcadeText>
          </>
        ) : null}
      </View>

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

// =====================================================================
// SpinDial — circular gauge that fills as the player rotates. The arc
// reaches a full circle at 360° measured rotation; over-rotation
// continues into a second concentric ring.

function SpinDial({ degrees, color }: { degrees: number; color: string }) {
  const SIZE = 240;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = 100;

  // First-loop arc 0..360; second-loop concentric arc beyond that.
  const firstDeg = Math.min(360, degrees);
  const secondDeg = Math.max(0, degrees - 360);

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Outer ring track */}
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.border} strokeWidth={3} />
      {/* Tick marks at 0/90/180/270 */}
      {[0, 90, 180, 270].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        const x1 = cx + Math.cos(a) * (r - 6);
        const y1 = cy + Math.sin(a) * (r - 6);
        const x2 = cx + Math.cos(a) * (r + 6);
        const y2 = cy + Math.sin(a) * (r + 6);
        return (
          <Line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={colors.textMute}
            strokeWidth={2}
          />
        );
      })}
      {/* Target marker — opening of the loop = top */}
      <Circle cx={cx} cy={cy - r} r={6} fill={neon('yellow')} />

      {/* Player's measured arc — first loop */}
      <ArcPath
        cx={cx}
        cy={cy}
        r={r}
        startAngle={-90}
        sweepDeg={firstDeg}
        stroke={color}
        thickness={6}
      />

      {/* Over-rotation arc on a smaller inner ring */}
      {secondDeg > 0 ? (
        <ArcPath
          cx={cx}
          cy={cy}
          r={r - 14}
          startAngle={-90}
          sweepDeg={secondDeg}
          stroke={neon('red')}
          thickness={4}
        />
      ) : null}

      {/* Center pointer */}
      <Polygon
        points={`${cx},${cy - 24} ${cx - 8},${cy + 12} ${cx + 8},${cy + 12}`}
        fill={color}
        opacity={0.7}
        transform={`rotate(${degrees % 360}, ${cx}, ${cy})`}
      />
      <Circle cx={cx} cy={cy} r={4} fill={color} />
    </Svg>
  );
}

function ArcPath({
  cx,
  cy,
  r,
  startAngle,
  sweepDeg,
  stroke,
  thickness,
}: {
  cx: number;
  cy: number;
  r: number;
  startAngle: number; // degrees, 0 = right, -90 = top
  sweepDeg: number;
  stroke: string;
  thickness: number;
}) {
  if (sweepDeg <= 0.1) return null;
  const startA = (startAngle * Math.PI) / 180;
  const endA = ((startAngle + sweepDeg) * Math.PI) / 180;
  const x1 = cx + Math.cos(startA) * r;
  const y1 = cy + Math.sin(startA) * r;
  const x2 = cx + Math.cos(endA) * r;
  const y2 = cy + Math.sin(endA) * r;
  const largeArc = sweepDeg > 180 ? 1 : 0;
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  return (
    <G>
      <Path d={d} fill="none" stroke={stroke} strokeWidth={thickness} strokeLinecap="round" />
    </G>
  );
}

