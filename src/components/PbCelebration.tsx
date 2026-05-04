// Personal-best celebration overlay.
//
// Shown above the result screen when a run earns a tokenized reward
// (any PB, first top-10, or first #1 take). Locks the screen with a
// dark backdrop, animates a number ticker counting up to the final
// score, fires a starburst behind the score, and lands the +TOKENS
// chip with a haptic. The tier picks the color + intensity:
//
//   tier='pb'    → green, modest starburst, 5 tokens
//   tier='top10' → yellow, denser starburst, +20 tokens
//   tier='top1'  → magenta, dense starburst + confetti rain, +50 tokens
//
// Dismissible by tap once the ticker finishes; auto-dismisses after a
// safety timeout so a player who walks away still gets to the
// leaderboard view.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from './ArcadeText';
import { Blink } from './Blink';
import { NeonFrame } from './NeonFrame';
import { Game } from '../data/games';
import { playSfx } from '../lib/sound';
import { colors, neon, spacing } from '../theme';

export type CelebrationTier = 'pb' | 'top10' | 'top1';

type Props = {
  game: Game;
  score: number;
  detail?: { level?: number; taps?: number };
  rank: number;
  total: number;
  bonus: number;
  tier: CelebrationTier;
  onDismiss: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Tier presets — color, ray count, ticker duration, banner copy. Higher
// tiers get a longer ticker because the moment deserves to land.
const TIER_CONFIG: Record<
  CelebrationTier,
  {
    color: string;
    rayCount: number;
    rayLength: number;
    tickerMs: number;
    banner: string;
    confetti: boolean;
  }
> = {
  pb: {
    color: neon('green'),
    rayCount: 8,
    rayLength: 140,
    tickerMs: 900,
    banner: 'NEW PERSONAL BEST',
    confetti: false,
  },
  top10: {
    color: neon('yellow'),
    rayCount: 12,
    rayLength: 200,
    tickerMs: 1300,
    banner: '★  TOP 10  ★',
    confetti: false,
  },
  top1: {
    color: neon('magenta'),
    rayCount: 16,
    rayLength: 260,
    tickerMs: 1800,
    banner: '!! WORLD RECORD !!',
    confetti: true,
  },
};

// Auto-dismiss timeout AFTER the ticker finishes — prevents a stuck
// celebration if the player puts the phone down.
const AUTO_DISMISS_AFTER_TICKER_MS = 4500;

export function PbCelebration({
  game,
  score,
  detail,
  rank,
  total,
  bonus,
  tier,
  onDismiss,
}: Props) {
  const cfg = TIER_CONFIG[tier];

  // ---- Score ticker ----------------------------------------------------
  const [tickerValue, setTickerValue] = useState(0);
  const [tickerDone, setTickerDone] = useState(false);

  useEffect(() => {
    let raf: number | null = null;
    const startedAt = Date.now();
    const isFloat = !Number.isInteger(score);

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const t = Math.min(1, elapsed / cfg.tickerMs);
      // Ease-out so the ticker decelerates as it lands — feels
      // satisfying instead of mechanical.
      const eased = 1 - Math.pow(1 - t, 3);
      const v = score * eased;
      setTickerValue(isFloat ? Number(v.toFixed(2)) : Math.floor(v));
      if (t >= 1) {
        setTickerValue(score);
        setTickerDone(true);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [score, cfg.tickerMs]);

  // ---- Banner fade-in --------------------------------------------------
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerScale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(bannerScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    // Celebratory chiptune fanfare on PB / top-10 / world-record.
    // Single sound for all three tiers — the visual + haptic intensity
    // already encodes the tier difference.
    playSfx('pb');
  }, [bannerOpacity, bannerScale]);

  // ---- Starburst rays --------------------------------------------------
  const rayProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rayProgress, {
      toValue: 1,
      duration: cfg.tickerMs + 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [cfg.tickerMs, rayProgress]);

  // ---- Bonus chip slide-in (after ticker lands) ------------------------
  const chipSlide = useRef(new Animated.Value(40)).current;
  const chipOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!tickerDone) return;
    Animated.parallel([
      Animated.timing(chipSlide, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(chipOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tickerDone, chipSlide, chipOpacity]);

  // ---- Auto-dismiss safety net -----------------------------------------
  useEffect(() => {
    if (!tickerDone) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_AFTER_TICKER_MS);
    return () => clearTimeout(id);
  }, [tickerDone, onDismiss]);

  // Player can tap to dismiss only after ticker finishes, so they get
  // the full reward animation regardless of how trigger-happy they are.
  const handleTap = () => {
    if (tickerDone) onDismiss();
  };

  const formatted = formatScore(score, game, detail, tickerValue);

  return (
    <Pressable
      onPress={handleTap}
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(8,8,15,0.92)' },
        ]}
      />

      {/* Starburst — sits behind everything, anchored at center */}
      <Starburst
        progress={rayProgress}
        color={cfg.color}
        rayCount={cfg.rayCount}
        rayLength={cfg.rayLength}
      />

      {/* Confetti rain — only top1 */}
      {cfg.confetti ? <ConfettiRain color={cfg.color} /> : null}

      {/* Center column */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        }}
      >
        <Animated.View
          style={{
            opacity: bannerOpacity,
            transform: [{ scale: bannerScale }],
            alignItems: 'center',
          }}
        >
          <Blink intervalMs={tier === 'top1' ? 280 : 500} minOpacity={0.55}>
            <ArcadeText
              variant="pixel"
              size={tier === 'top1' ? 18 : 15}
              color={cfg.color}
              glowColor={cfg.color}
              glowRadius={tier === 'top1' ? 18 : 12}
              align="center"
            >
              {cfg.banner}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {game.name}
          </ArcadeText>
        </Animated.View>

        <View style={{ height: spacing.lg }} />

        {/* Score ticker */}
        <ArcadeText
          variant="mono"
          size={game.formatScore ? 52 : 68}
          color={cfg.color}
          glowColor={cfg.color}
          glowRadius={20}
          align="center"
        >
          {formatted}
        </ArcadeText>
        <ArcadeText variant="pixel" size={10} color={colors.textDim}>
          {game.unit}
        </ArcadeText>

        <View style={{ height: spacing.md }} />

        {/* Rank badge */}
        <ArcadeText variant="pixel" size={9} color={colors.textMute}>
          {`RANK #${rank.toLocaleString()} OF ${total.toLocaleString()}`}
        </ArcadeText>

        <View style={{ height: spacing.lg }} />

        {/* +TOKENS chip — slides in once the ticker lands */}
        <Animated.View
          style={{
            opacity: chipOpacity,
            transform: [{ translateY: chipSlide }],
          }}
        >
          <NeonFrame
            color={cfg.color}
            thickness={2}
            padding={spacing.sm}
            glow
            fill={colors.bgSurface}
          >
            <ArcadeText
              variant="pixel"
              size={14}
              color={cfg.color}
              glowColor={cfg.color}
              align="center"
            >
              {`+${bonus} CREDITS  ★`}
            </ArcadeText>
          </NeonFrame>
        </Animated.View>

        <View style={{ height: spacing.huge }} />

        {/* Continue prompt — only after ticker finishes */}
        {tickerDone ? (
          <Blink intervalMs={650}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'TAP TO CONTINUE'}
            </ArcadeText>
          </Blink>
        ) : null}
      </View>
    </Pressable>
  );
}

