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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { HighScoreRow } from '../../src/components/HighScoreRow';
import { NeonFrame } from '../../src/components/NeonFrame';
import { PbCelebration, CelebrationTier } from '../../src/components/PbCelebration';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { getGame } from '../../src/data/games';
import {
  isLowerBetter,
  rankPlayerScore,
  Score,
  submitScore,
} from '../../src/data/leaderboard';
import { usePlayer } from '../../src/data/player';
import {
  buildChallengeMessage,
  buildChallengeUrl,
  clearActiveChallenge,
  didBeatActiveChallenge,
  getActiveChallenge,
} from '../../src/lib/challenge';
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

  // Auto-submit on mount + grant any earned bonus tokens. Each cabinet
  // can pay a personal-best bonus (any new best), a top-10 bonus (first
  // time cracking #10), and a top-1 bonus (first time taking #1).
  // The earned tier drives the PbCelebration overlay below.
  //
  // Also captures the in-flight challenge (if any) so we can show the
  // "YOU BEAT THEM" stinger and the SEND IT BACK button. We snapshot
  // the challenger before clearing it from the global state — that way
  // a quick PLAY AGAIN doesn't replay the challenge banner on the
  // pre-game screen of the next run.
  const submitFiredRef = useRef(false);
  const [bonusEarned, setBonusEarned] = useState(0);
  const [celebrationTier, setCelebrationTier] = useState<CelebrationTier | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [beatChallenger, setBeatChallenger] = useState<{
    initials: string;
    score: number;
  } | null>(null);
  useEffect(() => {
    if (submitFiredRef.current) return;
    submitFiredRef.current = true;

    const result = player.grantPbBonusIfBetter({
      gameId: game.id,
      score,
      rank: placement.playerRank,
      lowerIsBetter: isLowerBetter(game.id),
    });
    if (result.bonus > 0) {
      setBonusEarned(result.bonus);
      // Highest tier wins — first #1 trumps first top-10 trumps a plain PB.
      const tier: CelebrationTier = result.isFirstTop1
        ? 'top1'
        : result.isFirstTop10
          ? 'top10'
          : 'pb';
      setCelebrationTier(tier);
      setShowCelebration(true);
    }

    // Did this run beat an active challenge? Snapshot before clearing
    // so the screen state stays even after we drop out of challenge mode.
    const active = getActiveChallenge();
    if (
      active &&
      didBeatActiveChallenge(game.id, score, isLowerBetter(game.id))
    ) {
      setBeatChallenger({
        initials: active.challenger,
        score: active.challengerScore,
      });
    }
    if (active && active.gameId === game.id) {
      // Clear so PLAY AGAIN doesn't replay the challenge banner on
      // the next pre-game render.
      clearActiveChallenge();
    }

    submitScore({
      gameId: game.id,
      initials: player.initials,
      score,
      unit: game.unit,
      level,
      taps,
    })
      .then((result) => {
        if (result.ok) setSubmitted(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CHALLENGE — open the native share sheet with prefilled iMessage
  // text + a deep-link URL. Friend who taps the URL opens Ourcade
  // straight to this cabinet with the score to beat. Uses the built-in
  // RN Share API so iOS shows Messages, Mail, WhatsApp, etc.
  const handleChallenge = async () => {
    if (!game) return;
    const formattedScore = game.formatScore
      ? game.formatScore(score, { level, taps })
      : Number.isInteger(score)
        ? score.toLocaleString()
        : score.toFixed(2);
    const message = buildChallengeMessage({
      game,
      initials: player.initials,
      score,
      formattedScore,
    });
    try {
      await Share.share({
        message,
        url: buildChallengeUrl(game.id, player.initials, score),
      });
    } catch {
      /* user cancelled or share unavailable — fail silently */
    }
  };

  // PLAY AGAIN charges a token (or is free if this is today's daily).
  // Insufficient → routes to /shop. Live games go straight to their
  // play screen for arcade-feel instant retry; stubs go to pre-game.
  const playAgain = () => {
    if (!player.spendTokenFor(game.id)) {
      router.replace('/shop');
      return;
    }
    if (game.id === 'tap-bullseye') router.replace('/play/tap-bullseye');
    else if (game.id === 'minesweep') router.replace('/play/minesweep');
    else if (game.id === 'tilt-maze') router.replace('/play/tilt-maze');
    else if (game.id === 'walk-the-line') router.replace('/play/walk-the-line');
    else if (game.id === 'slipstream') router.replace('/play/slipstream');
    else if (game.id === 'dead-air') router.replace('/play/dead-air');
    else if (game.id === 'trivia') router.replace('/play/trivia');
    else if (game.id === 'draw-it') router.replace('/play/draw-it');
    else if (game.id === 'pulse') router.replace('/play/pulse');
    else if (game.id === 'memory-grid') router.replace('/play/memory-grid');
    else if (game.id === 'stroop') router.replace('/play/stroop');
    else if (game.id === 'reaction-light') router.replace('/play/reaction-light');
    else if (game.id === 'spin-360') router.replace('/play/spin-360');
    else if (game.id === 'flip') router.replace('/play/flip');
    else if (game.id === 'shake') router.replace('/play/shake');
    else if (game.id === 'card-shark') router.replace('/play/card-shark');
    else if (game.id === 'vector') router.replace('/play/vector');
    else router.replace({ pathname: '/game/[id]', params: { id: game.id } });
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
          {bonusEarned > 0 ? (
            <View style={{ marginTop: spacing.sm, alignItems: 'center' }}>
              <NeonFrame
                color={neon('green')}
                thickness={2}
                padding={spacing.sm}
                glow
              >
                <ArcadeText
                  variant="pixel"
                  size={11}
                  color={neon('green')}
                  glowColor={neon('green')}
                >
                  {`+${bonusEarned} CREDITS  ★`}
                </ArcadeText>
              </NeonFrame>
              <View style={{ height: 4 }} />
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {placement.playerRank === 1
                  ? 'WORLD RECORD BONUS'
                  : placement.playerRank <= 10
                    ? 'TOP 10 BONUS'
                    : 'PERSONAL BEST'}
              </ArcadeText>
            </View>
          ) : null}
          {duration != null ? (
            <View style={{ marginTop: spacing.sm }}>
              <ArcadeText variant="pixel" size={8} color={colors.textMute}>
                {`SURVIVED ${duration.toFixed(1)}s`}
              </ArcadeText>
            </View>
          ) : null}
          {beatChallenger ? (
            <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <NeonFrame
                color={neon('green')}
                thickness={2}
                padding={spacing.sm}
                glow
                fill={colors.bgSurface}
              >
                <Blink intervalMs={420} minOpacity={0.55}>
                  <ArcadeText
                    variant="pixel"
                    size={11}
                    color={neon('green')}
                    glowColor={neon('green')}
                    align="center"
                  >
                    {`★ YOU BEAT ${beatChallenger.initials} ★`}
                  </ArcadeText>
                </Blink>
              </NeonFrame>
            </View>
          ) : null}
        </View>


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

        {/* Actions — CHALLENGE button shows for any submitted run; label
            switches to "SEND IT BACK" when this run beat an incoming
            challenger so the loop closes naturally. */}
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
          <Pressable onPress={handleChallenge} style={{ flex: 1 }}>
            <NeonFrame
              color={neon('green')}
              thickness={2}
              padding={spacing.md}
              glow
            >
              <ArcadeText
                variant="pixel"
                size={10}
                color={neon('green')}
                glowColor={neon('green')}
                align="center"
              >
                {beatChallenger ? 'SEND IT BACK' : 'CHALLENGE'}
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

      {/* Subtle bottom-corner watermark so screenshots of high scores
          carry the brand without needing a built-in share button. Sits
          above the scanline overlay so it's legible in captures. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: spacing.md,
          bottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'baseline',
          opacity: 0.55,
        }}
      >
        <ArcadeText variant="pixel" size={8} color={neon('cyan')}>
          {'★ OUR'}
        </ArcadeText>
        <ArcadeText variant="pixel" size={8} color={neon('magenta')}>
          {'CADE'}
        </ArcadeText>
      </View>

      {/* Personal-best celebration — shown ABOVE the result screen on
          any run that earned a bonus. Dismissed on tap (after ticker
          finishes) or auto-dismisses, revealing the leaderboard. */}
      {showCelebration && celebrationTier ? (
        <PbCelebration
          game={game}
          score={score}
          detail={{ level, taps }}
          rank={placement.playerRank}
          total={placement.total}
          bonus={bonusEarned}
          tier={celebrationTier}
          onDismiss={() => setShowCelebration(false)}
        />
      ) : null}
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
