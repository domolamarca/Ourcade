// Walk the Line — multi-level blind walk, distances in FEET.
//
// Each level: the briefing tells you a target distance in feet (small
// numbers, indoor-friendly). Tap BEGIN → screen goes BLACK. Walk. Tap
// the visible SUBMIT button (or anywhere on the screen) to declare
// you're done. EXIT chip is always available in the corner.
//
// Three modes:
//   STRAIGHT  — walk N feet in a single direction
//   RETURN    — walk N feet out, turn 180°, walk back to start
//   VARIABLE  — target updates mid-walk via haptic + brief 0.5s flash
//
// SENSORS (revised):
//   - We previously relied on Apple's CMPedometer (via expo-sensors
//     Pedometer.watchStepCount). For short, indoor walks (and especially
//     when the phone is held in hand rather than carried in a pocket),
//     CMPedometer is too conservative — it often refuses to report any
//     steps for a 5–10 step walk. So distance always read 0.
//   - Now we count steps directly off the Accelerometer. We look for
//     local maxima of |acceleration|−1g above a threshold, with a
//     refractory window (~280ms) so we don't double-count a single
//     stride. This works reliably with the phone in hand.
//   - Yaw drift is still read from DeviceMotion's rotation.alpha.
//
// Scoring per level (max 2000):
//   driftScore — full points if drift ≤ 5°, drops to 0 at driftTolerance
//   distScore  — full points if foot error ≤ 1.5 ft, drops to 0 at
//                target/2 (or 6 ft, whichever is larger)
//   RETURN mode: distScore averages outbound-target accuracy and
//   how-close-to-start position error.
//
// Run is single-life across all 10 levels. Sum of round scores = final.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Accelerometer, DeviceMotion } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';
import { Level, STRIDE_FT, WALK_LEVELS } from '../../src/data/walk-the-line-levels';

const ACCENT = neon('cyan');
const FLASH_MS = 600;
const TURN_DETECT_DEG = 140;

// Step-detector tunables.
const ACCEL_HZ = 25; // sample every 40ms
const STEP_PEAK_G = 0.16; // amplitude above 1g to count as a candidate peak
const STEP_REFRACTORY_MS = 280; // min gap between counted steps
const STEP_BUFFER_LEN = 5; // samples used for local-max detection

type Phase =
  | 'permission'
  | 'denied'
  | 'briefing'
  | 'walking'
  | 'flash'
  | 'result'
  | 'all-done';

type LevelResult = {
  level: Level;
  driftDeg: number;
  feetTaken: number;
  finalTargetFt: number;
  positionErrorFt?: number;
  driftScore: number;
  distScore: number;
  total: number;
};

