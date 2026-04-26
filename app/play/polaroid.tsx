// Polaroid — camera-based spot-the-difference, with real photo mods.
//
// Each round:
//   1. Live camera. Tap to shoot.
//   2. MEMORIZE — original photo shown for 2 seconds.
//   3. REVEAL — same photo, modified. The mod is one of:
//        a) PATCH-SWAP: a piece of the photo cropped from a random location
//           and pasted somewhere else, often mirrored or rotated. Looks
//           "from the photo" but obviously displaced.
//        b) TINT: a translucent neon rectangle laid over a region — looks
//           like a color cast or filter applied to part of the image.
//        c) WASH: a translucent grayish rectangle — desaturates the area.
//        d) DARKEN: a translucent black rectangle — looks like a shadow patch.
//      Each mod gets a slight rotation so it doesn't read as a UI target.
//   4. Tap on the modified region.
//   5. Score = speed (max 1000 at ≤200ms) + accuracy (max 1000 inside the
//      mod's bounds, drops outside).
//
// Five rounds. After round 5 the game shows an explicit "GAME COMPLETE"
// overlay for ~1.5s, then routes to the result screen.

import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing, NeonColor } from '../../src/theme';

// --- Tunables ----------------------------------------------------------
const TOTAL_ROUNDS = 5;
const MEMORIZE_MS = 2000;
const BETWEEN_MS = 1300;
const REVEAL_TIMEOUT_MS = 7000;
const ALL_DONE_MS = 1600;

const ACCENT = neon('cyan');

const TINT_COLORS: NeonColor[] = ['cyan', 'magenta', 'yellow', 'green', 'red', 'purple'];

const screenDims = Dimensions.get('window');

type ModType = 'patch-swap' | 'tint' | 'wash' | 'darken';

type Mod = {
  type: ModType;
  // Center point (used for tap-distance calculation).
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number; // degrees
  // For color overlays
  color?: string;
  opacity?: number;
  // For patch-swap
  patchUri?: string;
  flipped?: boolean;
};

type Phase =
  | 'permission'
  | 'denied'
  | 'ready'
  | 'capturing'
  | 'memorize'
  | 'reveal'
  | 'between'
  | 'all-done';

type RoundResult = {
  score: number;
  distance: number;
  reactionMs: number;
  kind: 'hit' | 'miss' | 'timeout';
};

