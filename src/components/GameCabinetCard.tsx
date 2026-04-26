import React from 'react';
import { Pressable, View } from 'react-native';
import { Game } from '../data/games';
import { colors, neon, spacing } from '../theme';
import { ArcadeText } from './ArcadeText';
import { GameIcon } from './GameIcon';
import { NeonFrame } from './NeonFrame';

type Props = {
  game: Game;
  /** Player's best raw score (in the game's score units). */
  bestScore?: number | null;
  /** Player's leaderboard placement: 1-based rank + total entries. */
  rank?: { rank: number; total: number } | null;
  /** Detail to feed to game.formatScore (e.g. level/taps for compound scores). */
  scoreDetail?: { level?: number; taps?: number };
  onPress?: () => void;
  /** Today's daily-challenge cabinet — gets a FREE TODAY badge. */
  freeToday?: boolean;
  /** Layout variant — 'wide' lays the icon on the left, score on the right. */
  variant?: 'standard' | 'wide';
};

/**
 * An arcade-cabinet-shaped tile: marquee header, sprite zone, score readout.
 * Color-coded by game.accentColor. The 'wide' variant is used by the daily
 * challenge feature card on the lobby.
 *
 * The score readout leads with the player's RANK (bigger, bolder, accented)
 * and shows their high score below as a subtler line. Players chase the
 * leaderboard, not raw numbers — so the rank is the headline stat.
 */
export function GameCabinetCard({
  game,
  bestScore,
  rank,
  scoreDetail,
  onPress,
  freeToday = false,
  variant = 'standard',
}: Props) {
  const accent = neon(game.accentColor);
  const isLocked = game.status !== 'live';
  const wide = variant === 'wide';

  const rankLabel =
    !isLocked && rank ? `#${rank.rank.toLocaleString()}` : null;
  const scoreLine = formatBestLine(game, bestScore, scoreDetail);

  return (
    <Pressable
      onPress={onPress}
      disabled={isLocked}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : isLocked ? 0.45 : 1,
        flex: 1,
      })}
    >
      <NeonFrame
        color={freeToday ? neon('green') : accent}
        thickness={2}
        padding={0}
        fill={colors.bgSurface}
        glow={freeToday}
      >
        {/* Cabinet "marquee" header */}
        <View
          style={{
            backgroundColor: freeToday ? neon('green') : accent,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <ArcadeText variant="pixel" size={9} color={colors.bg}>
            {game.shortName}
          </ArcadeText>
          {freeToday ? (
            <ArcadeText variant="pixel" size={8} color={colors.bg}>
              {'★ FREE TODAY ★'}
            </ArcadeText>
          ) : null}
        </View>

        {wide ? (
          // Wide layout — icon left, score right, full width.
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bg,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              gap: spacing.md,
            }}
          >
            <GameIcon id={game.id} size={64} color={accent} />
            <View style={{ flex: 1 }}>
              <ArcadeText variant="pixel" size={11} color={accent} glowColor={accent}>
                {game.name}
              </ArcadeText>
              <View style={{ height: 4 }} />
              <ArcadeText variant="mono" size={13} color={colors.textDim}>
                {game.tagline}
              </ArcadeText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'RANK'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={26}
                color={rankLabel ? accent : colors.textDim}
                glowColor={rankLabel ? accent : undefined}
              >
                {rankLabel ?? '—'}
              </ArcadeText>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {scoreLine}
              </ArcadeText>
            </View>
          </View>
        ) : (
          <>
            {/* Sprite slot */}
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

            {/* Score readout — RANK is the headline, score line is the footnote. */}
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
                {isLocked ? 'COMING SOON' : 'RANK'}
              </ArcadeText>
              <View style={{ height: 2 }} />
              <ArcadeText
                variant="mono"
                size={22}
                color={isLocked ? colors.textDim : rankLabel ? accent : colors.textDim}
                glowColor={!isLocked && rankLabel ? accent : undefined}
              >
                {isLocked ? '— — —' : rankLabel ?? 'UNRANKED'}
              </ArcadeText>
              <View style={{ height: 2 }} />
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {isLocked ? '' : scoreLine}
              </ArcadeText>
            </View>
          </>
        )}
      </NeonFrame>
    </Pressable>
  );
}

function formatBestLine(
  game: Game,
  bestScore: number | null | undefined,
  detail?: { level?: number; taps?: number },
): string {
  if (bestScore == null) return 'NO SCORE YET';
  const formatter = game.formatScore;
  const display = formatter
    ? formatter(bestScore, detail)
    : Number.isInteger(bestScore)
      ? bestScore.toLocaleString()
      : bestScore.toFixed(2);
  return `BEST ${display} ${game.unit}`;
}

export default GameCabinetCard;