export default function WalkTheLineGame() {
  const [phase, setPhase] = useState<Phase>('permission');
  const [levelIdx, setLevelIdx] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [lastResult, setLastResult] = useState<LevelResult | null>(null);
  const [flashTargetFt, setFlashTargetFt] = useState<number | null>(null);
  // Live step count, surfaced ONLY for hot debugging if we ever expose it.
  const [, setLiveSteps] = useState(0);

  const phaseRef = useRef<Phase>('permission');
  const totalScoreRef = useRef(0);
  const levelIdxRef = useRef(0);

  const finalTargetFtRef = useRef(0);
  const startYawRef = useRef<number | null>(null);
  const peakDriftRef = useRef(0);
  const turnedAroundRef = useRef(false);
  const outboundStepsRef = useRef(0);
  const totalStepsRef = useRef(0);
  const variableTriggeredRef = useRef(false);

  // Step detector state.
  const stepBufferRef = useRef<number[]>([]);
  const lastStepAtRef = useRef(0);

  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const motionSubRef = useRef<{ remove: () => void } | null>(null);

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      // Motion + accelerometer typically share the same iOS permission
      // ("Motion & Fitness"). Ask via DeviceMotion if available — fall
      // back gracefully if the API isn't surfaced on this platform.
      try {
        const motionAvail = await DeviceMotion.isAvailableAsync().catch(() => false);
        if (motionAvail && DeviceMotion.requestPermissionsAsync) {
          const perm = await DeviceMotion.requestPermissionsAsync().catch(() => null);
          if (perm && perm.status !== 'granted' && perm.status !== undefined) {
            // Some platforms return 'granted' implicitly with undefined.
            setPhaseSafe('denied');
            return;
          }
        }
      } catch {
        /* ignore — we'll still try the sensors */
      }
      setPhaseSafe('briefing');
    })();
    return () => {
      stopSensors();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  // ---------- Sensor lifecycle ----------------------------------------
  function startSensors() {
    // Reset detector state.
    stepBufferRef.current = [];
    lastStepAtRef.current = 0;
    totalStepsRef.current = 0;
    setLiveSteps(0);

    Accelerometer.setUpdateInterval(Math.round(1000 / ACCEL_HZ));
    accelSubRef.current = Accelerometer.addListener((d) => {
      onAccelSample(d.x ?? 0, d.y ?? 0, d.z ?? 0);
    });

    DeviceMotion.setUpdateInterval(80);
    motionSubRef.current = DeviceMotion.addListener((data) => {
      if (!data.rotation) return;
      const yawDeg = (data.rotation.alpha * 180) / Math.PI;
      if (startYawRef.current === null) startYawRef.current = yawDeg;
      onYawUpdate(yawDeg);
    });
  }

  function stopSensors() {
    accelSubRef.current?.remove();
    motionSubRef.current?.remove();
    accelSubRef.current = null;
    motionSubRef.current = null;
  }

  function angDelta(a: number, b: number): number {
    let d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  // Local-max peak detector on |a|−1g. expo Accelerometer returns x/y/z
  // in g (1g ≈ 9.8 m/s²). At rest |a| ≈ 1.0g. While walking, each step
  // produces a spike of ~0.2–0.5g for a phone held in hand.
  function onAccelSample(x: number, y: number, z: number) {
    if (phaseRef.current !== 'walking' && phaseRef.current !== 'flash') return;
    const mag = Math.sqrt(x * x + y * y + z * z);
    const dev = mag - 1.0;

    const buf = stepBufferRef.current;
    buf.push(dev);
    if (buf.length > STEP_BUFFER_LEN) buf.shift();
    if (buf.length < STEP_BUFFER_LEN) return;

    // Local maximum at center of the buffer.
    const center = buf[Math.floor(STEP_BUFFER_LEN / 2)];
    let isPeak = center >= STEP_PEAK_G;
    for (let i = 0; isPeak && i < STEP_BUFFER_LEN; i++) {
      if (i === Math.floor(STEP_BUFFER_LEN / 2)) continue;
      if (buf[i] >= center) isPeak = false;
    }
    if (!isPeak) return;

    const now = Date.now();
    if (now - lastStepAtRef.current < STEP_REFRACTORY_MS) return;
    lastStepAtRef.current = now;
    totalStepsRef.current += 1;
    setLiveSteps(totalStepsRef.current);
    onStepCounted(totalStepsRef.current);
  }

  function onStepCounted(steps: number) {
    const lvl = WALK_LEVELS[levelIdxRef.current];
    if (lvl.mode === 'VARIABLE' && !variableTriggeredRef.current) {
      const halfSteps = Math.floor(feetToSteps(lvl.targetFeet) / 2);
      if (steps >= halfSteps) {
        variableTriggeredRef.current = true;
        const newTargetFt = lvl.targetFeet + (lvl.variableDeltaFt ?? 0);
        finalTargetFtRef.current = newTargetFt;
        triggerVariableFlash(newTargetFt);
      }
    }
  }

  function onYawUpdate(yawDeg: number) {
    if (phaseRef.current !== 'walking' || startYawRef.current === null) return;
    const drift = Math.abs(angDelta(yawDeg, startYawRef.current));
    const lvl = WALK_LEVELS[levelIdxRef.current];
    if (lvl.mode === 'RETURN') {
      if (!turnedAroundRef.current && drift > TURN_DETECT_DEG) {
        turnedAroundRef.current = true;
        outboundStepsRef.current = totalStepsRef.current;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      if (!turnedAroundRef.current && drift > peakDriftRef.current) {
        peakDriftRef.current = drift;
      }
    } else {
      if (drift > peakDriftRef.current) peakDriftRef.current = drift;
    }
  }

  function triggerVariableFlash(newTargetFt: number) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setFlashTargetFt(newTargetFt);
    setPhaseSafe('flash');
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashTargetFt(null);
      setPhaseSafe('walking');
    }, FLASH_MS);
  }

  // ---------- Phase transitions ---------------------------------------
  function beginLevel() {
    const lvl = WALK_LEVELS[levelIdxRef.current];
    finalTargetFtRef.current = lvl.targetFeet;
    startYawRef.current = null;
    peakDriftRef.current = 0;
    turnedAroundRef.current = false;
    outboundStepsRef.current = 0;
    totalStepsRef.current = 0;
    variableTriggeredRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhaseSafe('walking');
    startSensors();
  }

  function declareDone() {
    if (phaseRef.current !== 'walking' && phaseRef.current !== 'flash') return;
    stopSensors();
    const lvl = WALK_LEVELS[levelIdxRef.current];
    const drift = peakDriftRef.current;
    const totalSteps = totalStepsRef.current;
    const targetFt = finalTargetFtRef.current;
    const feetTaken = stepsToFeet(totalSteps);

    const driftScore = scoreFromError(drift, 5, lvl.driftTolerance);

    let distScore = 0;
    let positionErrorFt: number | undefined;
    if (lvl.mode === 'RETURN') {
      const inboundSteps = totalSteps - outboundStepsRef.current;
      const positionErrorSteps = Math.abs(outboundStepsRef.current - inboundSteps);
      positionErrorFt = stepsToFeet(positionErrorSteps);
      const outboundFt = stepsToFeet(outboundStepsRef.current);
      const targetMatchFt = Math.abs(outboundFt - targetFt);
      const half = Math.max(targetFt / 2, 6);
      const outboundScore = scoreFromError(targetMatchFt, 1.5, half);
      const returnScore = scoreFromError(positionErrorFt, 1.5, half);
      distScore = Math.round((outboundScore + returnScore) / 2);
    } else {
      const errorFt = Math.abs(feetTaken - targetFt);
      const half = Math.max(targetFt / 2, 6);
      distScore = scoreFromError(errorFt, 1.5, half);
    }

    const total = clamp(driftScore + distScore, 0, 2000);
    const result: LevelResult = {
      level: lvl,
      driftDeg: drift,
      feetTaken,
      finalTargetFt: targetFt,
      positionErrorFt,
      driftScore,
      distScore,
      total,
    };
    setLastResult(result);
    totalScoreRef.current += total;
    setTotalScore(totalScoreRef.current);
    setPhaseSafe('result');

    Haptics.notificationAsync(
      total >= 1500
        ? Haptics.NotificationFeedbackType.Success
        : total >= 700
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
  }

  function advanceFromResult() {
    const next = levelIdxRef.current + 1;
    if (next >= WALK_LEVELS.length) {
      setPhaseSafe('all-done');
      resultTimeoutRef.current = setTimeout(() => finalize(), 1600);
    } else {
      levelIdxRef.current = next;
      setLevelIdx(next);
      setPhaseSafe('briefing');
    }
  }

  function finalize() {
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'walk-the-line',
        score: String(totalScoreRef.current),
      },
    });
  }

  // ---------- Render --------------------------------------------------
  const lvl = WALK_LEVELS[levelIdxRef.current];

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
          {'WALK THE LINE NEEDS\nMOTION ACCESS.\nENABLE IT IN SETTINGS.'}
        </ArcadeText>
        <InGameExit />
      </View>
    );
  }

  // BLACK SCREEN during walking + flash. Tap-area is a sibling absolutely-
  // positioned Pressable (NOT a wrapper) so the InGameExit chip in the
  // corner isn't trapped underneath the screen-wide tap target.
  if (phase === 'walking' || phase === 'flash') {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        {/* Full-screen "tap anywhere to submit" — sibling, not a wrapper. */}
        <Pressable onPress={declareDone} style={StyleSheet.absoluteFill} />

        {phase === 'flash' && flashTargetFt != null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArcadeText variant="pixel" size={9} color={neon('orange')}>
              {'TARGET CHANGED'}
            </ArcadeText>
            <View style={{ height: spacing.sm }} />
            <ArcadeText
              variant="mono"
              size={64}
              color={neon('orange')}
              glowColor={neon('orange')}
            >
              {`${flashTargetFt}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={9} color={neon('orange')}>
              {'FEET'}
            </ArcadeText>
          </View>
        ) : null}

        {/* Visible submit button — bottom of screen, easy thumb reach. */}
        {phase === 'walking' ? (
          <View
            style={{
              position: 'absolute',
              bottom: 60,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
            pointerEvents="box-none"
          >
            <Pressable onPress={declareDone} hitSlop={20}>
              <NeonFrame color={ACCENT} thickness={2} padding={spacing.md} fill="rgba(8,8,15,0.7)" glow>
                <ArcadeText
                  variant="pixel"
                  size={14}
                  color={ACCENT}
                  glowColor={ACCENT}
                >
                  {'SUBMIT  TURN'}
                </ArcadeText>
              </NeonFrame>
            </Pressable>
            <View style={{ height: spacing.xs }} />
            <ArcadeText variant="pixel" size={7} color="#333">
              {'OR TAP ANYWHERE'}
            </ArcadeText>
          </View>
        ) : null}

        {/* EXIT chip — last in tree so it sits on top of the tap area. */}
        <InGameExit />
      </View>
    );
  }

  // BRIEFING / RESULT / ALL-DONE — visible UI
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'LEVEL'}
            </ArcadeText>
            <ArcadeText variant="mono" size={20} color={ACCENT} glowColor={ACCENT}>
              {`L${levelIdx + 1}/${WALK_LEVELS.length}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {lvl.name}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'SCORE'}
            </ArcadeText>
            <ArcadeText variant="mono" size={20} color={neon('yellow')} glowColor={neon('yellow')}>
              {String(totalScore).padStart(5, '0')}
            </ArcadeText>
          </View>
        </View>
      </SafeAreaView>

      {/* BRIEFING — shows mode + target FEET + tap-to-begin */}
      {phase === 'briefing' ? (
        <View style={{ flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
          <ArcadeText
            variant="pixel"
            size={11}
            color={modeColor(lvl.mode)}
            glowColor={modeColor(lvl.mode)}
          >
            {modeLabel(lvl.mode)}
          </ArcadeText>
          <View style={{ height: spacing.lg }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'WALK'}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <ArcadeText
              variant="mono"
              size={92}
              color={ACCENT}
              glowColor={ACCENT}
              glowRadius={20}
            >
              {String(lvl.targetFeet)}
            </ArcadeText>
            <ArcadeText variant="pixel" size={16} color={colors.textDim}>
              {'FT'}
            </ArcadeText>
          </View>
          <View style={{ height: spacing.xl }} />
          <ArcadeText
            variant="mono"
            size={15}
            color={colors.textDim}
            align="center"
            style={{ paddingHorizontal: spacing.md }}
          >
            {modeInstructions(lvl)}
          </ArcadeText>
          <View style={{ height: spacing.xl }} />
          <Pressable onPress={beginLevel}>
            <NeonFrame color={ACCENT} thickness={3} padding={spacing.lg} fill="rgba(8,8,15,0.7)">
              <Blink>
                <ArcadeText variant="pixel" size={14} color={ACCENT} glowColor={ACCENT}>
                  {'TAP WHEN READY'}
                </ArcadeText>
              </Blink>
            </NeonFrame>
          </Pressable>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>
            {'(SCREEN GOES BLACK)'}
          </ArcadeText>
        </View>
      ) : null}

      {/* RESULT — round summary with diagram + score */}
      {phase === 'result' && lastResult ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            alignItems: 'center',
          }}
        >
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {`L${levelIdx + 1} · ${lastResult.level.name}`}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />

          {/* Diagram */}
          <WalkDiagram result={lastResult} />

          <View style={{ height: spacing.md }} />

          {/* Stats — distance first since it's primary */}
          <Stat
            label="DISTANCE"
            value={
              lastResult.level.mode === 'RETURN' && lastResult.positionErrorFt != null
                ? `${lastResult.positionErrorFt.toFixed(1)} FT OFF`
                : `${lastResult.feetTaken.toFixed(1)} / ${lastResult.finalTargetFt} FT`
            }
            sub={`+${lastResult.distScore}`}
            primary
          />
          <Stat
            label="DRIFT"
            value={`${lastResult.driftDeg.toFixed(1)}°`}
            sub={`+${lastResult.driftScore}`}
          />

          <View style={{ height: spacing.md }} />

          {/* This round + running total */}
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'THIS ROUND'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={32}
                color={
                  lastResult.total >= 1500
                    ? neon('green')
                    : lastResult.total >= 700
                      ? neon('yellow')
                      : neon('red')
                }
                glowColor={
                  lastResult.total >= 1500
                    ? neon('green')
                    : lastResult.total >= 700
                      ? neon('yellow')
                      : neon('red')
                }
              >
                {`+${lastResult.total}`}
              </ArcadeText>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'TOTAL'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={32}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {String(totalScore)}
              </ArcadeText>
            </View>
          </View>

          <View style={{ height: spacing.md }} />

          <Pressable onPress={advanceFromResult}>
            <NeonFrame color={ACCENT} thickness={3} padding={spacing.md} fill="rgba(8,8,15,0.7)">
              <ArcadeText
                variant="pixel"
                size={13}
                color={ACCENT}
                glowColor={ACCENT}
              >
                {levelIdxRef.current + 1 >= WALK_LEVELS.length
                  ? 'FINISH ▶'
                  : 'NEXT  WALK ▶'}
              </ArcadeText>
            </NeonFrame>
          </Pressable>
        </View>
      ) : null}

      {/* ALL DONE */}
      {phase === 'all-done' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Blink intervalMs={420} minOpacity={0.4}>
            <ArcadeText
              variant="pixel"
              size={22}
              color={neon('yellow')}
              glowColor={neon('yellow')}
              glowRadius={18}
              align="center"
            >
              {'!! WALK COMPLETE !!'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.md }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'FINAL SCORE'}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />
          <ArcadeText variant="mono" size={56} color={neon('green')} glowColor={neon('green')}>
            {String(totalScoreRef.current)}
          </ArcadeText>
        </View>
      ) : null}

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

