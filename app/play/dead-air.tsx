// DEAD AIR — combined stillness + silence endurance.
//
// Hold the phone in your hand. Stay still. Stay quiet. The score is the
// total time both conditions are held. Either fails (motion or sound)
// and the run ends. Setting the phone down counts as cheating — the
// jitter floor of a stationary phone is essentially zero, well below
// human-grip jitter, so we score *nothing* until your jitter rises
// into the human-hand zone.
//
// Periodic proof-of-life buzz: every 18-30s the phone fires a haptic.
// We sample jitter for ~400ms after; if it doesn't spike (because the
// phone is on a soft surface absorbing the buzz), the run fails with
// "PROOF OF LIFE FAILED."
//
// Live UI shows two meters with their valid zones marked, plus the
// score timer ticking up only while both conditions hold.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

// --- Stillness thresholds (units: g of jitter) -------------------------
// Goldilocks zone — human hand jitter falls in this range. Setting the
// phone on a table reads ≤ 0.005g; deliberate movement is > 0.04g.
const STILL_FLOOR = 0.005; // below this = "phone is set down" (no score, no fail until grace)
const STILL_OK_LO = 0.005;
const STILL_OK_HI = 0.04;
const STILL_FAIL = 0.05; // sustained over this for STILL_FAIL_MS = end run

// --- Quiet thresholds (units: dBFS, native expo-av Recording metering) -
// dBFS is negative; 0 = peak, lower = quieter. -50 is whisper-quiet,
// -25 is conversational, -15 is loud.
const QUIET_OK = -28; // anywhere quieter than this is good
const QUIET_FAIL = -18; // sustained louder = run ends

const STILL_FAIL_MS = 220;
const QUIET_FAIL_MS = 280;
const FLOOR_GRACE_MS = 4000; // allow up to 4s of "too still" before suspecting set-down

const TICK_MS = 33; // ~30Hz UI refresh
const COUNTDOWN_STEP_MS = 600;
const FAIL_FREEZE_MS = 1500;

// Buzz check timing
const BUZZ_MIN_INTERVAL_MS = 18_000;
const BUZZ_MAX_INTERVAL_MS = 30_000;
const BUZZ_RESPONSE_WINDOW_MS = 500;
const BUZZ_RESPONSE_THRESHOLD_G = 0.025; // jitter must spike past this during the buzz

const ACCENT = neon('cyan');

type Phase = 'permission' | 'denied' | 'ready' | 'countdown' | 'playing' | 'fail';
type FailReason = 'MOVED' | 'NOISE' | 'PROOF OF LIFE' | 'SET DOWN';

