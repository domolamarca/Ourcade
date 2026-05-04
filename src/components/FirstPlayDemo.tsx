// First-play tutorial overlay.
//
// Shown over the pre-game screen the first time a player visits a
// cabinet they've never played before. Reinforces the onboarding so
// new users actually understand what they're about to spend a token
// on, instead of pressing START and immediately busting out.
//
// Layout (full screen):
//
//   FIRST PLAY chip (header)
//   Pulsing cabinet icon
//   Cabinet name + tagline
//   "HOW TO PLAY" rules in big readable type
//   GOT IT — INSERT COIN  (dismisses + persists seenTutorials[id]=true)
//
// Once dismissed, calling markTutorialSeen(gameId) on the player hook
// flips the persistent flag and the overlay never shows again for
// this cabinet on this device.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from './ArcadeText';
import { Blink } from './Blink';
import { GameIcon } from './GameIcon';
import { NeonFrame } from './NeonFrame';
import { ScanlineOverlay } from './ScanlineOverlay';
import { Game, SKILL_COLORS } from '../data/games';
import { colors, neon, spacing } from '../theme';

type Props = {
  game: Game;
  onDismiss: () => void;
};

export function FirstPlayDemo({ game, onDismiss }: Props) {
  const accent = neon(game.accentColor);
  const skillColor = neon(SKILL_COLORS[game.skill]);

  // Icon pulses gently — reinforces the cabinet's identity and gives
  // the otherwise-static overlay a heartbeat.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 720,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  // Header chip fades in on mount so the screen doesn't pop hard.
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
    Haptics.selectionAsync().catch(() => {});
  }, [opacity]);

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDismiss();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: colors.bg,
        opacity,
      }}
    >
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.huge,
            alignItems: 'center',
          }}
        >
          {/* Header chip */}
          <View
            style={{
              borderWidth: 1,
              borderColor: skillColor,
              paddingHorizontal: spacing.md,
              paddingVertical: 4,
              marginTop: spacing.sm,
            }}
          >
            <Blink intervalMs={550} minOpacity={0.55}>
              <ArcadeText
                variant="pixel"
                size={9}
                color={skillColor}
                glowColor={skillColor}
              >
                {'★ FIRST PLAY ★'}
              </ArcadeText>
            </Blink>
          </View>

          <View style={{ height: spacing.lg }} />

          {/* Pulsing icon — the cabinet's visual signature */}
          <Animated.View
            style={{
              transform: [{ scale: pulse }],
              alignItems: 'center',
              justifyContent: 'center',
              width: 120,
              height: 120,
              borderWidth: 2,
              borderColor: accent,
            }}
          >
            <GameIcon id={game.id} size={88} color={accent} />
          </Animated.View>

          <View style={{ height: spacing.lg }} />

          {/* Cabinet name + tagline */}
          <ArcadeText
            variant="pixel"
            size={22}
            color={accent}
            glowColor={accent}
            glowRadius={14}
            align="center"
          >
            {game.name}
          </ArcadeText>
          <View style={{ height: spacing.sm }} />
          <ArcadeText
            variant="mono"
            size={15}
            color={colors.textDim}
            align="center"
          >
            {game.tagline}
          </ArcadeText>

          <View style={{ height: spacing.xl }} />

          {/* Rules — big and readable, all rules shown (not the 4 the
              compact pre-game limits to). The wrapping View forces
              full-width inside the center-aligned ScrollView so each
              rule line has room to breathe. */}
          <View style={{ alignSelf: 'stretch' }}>
            <NeonFrame
              color={skillColor}
              thickness={2}
              glow
              padding={spacing.md}
              fill={colors.bgSurface}
            >
              <ArcadeText
                variant="pixel"
                size={10}
                color={skillColor}
                glowColor={skillColor}
                align="center"
              >
                {'HOW TO PLAY'}
              </ArcadeText>
              <View style={{ height: spacing.sm }} />
              {game.rules.map((rule, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginVertical: 4,
                  }}
                >
                  <ArcadeText
                    variant="pixel"
                    size={10}
                    color={accent}
                    style={{ marginRight: 8 }}
                  >
                    {'>'}
                  </ArcadeText>
                  <ArcadeText
                    variant="mono"
                    size={15}
                    color={colors.text}
                    style={{ flex: 1 }}
                  >
                    {rule}
                  </ArcadeText>
                </View>
              ))}
            </NeonFrame>
          </View>

          <View style={{ height: spacing.xl }} />

          {/* GOT IT button — dismisses and reveals the standard pre-game
              screen below. Player still has to press START to spend a
              token; this just acknowledges they read the rules. */}
          <Pressable onPress={handleDismiss} style={{ alignSelf: 'stretch' }}>
            <NeonFrame
              color={accent}
              thickness={3}
              padding={spacing.md}
              glow
              fill={colors.bgSurface}
            >
              <ArcadeText
                variant="pixel"
                size={14}
                color={accent}
                glowColor={accent}
                align="center"
              >
                {'GOT IT  ▶'}
              </ArcadeText>
              <View style={{ height: 4 }} />
              <ArcadeText
                variant="pixel"
                size={8}
                color={colors.textMute}
                align="center"
              >
                {'TAP TO CONTINUE'}
              </ArcadeText>
            </NeonFrame>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <ScanlineOverlay opacity={0.05} />
    </Animated.View>
  );
}