function Stat({
  label,
  value,
  sub,
  primary,
}: {
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 3,
        gap: spacing.sm,
      }}
    >
      <View style={{ width: 100 }}>
        <ArcadeText
          variant="pixel"
          size={primary ? 9 : 8}
          color={primary ? colors.text : colors.textMute}
        >
          {label}
        </ArcadeText>
      </View>
      <View style={{ width: 150, alignItems: 'flex-end' }}>
        <ArcadeText
          variant="mono"
          size={primary ? 19 : 16}
          color={colors.text}
        >
          {value}
        </ArcadeText>
      </View>
      <ArcadeText variant="pixel" size={primary ? 11 : 9} color={neon('green')}>
        {sub}
      </ArcadeText>
    </View>
  );
}

// =====================================================================
// WalkDiagram — small SVG visualization of the walk.
//
// The "perfect" path is a vertical reference line from start (bottom)
// to target end (top), of length proportional to the level's target
// distance. The player's actual path starts at the same origin and
// is angled by the recorded drift; its length is proportional to the
// distance they actually walked. A dashed connector shows the gap
// between where they finished and where they should have. For RETURN
// mode we also dot back along their inbound path.
// =====================================================================
function WalkDiagram({ result }: { result: LevelResult }) {
  const W = 280;
  const H = 200;
  const cx = W / 2;
  const startY = H - 20;
  const targetEndY = 20;

  const referenceLen = startY - targetEndY;
  const targetFt = result.finalTargetFt;
  const playerFt =
    result.level.mode === 'RETURN' && result.positionErrorFt != null
      ? targetFt
      : result.feetTaken;
  const lengthRatio = Math.min(1.4, Math.max(0.05, playerFt / Math.max(0.1, targetFt)));
  const playerLen = referenceLen * lengthRatio;

  const driftCapped = Math.min(60, Math.max(-60, result.driftDeg));
  const angleRad = (driftCapped * Math.PI) / 180;
  const playerEndX = cx + Math.sin(angleRad) * playerLen;
  const playerEndY = startY - Math.cos(angleRad) * playerLen;

  const ok = result.total >= 1500;
  const meh = result.total >= 700 && result.total < 1500;
  const playerColor = ok ? neon('green') : meh ? neon('yellow') : neon('red');

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 4,
      }}
    >
      <Svg width={W} height={H}>
        <SvgLine
          x1={cx}
          y1={startY}
          x2={cx}
          y2={targetEndY}
          stroke={colors.textMute}
          strokeWidth={2}
          strokeDasharray="6,4"
        />
        <Circle
          cx={cx}
          cy={targetEndY}
          r={6}
          fill="none"
          stroke={neon('cyan')}
          strokeWidth={2}
        />
        <Circle cx={cx} cy={targetEndY} r={2.5} fill={neon('cyan')} />
        <SvgLine
          x1={cx}
          y1={startY}
          x2={playerEndX}
          y2={playerEndY}
          stroke={playerColor}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={playerEndX} cy={playerEndY} r={5} fill={playerColor} />
        <SvgLine
          x1={cx}
          y1={targetEndY}
          x2={playerEndX}
          y2={playerEndY}
          stroke={playerColor}
          strokeWidth={1}
          strokeOpacity={0.4}
          strokeDasharray="2,3"
        />
        <Circle cx={cx} cy={startY} r={3} fill={colors.text} />
        <SvgText
          x={cx + 8}
          y={startY + 4}
          fill={colors.textMute}
          fontSize={9}
        >
          {'START'}
        </SvgText>
        <SvgText
          x={cx + 8}
          y={targetEndY + 3}
          fill={colors.textMute}
          fontSize={9}
        >
          {`${targetFt} FT TARGET`}
        </SvgText>
      </Svg>
    </View>
  );
}

