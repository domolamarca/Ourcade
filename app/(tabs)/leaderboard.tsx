// Hall of Fame. Tabbed by timeframe. Per-game ranking — pick the cabinet
// from a horizontal pill row at the top.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { HighScoreRow } from '../../src/components/HighScoreRow';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { games } from '../../src/data/games';
import { getTopScores, Timeframe } from '../../src/data/leaderboard';
import { colors, neon, spacing } from '../../src/theme';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'WEEK' },
  { key: 'all', label: 'ALL TIME' },
];

export default function LeaderboardScreen() {
  const liveGames = useMemo(() => games.filter((g) => g.status === 'live'), []);
  const [gameId, setGameId] = useState<string>(liveGames[0]?.id ?? games[0].id);
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  const scores = getTopScores(gameId, timeframe, 25);
  const activeGame = games.find((g) => g.id === gameId);
  const accent = activeGame ? neon(activeGame.accentColor) : neon('yellow');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'>> HIGH SCORE TABLE'}
          </ArcadeText>
          <View style={{ height: 2 }} />
          <ArcadeText
            variant="pixel"
            size={18}
            color={neon('yellow')}
            glowColor={neon('yellow')}
          >
            {'HALL OF FAME'}
          </ArcadeText>
        </View>
      </SafeAreaView>

      {/* Timeframe pills */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
          paddingBottom: spacing.xs,
        }}
      >
        {TIMEFRAMES.map((t) => {
          const active = t.key === timeframe;
          return (
            <Pressable key={t.key} onPress={() => setTimeframe(t.key)}>
              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderWidth: 1,
                  borderColor: active ? neon('yellow') : colors.border,
                  backgroundColor: active ? colors.bgElevated : 'transparent',
                }}
              >
                <ArcadeText
                  variant="pixel"
                  size={8}
                  color={active ? neon('yellow') : colors.textDim}
                >
                  {t.label}
                </ArcadeText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Game selector pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
          alignItems: 'center',
        }}
        style={{ maxHeight: 36, flexGrow: 0 }}
      >
        {games.map((g) => {
          const active = g.id === gameId;
          const isLocked = g.status !== 'live';
          const c = neon(g.accentColor);
          return (
            <Pressable
              key={g.id}
              disabled={isLocked}
              onPress={() => setGameId(g.id)}
              style={{ opacity: isLocked ? 0.4 : 1 }}
            >
              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? c : colors.border,
                  backgroundColor: active ? colors.bgElevated : 'transparent',
                }}
              >
                <ArcadeText
                  variant="pixel"
                  size={8}
                  color={active ? c : colors.textDim}
                  glowColor={active ? c : undefined}
                >
                  {g.shortName}
                </ArcadeText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Column header — sits flush against the pills */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
          borderBottomWidth: 2,
          borderColor: accent,
        }}
      >
        <View style={{ width: 36 }}>
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>{'#'}</ArcadeText>
        </View>
        <View style={{ width: 56 }}>
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>{'NAME'}</ArcadeText>
        </View>
        <View style={{ flex: 1 }}>
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>{'GAME'}</ArcadeText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>{'SCORE'}</ArcadeText>
        </View>
      </View>

      {/* Ranking list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.huge }}
      >
        {scores.length === 0 ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ArcadeText variant="pixel" size={10} color={colors.textMute}>
              {'NO SCORES YET'}
            </ArcadeText>
            <View style={{ height: 6 }} />
            <ArcadeText variant="pixel" size={8} color={colors.textMute}>
              {'BE THE FIRST'}
            </ArcadeText>
          </View>
        ) : (
          scores.map((s, i) => (
            <HighScoreRow
              key={s.id}
              rank={i + 1}
              score={s}
              highlight={s.initials === 'DOM'}
            />
          ))
        )}
      </ScrollView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}
