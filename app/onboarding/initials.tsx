// First-launch initials prompt.
//
// Shown once, before the player ever sees the lobby. Records their
// chosen 3-letter handle in the persistent player store, then routes
// to /home. After this, every score they submit lands on the
// leaderboard with these initials.
//
// Re-run path: if a player wants to change their initials later, we'll
// expose a "rename" flow from a profile screen (post-launch nice-to-
// have). For v1 the only entry point is this screen.

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InitialsEntry } from '../../src/components/InitialsEntry';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { usePlayer } from '../../src/data/player';
import { colors, neon, spacing } from '../../src/theme';

export default function OnboardingInitials() {
  const player = usePlayer();
  const [initials, setInitials] = useState('AAA');

  function confirm() {
    // Mark initials chosen — flips the gate that home/index uses to
    // detect first-launch.
    player.setInitials(initials, true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/home');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
          <ArcadeText
            variant="pixel"
            size={11}
            color={neon('cyan')}
            glowColor={neon('cyan')}
            align="center"
          >
            {'★ READY  PLAYER ★'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />
          <ArcadeText
            variant="pixel"
            size={20}
            color={neon('magenta')}
            glowColor={neon('magenta')}
            glowRadius={14}
            align="center"
          >
            {'PICK  YOUR\nINITIALS'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />
          <ArcadeText
            variant="mono"
            size={15}
            color={colors.textDim}
            align="center"
            style={{ paddingHorizontal: spacing.lg }}
          >
            {'YOUR HIGH SCORES POST\nUNDER THESE 3 LETTERS.'}
          </ArcadeText>
        </View>

        <View style={{ alignItems: 'center' }}>
          <InitialsEntry initial="AAA" onChange={setInitials} />
        </View>

        <View style={{ alignItems: 'center', marginBottom: spacing.huge }}>
          <Pressable onPress={confirm}>
            <NeonFrame
              color={neon('green')}
              thickness={3}
              padding={spacing.lg}
              glow
            >
              <Blink intervalMs={520} minOpacity={0.5}>
                <ArcadeText
                  variant="pixel"
                  size={14}
                  color={neon('green')}
                  glowColor={neon('green')}
                >
                  {`LOCK IN — ${initials}`}
                </ArcadeText>
              </Blink>
            </NeonFrame>
          </Pressable>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={7} color={colors.textMute} align="center">
            {'(YOU CAN CHANGE THIS LATER)'}
          </ArcadeText>
        </View>
      </SafeAreaView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}