function modeLabel(m: Level['mode']): string {
  if (m === 'STRAIGHT') return '★ STRAIGHT MODE ★';
  if (m === 'RETURN') return '★ RETURN MODE ★';
  return '★ VARIABLE MODE ★';
}

function modeColor(m: Level['mode']): string {
  if (m === 'STRAIGHT') return neon('cyan');
  if (m === 'RETURN') return neon('green');
  return neon('orange');
}

function modeInstructions(lvl: Level): string {
  if (lvl.mode === 'STRAIGHT') {
    return `WALK ${lvl.targetFeet} FT IN A LINE.\nSUBMIT WHEN YOU'RE DONE.`;
  }
  if (lvl.mode === 'RETURN') {
    return `WALK ${lvl.targetFeet} FT, TURN AROUND,\nWALK BACK TO START.\nSUBMIT WHEN YOU'RE DONE.`;
  }
  return `START WITH ${lvl.targetFeet} FT.\nMID-WALK, A NEW NUMBER\nWILL FLASH ON SCREEN.\nADJUST AND SUBMIT.`;
}

function feetToSteps(feet: number): number {
  return Math.max(1, Math.round(feet / STRIDE_FT));
}

function stepsToFeet(steps: number): number {
  return steps * STRIDE_FT;
}

function scoreFromError(error: number, perfect: number, max: number): number {
  if (error <= perfect) return 1000;
  if (error >= max) return 0;
  return Math.round(1000 * (1 - (error - perfect) / (max - perfect)));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