export default function DeadAirGame() {
  const [phase, setPhase] = useState<Phase>('permission');
  const [tick, setTick] = useState(0);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 0>(3);
  const [score, setScore] = useState(0); // centiseconds — 100 = 1s
  const [failReason, setFailReason] = useState<FailReason | null>(null);
  const [buzzActive, setBuzzActive] = useState(false);

  // Live meter state for the visible bars.
  const [jitter, setJitter] = useState(0);
  const [dbfs, setDbfs] = useState(-160);

  const phaseRef = useRef<Phase>('permission');
  const lastFrameRef = useRef(Date.now());
  const startTimeRef = useRef(0);
  const scoreCsRef = useRef(0); // centiseconds accumulated
  const jitterRef = useRef(0);
  const dbfsRef = useRef(-160);
  const tooMovedSinceRef = useRef(0); // timestamp ms; 0 = not currently failing
  const tooLoudSinceRef = useRef(0);
  const floorSinceRef = useRef(0); // how long jitter has been below STILL_FLOOR
  const buzzActiveUntilRef = useRef(0);
  const buzzPeakRef = useRef(0);
  const nextBuzzAtRef = useRef(0);

  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAccelRef = useRef({ x: 0, y: 0, z: 0 });

  // Permission + sensor setup.
  useEffect(() => {
    (async () => {
      const audioPerm = await Audio.requestPermissionsAsync().catch(() => null);
      if (!audioPerm || audioPerm.status !== 'granted') {
        setPhaseSafe('denied');
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch {
        // Non-fatal
      }
      setPhaseSafe('ready');
    })();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    accelSubRef.current?.remove();
    accelSubRef.current = null;
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    if (rafRef.current) clearTimeout(rafRef.current);
    if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
  }

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  async function startSensors() {
    // Accelerometer — sample fast enough to detect buzz response.
    Accelerometer.setUpdateInterval(40);
    accelSubRef.current = Accelerometer.addListener((sample) => {
      const last = lastAccelRef.current;
      // Magnitude of frame-to-frame delta — purer "jitter" signal than
      // raw magnitude (which has gravity in it).
      const dx = sample.x - last.x;
      const dy = sample.y - last.y;
      const dz = sample.z - last.z;
      const j = Math.sqrt(dx * dx + dy * dy + dz * dz);
      lastAccelRef.current = sample;
      // Smooth a touch with EMA so single samples don't cause flicker.
      jitterRef.current = jitterRef.current * 0.65 + j * 0.35;
      // Track buzz-response peak inside the response window.
      if (Date.now() < buzzActiveUntilRef.current) {
        if (jitterRef.current > buzzPeakRef.current) {
          buzzPeakRef.current = jitterRef.current;
        }
      }
      setJitter(jitterRef.current);
    });

    // Audio recording with metering enabled — we never save the audio,
    // we just read status updates for dB level.
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === 'number') {
          dbfsRef.current = status.metering;
          setDbfs(status.metering);
        }
      });
      recording.setProgressUpdateInterval(80);
      await recording.startAsync();
      recordingRef.current = recording;
    } catch {
      // If recording fails (rare in Expo Go), fail the run gracefully.
      triggerFail('NOISE');
    }
  }

  function startRun() {
    scoreCsRef.current = 0;
    setScore(0);
    setFailReason(null);
    tooMovedSinceRef.current = 0;
    tooLoudSinceRef.current = 0;
    floorSinceRef.current = 0;
    nextBuzzAtRef.current = 0;
    setPhaseSafe('countdown');
    setCountdown(3);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    function step(value: 3 | 2 | 1 | 0) {
      countdownTimeoutRef.current = setTimeout(async () => {
        if (value === 0) {
          await startSensors();
          startTimeRef.current = Date.now();
          lastFrameRef.current = Date.now();
          // First buzz between 18 and 30s in.
          nextBuzzAtRef.current =
            Date.now() +
            BUZZ_MIN_INTERVAL_MS +
            Math.random() * (BUZZ_MAX_INTERVAL_MS - BUZZ_MIN_INTERVAL_MS);
          setPhaseSafe('playing');
          scheduleFrame();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else {
          setCountdown(value);
          Haptics.selectionAsync().catch(() => {});
          step((value - 1) as 3 | 2 | 1 | 0);
        }
      }, COUNTDOWN_STEP_MS);
    }
    step(3);
  }

  function scheduleFrame() {
    rafRef.current = setTimeout(gameLoop, TICK_MS);
  }

  function gameLoop() {
    if (phaseRef.current !== 'playing') return;
    const now = Date.now();
    const dt = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;

    const j = jitterRef.current;
    const db = dbfsRef.current;
    const inBuzzWindow = now < buzzActiveUntilRef.current;

    // --- Track stillness state ---------------------------------------
    if (j > STILL_FAIL) {
      if (tooMovedSinceRef.current === 0) tooMovedSinceRef.current = now;
      if (now - tooMovedSinceRef.current > STILL_FAIL_MS) {
        triggerFail('MOVED');
        return;
      }
    } else {
      tooMovedSinceRef.current = 0;
    }

    // Floor (set-down) detection. We allow a short grace because real
    // hands can be VERY steady. After grace, we don't fail outright —
    // we just don't accumulate score, so cheating produces a 0 run.
    if (j < STILL_FLOOR) {
      if (floorSinceRef.current === 0) floorSinceRef.current = now;
    } else {
      floorSinceRef.current = 0;
    }

    // --- Track quiet state -------------------------------------------
    if (db > QUIET_FAIL) {
      if (tooLoudSinceRef.current === 0) tooLoudSinceRef.current = now;
      if (now - tooLoudSinceRef.current > QUIET_FAIL_MS) {
        triggerFail('NOISE');
        return;
      }
    } else {
      tooLoudSinceRef.current = 0;
    }

    // --- Buzz-check curveball ----------------------------------------
    // After the response window closes, evaluate: did jitter spike?
    if (
      buzzActiveUntilRef.current > 0 &&
      now >= buzzActiveUntilRef.current &&
      buzzPeakRef.current >= 0
    ) {
      const peak = buzzPeakRef.current;
      buzzActiveUntilRef.current = 0;
      buzzPeakRef.current = -1; // marker: evaluated
      setBuzzActive(false);
      if (peak < BUZZ_RESPONSE_THRESHOLD_G) {
        triggerFail('PROOF OF LIFE');
        return;
      }
    }

    // Schedule next buzz?
    if (
      !inBuzzWindow &&
      buzzPeakRef.current < 0 &&
      now >= nextBuzzAtRef.current
    ) {
      // Fire it
      buzzActiveUntilRef.current = now + BUZZ_RESPONSE_WINDOW_MS;
      buzzPeakRef.current = 0;
      setBuzzActive(true);
      nextBuzzAtRef.current =
        now +
        BUZZ_RESPONSE_WINDOW_MS +
        BUZZ_MIN_INTERVAL_MS +
        Math.random() * (BUZZ_MAX_INTERVAL_MS - BUZZ_MIN_INTERVAL_MS);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }

    // --- Score accrual ------------------------------------------------
    // Both conditions must be in OK zone, AND jitter above the floor
    // (proves the phone is being held). Buzz window pauses scoring.
    const stillValid = j >= STILL_OK_LO && j <= STILL_OK_HI;
    const quietValid = db <= QUIET_OK;
    const heldValid =
      j >= STILL_FLOOR ||
      now - floorSinceRef.current < FLOOR_GRACE_MS;

    if (stillValid && quietValid && heldValid && !inBuzzWindow) {
      scoreCsRef.current += dt * 100; // centiseconds
      setScore(Math.round(scoreCsRef.current));
    }

    setTick((t) => t + 1);
    scheduleFrame();
  }

  function triggerFail(reason: FailReason) {
    if (phaseRef.current !== 'playing') return;
    setFailReason(reason);
    setPhaseSafe('fail');
    cleanupSensors();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    finishTimeoutRef.current = setTimeout(() => finalize(), FAIL_FREEZE_MS);
  }

  function cleanupSensors() {
    accelSubRef.current?.remove();
    accelSubRef.current = null;
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
  }

  function finalize() {
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'dead-air',
        score: String(Math.round(scoreCsRef.current)),
      },
    });
  }

  // ---------- Render --------------------------------------------------
  if (phase === 'permission') {
    return (
      <View style={fullCenter}>
        <ArcadeText variant="pixel" size={12} color={ACCENT}>
          {'WAITING FOR MIC...'}
        </ArcadeText>
      </View>
    );
  }
  if (phase === 'denied') {
    return (
      <View style={fullCenter}>
        <ArcadeText variant="pixel" size={14} color={neon('red')} glowColor={neon('red')} align="center">
          {'MIC  BLOCKED'}
        </ArcadeText>
        <View style={{ height: spacing.md }} />
        <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
          {'DEAD AIR NEEDS MICROPHONE\nACCESS. ENABLE IT IN SETTINGS.'}
        </ArcadeText>
      </View>
    );
  }

  const seconds = (score / 100).toFixed(2);

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
              {'DEAD AIR'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={32}
              color={ACCENT}
              glowColor={ACCENT}
            >
              {seconds}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {'SECONDS HELD'}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {phase === 'playing' && buzzActive ? (
              <Blink intervalMs={140}>
                <ArcadeText
                  variant="pixel"
                  size={10}
                  color={neon('yellow')}
                  glowColor={neon('yellow')}
                >
                  {'★ HOLD STEADY'}
                </ArcadeText>
              </Blink>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
        {/* STILLNESS METER */}
        <MeterCard
          title="STILLNESS"
          subtitle="hold the phone in your hand"
          metric={jitter}
          formatMetric={(v) => `${v.toFixed(4)} g`}
          status={
            jitter > STILL_FAIL
              ? 'FAIL'
              : jitter > STILL_OK_HI
                ? 'TOO MOVED'
                : jitter < STILL_FLOOR
                  ? 'SET DOWN?'
                  : 'OK'
          }
        >
          <StillBar jitter={jitter} />
        </MeterCard>

        {/* QUIET METER */}
        <MeterCard
          title="SILENCE"
          subtitle="ambient noise must stay low"
          metric={dbfs}
          formatMetric={(v) => `${v.toFixed(0)} dBFS`}
          status={
            dbfs > QUIET_FAIL ? 'FAIL' : dbfs > QUIET_OK ? 'TOO LOUD' : 'OK'
          }
        >
          <QuietBar dbfs={dbfs} />
        </MeterCard>
      </View>

      {/* READY overlay */}
      {phase === 'ready' ? (
        <View style={overlayStyle}>
          <ArcadeText variant="pixel" size={18} color={ACCENT} glowColor={ACCENT} align="center">
            {'DEAD AIR'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />
          <ArcadeText variant="mono" size={15} color={colors.textDim} align="center">
            {
              'HOLD THE PHONE.\nSTAY STILL.\nSTAY QUIET.\n\nRANDOM BUZZ CHECKS — DON\'T REACT.\nTHE ROOM AND YOUR HAND DECIDE\nHOW LONG YOU LAST.'
            }
          </ArcadeText>
          <View style={{ height: spacing.lg }} />
          <Pressable onPress={startRun}>
            <NeonFrame color={ACCENT} thickness={3} padding={spacing.lg} fill="rgba(8,8,15,0.7)">
              <Blink>
                <ArcadeText
                  variant="pixel"
                  size={14}
                  color={ACCENT}
                  glowColor={ACCENT}
                >
                  {'BEGIN'}
                </ArcadeText>
              </Blink>
            </NeonFrame>
          </Pressable>
        </View>
      ) : null}

      {/* COUNTDOWN */}
      {phase === 'countdown' ? (
        <View style={overlayStyle}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'GET READY'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />
          <ArcadeText
            variant="pixel"
            size={84}
            color={countdown === 0 ? neon('green') : ACCENT}
            glowColor={countdown === 0 ? neon('green') : ACCENT}
            glowRadius={20}
          >
            {countdown === 0 ? 'GO' : String(countdown)}
          </ArcadeText>
        </View>
      ) : null}

      {/* FAIL */}
      {phase === 'fail' ? (
        <View style={overlayStyle}>
          <Blink intervalMs={300} minOpacity={0.3}>
            <ArcadeText
              variant="pixel"
              size={20}
              color={neon('red')}
              glowColor={neon('red')}
              glowRadius={16}
              align="center"
            >
              {failReason ?? 'FAILED'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.md }} />
          <ArcadeText variant="mono" size={28} color={colors.textDim}>
            {`${seconds}s`}
          </ArcadeText>
        </View>
      ) : null}

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

// =====================================================================
// MeterCard — shared frame for each axis
function MeterCard({
  title,
  subtitle,
  metric,
  formatMetric,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  metric: number;
  formatMetric: (v: number) => string;
  status: 'OK' | 'TOO MOVED' | 'TOO LOUD' | 'SET DOWN?' | 'FAIL';
  children: React.ReactNode;
}) {
  const c =
    status === 'OK'
      ? neon('green')
      : status === 'FAIL'
        ? neon('red')
        : neon('yellow');
  return (
    <NeonFrame color={c} thickness={1} padding={spacing.sm} glow={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <ArcadeText variant="pixel" size={11} color={c} glowColor={c}>
            {title}
          </ArcadeText>
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>
            {subtitle}
          </ArcadeText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ArcadeText variant="mono" size={14} color={colors.text}>
            {formatMetric(metric)}
          </ArcadeText>
          <ArcadeText variant="pixel" size={7} color={c}>
            {status}
          </ArcadeText>
        </View>
      </View>
      <View style={{ height: spacing.sm }} />
      {children}
    </NeonFrame>
  );
}

// Stillness bar — horizontal axis from 0g to 0.06g, with the goldilocks
// zone (0.005-0.04) highlighted green, fail zone (>0.05) red, and the
// "set-down floor" (<0.005) gray. Current jitter is a needle.
function StillBar({ jitter }: { jitter: number }) {
  const W = 280;
  const H = 26;
  const max = 0.06;
  const px = (v: number) => Math.min(W, Math.max(0, (v / max) * W));
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Track */}
      <Rect x={0} y={6} width={W} height={H - 12} fill={colors.bgElevated} />
      {/* Set-down floor zone */}
      <Rect x={0} y={6} width={px(STILL_FLOOR)} height={H - 12} fill={colors.textMute} fillOpacity={0.4} />
      {/* Goldilocks zone */}
      <Rect
        x={px(STILL_OK_LO)}
        y={6}
        width={px(STILL_OK_HI) - px(STILL_OK_LO)}
        height={H - 12}
        fill={neon('green')}
        fillOpacity={0.3}
      />
      {/* Fail zone */}
      <Rect
        x={px(STILL_FAIL)}
        y={6}
        width={W - px(STILL_FAIL)}
        height={H - 12}
        fill={neon('red')}
        fillOpacity={0.4}
      />
      {/* Threshold lines */}
      <Line x1={px(STILL_FLOOR)} y1={2} x2={px(STILL_FLOOR)} y2={H - 2} stroke={colors.textMute} strokeWidth={1} />
      <Line x1={px(STILL_OK_HI)} y1={2} x2={px(STILL_OK_HI)} y2={H - 2} stroke={neon('green')} strokeWidth={1} />
      <Line x1={px(STILL_FAIL)} y1={2} x2={px(STILL_FAIL)} y2={H - 2} stroke={neon('red')} strokeWidth={1} />
      {/* Needle */}
      <Line
        x1={px(jitter)}
        y1={0}
        x2={px(jitter)}
        y2={H}
        stroke={colors.text}
        strokeWidth={2}
      />
      {/* Labels */}
      <SvgText x={px(STILL_FLOOR) + 2} y={H - 1} fill={colors.textMute} fontSize={6}>
        DOWN
      </SvgText>
      <SvgText x={px(STILL_OK_LO) + 2} y={5} fill={neon('green')} fontSize={6}>
        HOLD
      </SvgText>
      <SvgText x={px(STILL_FAIL) + 2} y={H - 1} fill={neon('red')} fontSize={6}>
        FAIL
      </SvgText>
    </Svg>
  );
}

// Quiet bar — dBFS axis from -60 (silent) to 0 (max). Green zone at the
// quiet end, fail zone at loud end.
function QuietBar({ dbfs }: { dbfs: number }) {
  const W = 280;
  const H = 26;
  const lo = -60;
  const hi = 0;
  const px = (v: number) => Math.min(W, Math.max(0, ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * W));
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={6} width={W} height={H - 12} fill={colors.bgElevated} />
      {/* Safe (quiet) zone */}
      <Rect
        x={0}
        y={6}
        width={px(QUIET_OK)}
        height={H - 12}
        fill={neon('green')}
        fillOpacity={0.3}
      />
      {/* Warning zone */}
      <Rect
        x={px(QUIET_OK)}
        y={6}
        width={px(QUIET_FAIL) - px(QUIET_OK)}
        height={H - 12}
        fill={neon('yellow')}
        fillOpacity={0.3}
      />
      {/* Fail zone */}
      <Rect
        x={px(QUIET_FAIL)}
        y={6}
        width={W - px(QUIET_FAIL)}
        height={H - 12}
        fill={neon('red')}
        fillOpacity={0.4}
      />
      <Line x1={px(QUIET_OK)} y1={2} x2={px(QUIET_OK)} y2={H - 2} stroke={neon('green')} strokeWidth={1} />
      <Line x1={px(QUIET_FAIL)} y1={2} x2={px(QUIET_FAIL)} y2={H - 2} stroke={neon('red')} strokeWidth={1} />
      <Line
        x1={px(dbfs)}
        y1={0}
        x2={px(dbfs)}
        y2={H}
        stroke={colors.text}
        strokeWidth={2}
      />
      <SvgText x={2} y={5} fill={neon('green')} fontSize={6}>
        QUIET
      </SvgText>
      <SvgText x={px(QUIET_FAIL) - 22} y={H - 1} fill={neon('red')} fontSize={6}>
        LOUD
      </SvgText>
    </Svg>
  );
}

// ---- styles ----------------------------------------------------------
const fullCenter = {
  flex: 1,
  backgroundColor: colors.bg,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  padding: spacing.xl,
};

const overlayStyle = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(8,8,15,0.85)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  padding: spacing.lg,
};