// =====================================================================
export default function PolaroidGame() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('permission');
  const [round, setRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mod, setMod] = useState<Mod | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  const phaseRef = useRef<Phase>('permission');
  const cameraRef = useRef<CameraView>(null);
  const modRef = useRef<Mod | null>(null);
  const revealAtRef = useRef(0);
  const totalScoreRef = useRef(0);
  const roundRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Camera permission flow.
  useEffect(() => {
    if (!permission) return;
    if (permission.granted) {
      setPhaseSafe('ready');
    } else if (permission.canAskAgain) {
      requestPermission();
    } else {
      setPhaseSafe('denied');
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  async function shootPhoto() {
    if (!cameraRef.current) {
      // Camera ref not ready yet — abort gracefully without consuming a round
      roundRef.current = Math.max(0, roundRef.current - 1);
      setRound(roundRef.current);
      setPhaseSafe('ready');
      return;
    }
    setPhaseSafe('capturing');
    setFlashOn(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const photo = await cameraRef.current.takePictureAsync({
        skipProcessing: true,
        quality: 0.7,
      });
      setTimeout(() => setFlashOn(false), 160);
      if (!photo?.uri) {
        roundRef.current = Math.max(0, roundRef.current - 1);
        setRound(roundRef.current);
        setPhaseSafe('ready');
        return;
      }
      setPhotoUri(photo.uri);
      setPhaseSafe('memorize');

      // 2-second memorize phase, then async-build the mod and reveal.
      timeoutRef.current = setTimeout(async () => {
        const newMod = await buildMod(photo.uri, photo.width, photo.height);
        modRef.current = newMod;
        setMod(newMod);
        revealAtRef.current = Date.now();
        setPhaseSafe('reveal');

        // Per-round timeout — score 0 if no tap.
        timeoutRef.current = setTimeout(() => {
          if (phaseRef.current === 'reveal') {
            handleResult({
              score: 0,
              distance: Infinity,
              reactionMs: REVEAL_TIMEOUT_MS,
              kind: 'timeout',
            });
          }
        }, REVEAL_TIMEOUT_MS);
      }, MEMORIZE_MS);
    } catch {
      setFlashOn(false);
      roundRef.current = Math.max(0, roundRef.current - 1);
      setRound(roundRef.current);
      setPhaseSafe('ready');
    }
  }

  function handleScreenTap(e: GestureResponderEvent) {
    const p = phaseRef.current;

    if (p === 'ready') {
      // Already played all rounds — just route immediately (defensive).
      if (roundRef.current >= TOTAL_ROUNDS) {
        finalize();
        return;
      }
      roundRef.current += 1;
      setRound(roundRef.current);
      shootPhoto();
      return;
    }

    if (p === 'reveal' && modRef.current) {
      const tx = e.nativeEvent.locationX;
      const ty = e.nativeEvent.locationY;
      const m = modRef.current;
      const d = Math.hypot(tx - m.cx, ty - m.cy);
      const reactionMs = Date.now() - revealAtRef.current;
      const score = scoreForTap(reactionMs, d, m);
      handleResult({
        score,
        distance: d,
        reactionMs,
        kind: score > 0 ? 'hit' : 'miss',
      });
    }
  }

  function handleResult(result: RoundResult) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    totalScoreRef.current += result.score;
    setTotalScore(totalScoreRef.current);
    setLastResult(result);
    setPhaseSafe('between');

    Haptics.impactAsync(
      result.score > 1500
        ? Haptics.ImpactFeedbackStyle.Heavy
        : result.score > 500
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});

    // Capture the round number RIGHT NOW so the timeout can't see a
    // stale value if anything else mutates the ref.
    const justCompletedRound = roundRef.current;

    timeoutRef.current = setTimeout(() => {
      if (justCompletedRound >= TOTAL_ROUNDS) {
        // Show GAME COMPLETE overlay before routing so the player sees
        // the run actually ended (versus just bouncing back to camera).
        setPhaseSafe('all-done');
        timeoutRef.current = setTimeout(() => finalize(), ALL_DONE_MS);
      } else {
        setMod(null);
        modRef.current = null;
        setPhotoUri(null);
        setPhaseSafe('ready');
      }
    }, BETWEEN_MS);
  }

  function finalize() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'polaroid',
        score: String(totalScoreRef.current),
      },
    });
  }

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Camera preview when ready/capturing */}
      {(phase === 'ready' || phase === 'capturing') && permission?.granted ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mute
          />
        </View>
      ) : null}

      {/* Captured photo for memorize/reveal/between/all-done */}
      {(phase === 'memorize' ||
        phase === 'reveal' ||
        phase === 'between' ||
        phase === 'all-done') &&
      photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}

      {/* The modification overlay */}
      {(phase === 'reveal' || phase === 'between') && mod ? (
        <ModView mod={mod} />
      ) : null}

      {/* Highlight halo on the mod after the player taps */}
      {phase === 'between' && mod ? <ResultHalo mod={mod} result={lastResult} /> : null}

      {/* Capture flash */}
      {flashOn ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'white',
            opacity: 0.85,
          }}
        />
      ) : null}

      {/* Tap responder + HUD on top */}
      <Pressable onPress={handleScreenTap} style={StyleSheet.absoluteFill}>
        <SafeAreaView edges={['top']} pointerEvents="none">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            }}
          >
            <View style={hudCardStyle}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'ROUND'}
              </ArcadeText>
              <ArcadeText variant="mono" size={20} color={ACCENT} glowColor={ACCENT}>
                {`${Math.max(round, 0)}/${TOTAL_ROUNDS}`}
              </ArcadeText>
            </View>
            <View style={hudCardStyle}>
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
            </View>
          </View>
        </SafeAreaView>

        {phase === 'permission' ? (
          <View style={overlayStyle('40%')}>
            <ArcadeText variant="pixel" size={12} color={ACCENT}>
              {'WAITING FOR CAMERA...'}
            </ArcadeText>
          </View>
        ) : null}

        {phase === 'denied' ? (
          <View style={overlayStyle('30%')}>
            <ArcadeText variant="pixel" size={14} color={neon('red')} glowColor={neon('red')}>
              {'CAMERA  BLOCKED'}
            </ArcadeText>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
              {'POLAROID NEEDS CAMERA ACCESS.\nENABLE IT IN SETTINGS,\nTHEN TAP TO RETRY.'}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <Pressable
              onPress={() => {
                if (permission?.canAskAgain) requestPermission();
              }}
            >
              <NeonFrame color={ACCENT} thickness={2} padding={spacing.md}>
                <ArcadeText variant="pixel" size={10} color={ACCENT}>
                  {'RETRY'}
                </ArcadeText>
              </NeonFrame>
            </Pressable>
          </View>
        ) : null}

        {phase === 'ready' ? (
          <View style={overlayStyle('70%')}>
            <Blink>
              <NeonFrame color={ACCENT} thickness={3} padding={spacing.lg} fill="rgba(8,8,15,0.5)">
                <ArcadeText
                  variant="pixel"
                  size={16}
                  color={ACCENT}
                  glowColor={ACCENT}
                  align="center"
                >
                  {round === 0 ? 'TAP TO SHOOT' : `ROUND ${round + 1} — TAP TO SHOOT`}
                </ArcadeText>
              </NeonFrame>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="pixel" size={9} color={colors.text}>
              {'POINT THE CAMERA AT ANYTHING'}
            </ArcadeText>
          </View>
        ) : null}

        {phase === 'memorize' ? (
          <View style={overlayStyle('5%')}>
            <View style={ribbonStyle}>
              <Blink intervalMs={350} minOpacity={0.45}>
                <ArcadeText variant="pixel" size={14} color={ACCENT} glowColor={ACCENT}>
                  {'MEMORIZE...'}
                </ArcadeText>
              </Blink>
            </View>
          </View>
        ) : null}

        {phase === 'reveal' ? (
          <View style={overlayStyle('5%')}>
            <View style={ribbonStyle}>
              <ArcadeText
                variant="pixel"
                size={14}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {'SPOT IT — TAP IT'}
              </ArcadeText>
            </View>
          </View>
        ) : null}

        {phase === 'between' && lastResult ? (
          <View style={overlayStyle('40%')}>
            <ArcadeText
              variant="pixel"
              size={11}
              color={resultLabelColor(lastResult)}
              glowColor={resultLabelColor(lastResult)}
            >
              {resultLabel(lastResult)}
            </ArcadeText>
            <View style={{ height: spacing.sm }} />
            <ArcadeText
              variant="mono"
              size={48}
              color={lastResult.score > 0 ? neon('green') : neon('red')}
              glowColor={lastResult.score > 0 ? neon('green') : neon('red')}
            >
              {lastResult.score > 0 ? `+${lastResult.score}` : `${lastResult.score}`}
            </ArcadeText>
            {lastResult.kind === 'hit' ? (
              <ArcadeText variant="pixel" size={8} color={colors.textDim} style={{ marginTop: 4 }}>
                {`${Math.round(lastResult.reactionMs)}MS · ${Math.round(lastResult.distance)}PX`}
              </ArcadeText>
            ) : null}
          </View>
        ) : null}

        {phase === 'all-done' ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(8,8,15,0.78)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Blink intervalMs={420} minOpacity={0.4}>
              <ArcadeText
                variant="pixel"
                size={22}
                color={neon('yellow')}
                glowColor={neon('yellow')}
                glowRadius={16}
                align="center"
              >
                {'!! GAME COMPLETE !!'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'FINAL SCORE'}
            </ArcadeText>
            <View style={{ height: spacing.xs }} />
            <ArcadeText variant="mono" size={48} color={neon('green')} glowColor={neon('green')}>
              {String(totalScoreRef.current)}
            </ArcadeText>
          </View>
        ) : null}

        <ScanlineOverlay opacity={0.05} />
      </Pressable>
      <InGameExit />
    </View>
  );
}

