// Result + leaderboard placement.
//
// The just-played score is injected into the leaderboard so we can compute
// the player's rank and show the rows around them, regardless of whether
// they hit #1 or #14,000. Layout:
//
//   verdict header (NEW WORLD RECORD or GAME OVER)
//   score + duration
//   initials entry  (if high score and not yet submitted)
//   "RANK X OF Y"
//   top 5 rows
//   gap separator (if player is below top 5)
//   row above player + player row + row below player
//   action buttons

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { HighScoreRow } from '../../src/components/HighScoreRow';
import { InitialsEntry } from '../../src/components/InitialsEntry';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { getGame } from '../../src/data/games';
import { rankPlayerScore, Score } from '../../src/data/leaderboard';
import { usePlayer } from '../../src/data/player';
import { colors, neon, spacing } from '../../src/theme';

const TOP_ROWS_BEFORE_GAP = 5;

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    id: string;
    score?: string;
    duration?: string;
    level?: string;
    taps?: string;
  }>();
  const game = params.id ? getGame(params.id) : undefined;
  const player = usePlayer();
  const [submitted, setSubmitted] = useState(false);

  const score = Number(params.score ?? 0);
  const duration = params.duration ? Number(params.duration) : null;
  const level = params.level != null ? Number(params.level) : undefined;
  const taps = params.taps != null ? Number(params.taps) : undefined;

  // Inject the player's score and compute rank — done once per render in a
  // memo so the rank doesn't shift if the user fiddles with their initials.
  const placement = useMemo(() => {
    if (!game) return null;
    return rankPlayerScore({
      gameId: game.id,
      initials: player.initials,
      score,
      unit: game.unit,
      level,
      taps,
    });
  }, [game, player.initials, score, level, taps]);

  if (!game || !placement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl }}>
        <ArcadeText variant="pixel" size={14} color={neon('red')} align="center">
          {'GAME NOT FOUND'}
        </ArcadeText>
      </View>
    );
  }

  const accent = neon(game.accentColor);
  const isHigh = placement.playerRank === 1;
  const isTop10 = placement.playerRank <= 10;

  const submit = () => {
    setSubmitted(true);
    // TODO: Supabase write happens here once backend is wired.
  };

  // PLAY AGAIN goes straight back to play for built games (instant retry,
  // arcade-style); falls back to the pre-game card for stubs.
  const playAgain = () => {
    if (game.id === 'tap-bullseye') {
      router.replace('/play/tap-bullseye');
    } else if (game.id === 'minesweep') {
      router.replace('/play/minesweep');
    } else if (game.id === 'ghost') {
      router.replace('/play/ghost');
    } else {
      router.replace({ pathname: '/game/[id]', params: { id: game.id } });
    }
  };

  const displayRows = pickDisplayRows(placement.ranked, placement.playerRank);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        {/* Verdict header */}
        <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
          {isHigh ? (
            <Blink intervalMs={350} minOpacity={0.4}>
              <ArcadeText
                variant="pixel"
                size={20}
                color={neon('yellow')}
                glowColor={neon('yellow')}
                glowRadius={14}
                align="center"
              >
                {'!! NEW WORLD\nRECORD !!'}
              </ArcadeText>
            </Blink>
          ) : (
            <ArcadeText
              variant="pixel"
              size={22}
              color={accent}
              glowColor={accent}
              align="center"
            >
              {'GAME OVER'}
            </ArcadeText>
          )}
          <View style={{ height: spacing.sm }} />
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {game.name}
          </ArcadeText>
        </View>

        {/* Score */}
        <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'YOUR SCORE'}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />
          <ArcadeText
            variant="mono"
            size={game.formatScore ? 48 : 64}
            color={accent}
            glowColor={accent}
            glowRadius={20}
          >
            {game.formatScore
              ? game.formatScore(score, { level, taps })
              : Number.isInteger(score)
                ? score.toLocaleString()
                : score.toFixed(2)}
          </ArcadeText>
          <ArcadeText variant="pixel" size={10} color={colors.textDim}>
            {game.unit}
          </ArcadeText>
          {duration != null ? (
            <View style={{ marginTop: spacing.sm }}>
              <ArcadeText variant="pixel" size={8} color={colors.textMute}>
                {`SURVIVED ${duration.toFixed(1)}s`}
              </ArcadeText>
            </View>
          ) : null}
        </View>

        {/* Initials entry — only shown for the very top score */}
        {isHigh && !submitted ? (
          <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
            <ArcadeText variant="pixel" size={10} color={neon('yellow')}>
              {'ENTER  YOUR  INITIALS'}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <InitialsEntry
              initial={player.initials}
              onChange={(v) => player.setInitials(v)}
            />
            <View style={{ height: spacing.lg }} />
            <Pressable onPress={submit}>
              <NeonFrame color={neon('green')} thickness={2} padding={spacing.md} glow>
                <ArcadeText
                  variant="pixel"
                  size={12}
                  color={neon('green')}
                  glowColor={neon('green')}
                >
                  {'SUBMIT >>'}
                </ArcadeText>
              </NeonFrame>
            </Pressable>
          </View>
        ) : null}

        {/* Rank readout */}
        <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'YOUR RANK'}
          </ArcadeText>
          <View style={{ height: spacing.xs }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <ArcadeText
              variant="mono"
              size={28}
              color={isTop10 ? neon('yellow') : accent}
              glowColor={isTop10 ? neon('yellow') : undefined}
            >
              {`#${placement.playerRank.toLocaleString()}`}
            </ArcadeText>
            <ArcadeText variant="pixel" size={10} color={colors.textDim}>
              {`OF ${placement.total.toLocaleString()}`}
            </ArcadeText>
          </View>
          {submitted ? (
            <View style={{ marginTop: spacing.xs }}>
              <ArcadeText variant="pixel" size={8} color={neon('green')} glowColor={neon('green')}>
                {'SCORE SUBMITTED'}
              </ArcadeText>
            </View>
          ) : null}
        </View>

        {/* Leaderboard table */}
        <NeonFrame color={accent} thickness={1} glow={false} padding={0}>
          {/* Column headers */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
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

          {displayRows.map((row, i) =>
            row === 'gap' ? (
              <View
                key={`gap-${i}`}
                style={{
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <ArcadeText variant="pixel" size={9} color={colors.textMute}>
                  {'·  ·  ·'}
                </ArcadeText>
              </View>
            ) : (
              <HighScoreRow
                key={row.score.id}
                rank={row.rank}
                score={row.score}
                highlight={row.score.id === 'me'}
              />
            ),
          )}
        </NeonFrame>

        {/* Actions */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            justifyContent: 'center',
            marginTop: spacing.xl,
          }}
        >
          <Pressable onPress={playAgain} style={{ flex: 1 }}>
            <NeonFrame color={accent} thickness={2} padding={spacing.md} glow>
              <ArcadeText variant="pixel" size={10} color={accent} align="center">
                {'PLAY  AGAIN'}
              </ArcadeText>
            </NeonFrame>
          </Pressable>
          <Pressable onPress={() => router.replace('/home')} style={{ flex: 1 }}>
            <NeonFrame color={colors.border} thickness={2} padding={spacing.md} glow={false}>
              <ArcadeText variant="pixel" size={10} color={colors.textDim} align="center">
                {'MENU'}
              </ArcadeText>
            </NeonFrame>
          </Pressable>
        </View>
      </ScrollView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}

/**
 * Builds the leaderboard rows to display:
 *   - Always show the top N (default 5).
 *   - If the player is below the top, append a "gap" marker, then the row
 *     above them, the player row, and the row below them.
 *   - If the player is in the top, fill out a few extra rows below for context.
 */
type Row = { rank: number; score: Score } | 'gap';

function pickDisplayRows(ranked: Score[], playerRank: number): Row[] {
  const total = ranked.length;
  const out: Row[] = [];

  const topCount = Math.min(TOP_ROWS_BEFORE_GAP, total);
  for (let i = 0; i < topCount; i++) {
    out.push({ rank: i + 1, score: ranked[i] });
  }

  // Player is inside the top rows already — pad with a couple more rows for
  // context if available.
  if (playerRank <= topCount) {
    const extra = Math.min(3, total - topCount);
    for (let i = 0; i < extra; i++) {
      out.push({ rank: topCount + 1 + i, score: ranked[topCount + i] });
    }
    return out;
  }

  // Player is below the top — show gap + neighborhood (above, player, below).
  const playerIdx = playerRank - 1;
  const startIdx = Math.max(topCount, playerIdx - 1);
  const endIdx = Math.min(total - 1, playerIdx + 1);

  if (startIdx > topCount) out.push('gap');

  for (let i = startIdx; i <= endIdx; i++) {
    out.push({ rank: i + 1, score: ranked[i] });
  }

  return out;
}
