// Lobby — the arcade floor. Grid of cabinets, marquee on top.

import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { GameCabinetCard } from '../../src/components/GameCabinetCard';
import { Marquee } from '../../src/components/Marquee';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { games } from '../../src/data/games';
import { getPlayerBest } from '../../src/data/leaderboard';
import { usePlayer } from '../../src/data/player';
import { colors, neon, spacing } from '../../src/theme';

export default function HomeScreen() {
  const player = usePlayer();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        {/* Brand strip — small wordmark above the marquee. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'center',
            paddingTop: spacing.xs,
            paddingBottom: spacing.xs,
          }}
        >
          <ArcadeText
            variant="pixel"
            size={11}
            color={neon('cyan')}
            glowColor={neon('cyan')}
          >
            {'OUR'}
          </ArcadeText>
          <ArcadeText
            variant="pixel"
            size={11}
            color={neon('magenta')}
            glowColor={neon('magenta')}
          >
            {'CADE'}
          </ArcadeText>
        </View>
        <Marquee
          text="★ TONIGHT'S CHALLENGE: SILENCE ★ HOW QUIET CAN YOU GET? ★ DAILY RESET 00:00 UTC ★"
          color={neon('green')}
          glowColor={neon('green')}
          size={9}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        {/* Header row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: spacing.lg,
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'>> SELECT GAME'}
            </ArcadeText>
            <View style={{ height: 4 }} />
            <ArcadeText
              variant="pixel"
              size={18}
              color={neon('magenta')}
              glowColor={neon('magenta')}
            >
              {'MAIN MENU'}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'CREDITS'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={neon('yellow')}>
              {String(player.coins).padStart(2, '0')}
            </ArcadeText>
          </View>
        </View>

        {/* Grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
          }}
        >
          {games.map((game) => {
            const best = getPlayerBest(game.id);
            return (
              <View key={game.id} style={{ width: '47%' }}>
                <GameCabinetCard
                  game={game}
                  bestScore={best?.score ?? null}
                  onPress={() => router.push(`/game/${game.id}`)}
                />
              </View>
            );
          })}
        </View>

        <View style={{ height: spacing.xl }} />
        <ArcadeText
          variant="pixel"
          size={8}
          color={colors.textMute}
          align="center"
        >
          {'MORE CABINETS COMING SOON >>'}
        </ArcadeText>
      </ScrollView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}