// =====================================================================
// Mod renderer — branches on mod.type.
function ModView({ mod }: { mod: Mod }) {
  const baseStyle = {
    position: 'absolute' as const,
    left: mod.cx - mod.width / 2,
    top: mod.cy - mod.height / 2,
    width: mod.width,
    height: mod.height,
    transform: [{ rotate: `${mod.rotation}deg` }],
  };

  if (mod.type === 'patch-swap' && mod.patchUri) {
    return (
      <View pointerEvents="none" style={baseStyle}>
        <Image
          source={{ uri: mod.patchUri }}
          style={{
            width: '100%',
            height: '100%',
            transform: [{ scaleX: mod.flipped ? -1 : 1 }],
          }}
          resizeMode="cover"
        />
        {/* Hairline edge so the patch reads as "placed" not "blended" */}
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.25)',
          }}
        />
      </View>
    );
  }

  // Color-overlay mods: tint, wash, darken.
  return (
    <View
      pointerEvents="none"
      style={[
        baseStyle,
        {
          backgroundColor: mod.color ?? 'rgba(0,0,0,0.5)',
          opacity: mod.opacity ?? 0.5,
          borderRadius: 4,
        },
      ]}
    />
  );
}

function ResultHalo({ mod, result }: { mod: Mod; result: RoundResult | null }) {
  if (!result) return null;
  const ringColor = result.score > 0 ? neon('green') : neon('red');
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: mod.cx - mod.width / 2 - 6,
        top: mod.cy - mod.height / 2 - 6,
        width: mod.width + 12,
        height: mod.height + 12,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: ringColor,
        opacity: 0.85,
        transform: [{ rotate: `${mod.rotation}deg` }],
      }}
    />
  );
}