// Number formatter that mirrors the cabinet's normal formatScore but
// animates by interpolating the *raw* numeric value during the ticker.
// For compound scores (Minesweep, Tilt Maze) we still want the final
// value to render as "L4 · 23" — so once the ticker lands we hand the
// real score back to game.formatScore.
function formatScore(
  finalScore: number,
  game: Game,
  detail: { level?: number; taps?: number } | undefined,
  tickerValue: number,
): string {
  // Compound formatScore games can't sensibly tick — the level/taps
  // composition is stored in `detail` not in the score number — so we
  // just blink between the ticker number and final composition.
  if (game.formatScore && tickerValue >= finalScore) {
    return game.formatScore(finalScore, detail);
  }
  if (game.formatScore) {
    // During the ticker show the raw bare integer climbing — visually
    // satisfying even if it doesn't match the final compound display.
    return Math.floor(tickerValue).toLocaleString();
  }
  if (Number.isInteger(finalScore)) return Math.floor(tickerValue).toLocaleString();
  return tickerValue.toFixed(2);
}

// ----------------------------------------------------------------------
// Starburst — N evenly-spaced rays from center that extend + fade.
// ----------------------------------------------------------------------
function Starburst({
  progress,
  color,
  rayCount,
  rayLength,
}: {
  progress: Animated.Value;
  color: string;
  rayCount: number;
  rayLength: number;
}) {
  // Native-driver-friendly: animate scaleX of a fixed-length ray instead
  // of width. Rays anchor at center via transformOrigin so they extend
  // outward as scale grows from 0 → 1.
  const scaleAnim = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const opacityAnim = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 1, 0.15],
  });

  const rays = Array.from({ length: rayCount }, (_, i) => {
    const angle = (i / rayCount) * Math.PI * 2;
    return { angle, key: i };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center', opacity: opacityAnim },
      ]}
    >
      <View
        style={{
          width: rayLength * 2.2,
          height: rayLength * 2.2,
        }}
      >
        {rays.map(({ angle, key }) => (
          <Animated.View
            key={key}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              marginTop: -1,
              width: rayLength,
              height: 2,
              backgroundColor: color,
              transformOrigin: '0% 50%',
              transform: [
                { rotate: `${(angle * 180) / Math.PI}deg` },
                { scaleX: scaleAnim },
              ],
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ----------------------------------------------------------------------
// Confetti rain — top1 tier only. 18 little squares fall + drift + spin.
// ----------------------------------------------------------------------
function ConfettiRain({ color }: { color: string }) {
  const pieces = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      key: i,
      startX: Math.random() * SCREEN_W,
      drift: (Math.random() - 0.5) * 60,
      delay: Math.random() * 600,
      duration: 1800 + Math.random() * 1400,
      hue: i % 3 === 0 ? color : i % 3 === 1 ? neon('cyan') : neon('yellow'),
      size: 6 + Math.random() * 4,
      progress: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    pieces.forEach((p) => {
      Animated.timing(p.progress, {
        toValue: 1,
        delay: p.delay,
        duration: p.duration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => {
        const translateY = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-30, SCREEN_H + 40],
        });
        const translateX = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
        });
        const rotate = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${720 + Math.random() * 360}deg`],
        });
        return (
          <Animated.View
            key={p.key}
            style={{
              position: 'absolute',
              left: p.startX,
              top: 0,
              width: p.size,
              height: p.size,
              backgroundColor: p.hue,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

