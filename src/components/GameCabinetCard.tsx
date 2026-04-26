import React from 'react';
import { Pressable, View } from 'react-native';
import { Game } from '../data/games';
import { colors, neon, spacing } from '../theme';
import { ArcadeText } from './ArcadeText';
import { GameIcon } from './GameIcon';
import { NeonFrame } from './NeonFrame';

type Props = {
  game: Game;
  bestScore?: number | null;
  onPress?: () => void;
};

/**
 * An arcade-cabinet-shaped tile: marquee header, sprite zone, score readout.
 * Color-coded by game.accentColor.
 */
export function GameCabinetCard({ game, bestScore, onPress }: Props) {
  const accent = neon(game.accentColor);
  const isLocked = game.status !== 'live';

  return (
    <Pressable
      onPress={onPress}
      disabled={isLocked}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : isLocked ? 0.45 : 1,
        flex: 1,
      })}
    >
      <NeonFrame color={accent} thickness={2} padding={0} fill={colors.bgSurface}>
        {/* Cabinet "marquee" header */}
        <View
          style={{
            backgroundColor: accent,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
          }}
        >
          <ArcadeText variant="pixel" size={9} color={colors.bg} align="center">
            {game.shortName}
          </ArcadeText>
        </View>

        {/* Sprite slot — SVG icon, swap to real pixel art later. */}
        <View
          style={{
            height: 90,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.bg,
          }}
        >
          <GameIcon id={game.id} size={48} color={accent} />
        </View>

        {/* Score readout */}
        <View
          style={{
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            borderTopWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>
            {isLocked ? 'COMING SOON' : `${game.scoreLabel}`}
          </ArcadeText>
          <View style={{ height: 2 }} />
          <ArcadeText variant="mono" size={20} color={isLocked ? colors.textDim : accent}>
            {isLocked
              ? '— — —'
              : bestScore == null
                ? `0 ${game.unit}`
                : `${formatScore(bestScore)} ${game.unit}`}
          </ArcadeText>
        </View>
      </NeonFrame>
    </Pressable>
  );
}

function formatScore(n: number) {
  if (Math.abs(n) >= 10000) return n.toFixed(0);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export default GameCabinetCard;