// =====================================================================
// Mod construction — async because patch-swap calls expo-image-manipulator.
async function buildMod(
  photoUri: string,
  photoW: number | undefined,
  photoH: number | undefined,
): Promise<Mod> {
  // Random pick from the four mod types. patch-swap requires real photo
  // dimensions; if the camera didn't return them, fall back to color mods.
  const types: ModType[] = photoW && photoH
    ? ['patch-swap', 'patch-swap', 'tint', 'wash', 'darken'] // weight patch-swap a bit
    : ['tint', 'wash', 'darken'];
  const type = types[Math.floor(Math.random() * types.length)];

  // Mod display dimensions on screen (pixels). Mid-sized rectangle.
  const minW = 110;
  const maxW = 170;
  const w = minW + Math.random() * (maxW - minW);
  const h = w * (0.85 + Math.random() * 0.5); // slight aspect variation

  // Center somewhere safely inside screen, away from HUD strip.
  const margin = 30;
  const cx = w / 2 + margin + Math.random() * (screenDims.width - w - 2 * margin);
  const cyMin = 110;
  const cyMax = screenDims.height - 110;
  const cy = h / 2 + cyMin + Math.random() * (cyMax - cyMin - h);

  // Slight rotation to make it not feel like a UI target.
  const rotation = (Math.random() - 0.5) * 24;

  const base: Mod = { type, cx, cy, width: w, height: h, rotation };

  if (type === 'tint') {
    const c = TINT_COLORS[Math.floor(Math.random() * TINT_COLORS.length)];
    return { ...base, color: neon(c), opacity: 0.42 };
  }
  if (type === 'wash') {
    return { ...base, color: 'rgb(220,220,220)', opacity: 0.55 };
  }
  if (type === 'darken') {
    return { ...base, color: 'rgb(0,0,0)', opacity: 0.55 };
  }

  // patch-swap — async crop from the photo.
  if (photoW && photoH) {
    try {
      // Pick a source patch in PHOTO pixel coords. Patch is square (matches
      // mod dims roughly when scaled). 220×220 in photo space typically
      // looks like ~110×110 on screen at 7-megapixel-ish capture.
      const cropPhotoSize = Math.min(photoW, photoH) * 0.18;
      const sourceX = Math.random() * Math.max(1, photoW - cropPhotoSize);
      const sourceY = Math.random() * Math.max(1, photoH - cropPhotoSize);

      const cropped = await ImageManipulator.manipulateAsync(
        photoUri,
        [
          {
            crop: {
              originX: Math.round(sourceX),
              originY: Math.round(sourceY),
              width: Math.round(cropPhotoSize),
              height: Math.round(cropPhotoSize),
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      const flipped = Math.random() > 0.5;
      return { ...base, patchUri: cropped.uri, flipped };
    } catch {
      // Fallback to a tint if the crop pipeline fails for any reason.
      const c = TINT_COLORS[Math.floor(Math.random() * TINT_COLORS.length)];
      return { ...base, type: 'tint', color: neon(c), opacity: 0.42 };
    }
  }

  // Shouldn't reach here, but TS likes a return.
  return { ...base, type: 'tint', color: neon('cyan'), opacity: 0.42 };
}

// =====================================================================
// Scoring + helpers

function scoreForTap(reactionMs: number, distance: number, mod: Mod): number {
  // Speed: 1000 at ≤200ms, 0 at ≥700ms.
  const speed = clamp(1000 - (reactionMs - 200) * 2, 0, 1000);

  // Accuracy: full points anywhere "inside-ish" the mod, scaling out.
  const effectiveR = Math.max(mod.width, mod.height) / 2;
  const innerR = effectiveR * 0.7;
  const outerR = effectiveR * 1.5 + 30;
  let accuracy: number;
  if (distance <= innerR) accuracy = 1000;
  else if (distance >= outerR) accuracy = 0;
  else accuracy = 1000 * (1 - (distance - innerR) / (outerR - innerR));

  return Math.round(clamp(speed + accuracy, 0, 2000));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function resultLabel(r: RoundResult): string {
  if (r.kind === 'timeout') return 'TOO  SLOW';
  if (r.kind === 'miss') return 'MISSED';
  if (r.score >= 1700) return 'PERFECT!';
  if (r.score >= 1300) return 'GREAT';
  if (r.score >= 700) return 'NICE';
  return 'CAUGHT IT';
}

function resultLabelColor(r: RoundResult): string {
  if (r.kind !== 'hit') return neon('red');
  if (r.score >= 1700) return neon('yellow');
  if (r.score >= 1000) return neon('green');
  return neon('orange');
}

const hudCardStyle = {
  backgroundColor: 'rgba(8,8,15,0.55)',
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  alignItems: 'flex-start' as const,
};

const ribbonStyle = {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
  backgroundColor: 'rgba(8,8,15,0.7)',
};

function overlayStyle(top: string) {
  return {
    position: 'absolute' as const,
    top: top as any,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.lg,
  };
}
