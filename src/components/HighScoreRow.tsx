import React from 'react';
import { View } from 'react-native';
import { ArcadeText } from './ArcadeText';
import { colors, neon, spacing } from '../theme';
import { Score } from '../data/leaderboard';
import { gamesById } from '../data/games';

type Props = {
  rank: number;
  score: Score;
  highlight?: boolean;
};

const RANK_COLORS = ['yellow', 'cyan', 'orange'] as const;

export function HighScoreRow({ rank, score, highlight }: Props) {
  const game = gamesById[score.gameId];
  const accent = game ? neon(game.accentColor) : colors.text;
  const rankColor = rank <= 3 ? neon(RANK_COLORS[rank - 1]) : colors.textDim;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: highlight ? colors.bgElevated : 'transparent',
      }}
    >
      {/* Rank */}
      <View style={{ width: 36, alignItems: 'flex-start' }}>
        <ArcadeText variant="pixel" size={12} color={rankColor} glowColor={rank <= 3 ? rankColor : undefined}>
          {String(rank).padStart(2, '0')}
        </ArcadeText>
      </View>

      {/* Initials */}
      <View style={{ width: 56 }}>
        <ArcadeText variant="pixel" size={14} color={colors.text}>
          {score.initials}
        </ArcadeText>
      </View>

      {/* Game */}
      <View style={{ flex: 1 }}>
        <ArcadeText variant="pixel" size={8} color={accent}>
          {game?.shortName ?? score.gameId.toUpperCase()}
        </ArcadeText>
      </View>

      {/* Score */}
      <View style={{ alignItems: 'flex-end' }}>
        <ArcadeText variant="mono" size={18} color={accent}>
          {game?.formatScore
            ? game.formatScore(score.score, { level: score.level, taps: score.taps })
            : formatScoreDisplay(score.score)}
        </ArcadeText>
        <ArcadeText variant="pixel" size={7} color={colors.textMute}>
          {score.unit}
        </ArcadeText>
      </View>
    </View>
  );
}

function formatScoreDisplay(n: number) {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export default HighScoreRow;
