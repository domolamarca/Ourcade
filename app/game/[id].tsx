// Pre-game splash. Description, your best, top 5, blinking PRESS START.
// "Start" lands on the result screen for now since no games are wired up yet
// — that placeholder lets us exercise the result/initials-entry screen too.

import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { GameIcon } from '../../src/components/GameIcon';
import { HighScoreRow } from '../../src/components/HighScoreRow';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { getGame } from '../../src/data/games';
import { getPlayerBest, getTopScores } from '../../src/data/leaderboard';
import { colors, neon, spacing } from '../../src/theme';

export default function PreGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = id ? getGame(id) : undefined;

  if (!game) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl }}>
        <ArcadeText variant="pixel" size={14} color={neon('red')} align="center">
          {'GAME NOT FOUND'}
        </ArcadeText>
      </View>
    );
  }

  const accent = neon(game.accentColor);
  const best = getPlayerBest(game.id);
  const top = getTopScores(game.id, 'all', 5);
  const worldRecord = top[0];

  // Real games route to /play/<id>. Anything not yet built falls back to a
  // randomized placeholder result so the UI flow stays exercisable.
  const startGame = () => {
    if (game.id === 'tap-bullseye') {
      router.push('/play/tap-bullseye');
      return;
    }
    if (game.id === 'minesweep') {
      router.push('/play/minesweep');
      return;
    }
    if (game.id === 'ghost') {
      router.push('/play/ghost');
      return;
    }
    const fakeScore = randomScore(game.id);
    router.push({
      pathname: '/result/[id]',
      params: { id: game.id, score: String(fakeScore) },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        {/* Back arrow */}
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'<<  BACK'}
          </ArcadeText>
        </Pressable>

        {/* Title block */}
        <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
          <GameIcon id={game.id} size={96} color={accent} />
          <View style={{ height: spacing.md }} />
          <ArcadeText variant="pixel" size={18} color={accent} glowColor={accent} align="center">
            {game.name}
          </ArcadeText>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="mono" size={18} color={colors.textDim} align="center">
            {game.tagline}
          </ArcadeText>
        </View>

        {/* Description */}
        <NeonFrame color={colors.border} thickness={1} glow={false} padding={spacing.md}>
          <ArcadeText variant="mono" size={18} color={colors.text}>
            {game.description}
          </ArcadeText>
          <View style={{ height: spacing.sm }} />
          {game.rules.map((rule, i) => (
            <View key={i} style={{ flexDirection: 'row', marginTop: 4 }}>
              <ArcadeText variant="pixel" size={9} color={accent}>
                {'> '}
              </ArcadeText>
              <ArcadeText variant="mono" size={16} color={colors.textDim} style={{ flex: 1 }}>
                {rule}
              </ArcadeText>
            </View>
          ))}
        </NeonFrame>

        {/* Score callouts */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <ScoreCallout
            label="YOUR BEST"
            value={best ? formatVal(best.score, game.unit) : '—'}
            color={neon('cyan')}
          />
          <ScoreCallout
            label="WORLD RECORD"
            value={worldRecord ? formatVal(worldRecord.score, game.unit) : '—'}
            sub={worldRecord ? `BY ${worldRecord.initials}` : ''}
            color={neon('yellow')}
          />
        </View>

        {/* Top 5 mini-board */}
        <View style={{ marginTop: spacing.lg }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'>> TOP 5'}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />
          <NeonFrame color={accent} thickness={1} glow={false} padding={0}>
            {top.length === 0 ? (
              <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                <ArcadeText variant="pixel" size={9} color={colors.textMute}>
                  {'BE THE FIRST'}
                </ArcadeText>
              </View>
            ) : (
              top.map((s, i) => <HighScoreRow key={s.id} rank={i + 1} score={s} />)
            )}
          </NeonFrame>
        </View>

        {/* PRESS START */}
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Pressable onPress={startGame} disabled={game.status !== 'live'}>
            <NeonFrame
              color={game.status === 'live' ? accent : colors.border}
              thickness={3}
              padding={spacing.lg}
              fill={colors.bgSurface}
            >
              {game.status === 'live' ? (
                <Blink intervalMs={500}>
                  <ArcadeText variant="pixel" size={18} color={accent} glowColor={accent}>
                    {'PRESS  START'}
                  </ArcadeText>
                </Blink>
              ) : (
                <ArcadeText variant="pixel" size={14} color={colors.textMute}>
                  {'COMING SOON'}
                </ArcadeText>
              )}
            </NeonFrame>
          </Pressable>
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>
            {'1 CREDIT  PER PLAY'}
          </ArcadeText>
        </View>
      </ScrollView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}

function ScoreCallout({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <NeonFrame color={color} thickness={1} glow padding={spacing.md} style={{ flex: 1 }}>
      <ArcadeText variant="pixel" size={7} color={colors.textMute}>
        {label}
      </ArcadeText>
      <View style={{ height: 4 }} />
      <ArcadeText variant="mono" size={22} color={color}>
        {value}
      </ArcadeText>
      {sub ? (
        <ArcadeText variant="pixel" size={7} color={colors.textMute} style={{ marginTop: 4 }}>
          {sub}
        </ArcadeText>
      ) : null}
    </NeonFrame>
  );
}

function formatVal(n: number, unit: string) {
  const value = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
  return `${value} ${unit}`;
}

function randomScore(gameId: string): number {
  // Throwaway: emulate a play so the result screen has something to show.
  switch (gameId) {
    case 'reaction-light':
      return Math.round(180 + Math.random() * 120);
    case 'spin-360':
      return Math.round((Math.random() * 12) * 10) / 10;
    case 'dead-still':
      return Math.round(4000 + Math.random() * 5000);
    default:
      return Math.round(5000 + Math.random() * 4999);
  }
}
