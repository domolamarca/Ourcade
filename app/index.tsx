// Title / "INSERT COIN" screen — the front of the cabinet.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../src/components/ArcadeText';
import { Blink } from '../src/components/Blink';
import { ScanlineOverlay } from '../src/components/ScanlineOverlay';
import { usePlayer } from '../src/data/player';
import { colors, neon, spacing } from '../src/theme';

export default function TitleScreen() {
  const player = usePlayer();
  // First-launch players get routed through the initials picker.
  // Existing players land directly on the lobby.
  const enter = () => {
    if (player.needsInitialsSetup) {
      router.replace('/onboarding/initials');
    } else {
      router.replace('/home');
    }
  };

  return (
    <Pressable style={{ flex: 1, backgroundColor: colors.bg }} onPress={enter}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', marginTop: spacing.huge }}>
          {/* Tagline badge */}
          <Blink intervalMs={420} minOpacity={0.5}>
            <ArcadeText
              variant="pixel"
              size={10}
              color={neon('green')}
              glowColor={neon('green')}
              align="center"
            >
              {'★ READY  PLAYER  ALL ★'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.lg }} />

          {/* Wordmark — OUR cyan + CADE magenta, side by side. The split
              colors make the portmanteau (OUR + arCADE) read at a glance. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'center',
            }}
          >
            <ArcadeText
              variant="pixel"
              size={42}
              color={neon('cyan')}
              glowColor={neon('cyan')}
              glowRadius={18}
            >
              {'OUR'}
            </ArcadeText>
            <ArcadeText
              variant="pixel"
              size={42}
              color={neon('magenta')}
              glowColor={neon('magenta')}
              glowRadius={18}
            >
              {'CADE'}
            </ArcadeText>
          </View>
          <View style={{ height: spacing.lg }} />
          <ArcadeText variant="mono" size={20} color={colors.textDim} align="center">
            {"every game ours. every record yours."}
          </ArcadeText>
        </View>

        {/* Cabinet middle — empty by design, gives the eye a break */}
        <View style={{ alignItems: 'center', gap: spacing.xl }}>
          <ArcadeText variant="pixel" size={10} color={neon('green')}>
            {'>>  2026  OURCADE INC.'}
          </ArcadeText>
          <ArcadeText variant="pixel" size={10} color={colors.textMute}>
            {'CREDITS  99'}
          </ArcadeText>
        </View>

        <View style={{ alignItems: 'center', marginBottom: spacing.huge }}>
          <Blink intervalMs={500}>
            <ArcadeText
              variant="pixel"
              size={14}
              color={neon('yellow')}
              glowColor={neon('yellow')}
              align="center"
            >
              {'PRESS  ANYWHERE'}
            </ArcadeText>
          </Blink>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute} align="center">
            {'TO START'}
          </ArcadeText>
        </View>
      </SafeAreaView>

      <ScanlineOverlay opacity={0.06} />
    </Pressable>
  );
}
