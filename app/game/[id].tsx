// Pre-game hub. Designed to fit on one screen so the player can see:
//   - Game name + tagline + token count
//   - Compact rules (3-4 lines max)
//   - Mini leaderboard (top 5)
//   - Your best score
//   - START + MAIN MENU buttons
//
// Spending a token happens at PRESS START. If the player is out of
// tokens, the start button shows OUT OF TOKENS and routes to the shop.

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { FirstPlayDemo } from '../../src/components/FirstPlayDemo';
import { GameIcon } from '../../src/components/GameIcon';
import { HighScoreRow } from '../../src/components/HighScoreRow';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { getGame } from '../../src/data/games';
import { getPlayerBest, getTopScores } from '../../src/data/leaderboard';
import { getDailyCabinetId, usePlayer } from '../../src/data/player';
import {
  setActiveChallenge,
  clearActiveChallenge,
} from '../../src/lib/challenge';
import { colors, neon, spacing } from '../../src/theme';

export default function PreGameScreen() {
  const { id, challenger, cscore } = useLocalSearchParams<{
    id: string;
    challenger?: string;
    cscore?: string;
  }>();
  const game = id ? getGame(id) : undefined;
  const player = usePlayer();
  const [inserting, setInserting] = useState(false);

  // Challenge plumbing: if the route was opened from a challenge URL,
  // record the active challenge so the result screen can detect "you
  // beat them" and show the SEND IT BACK button. Cleared on unmount so
  // backing out to the lobby drops you out of challenge mode.
  const challengeScore =
    cscore != null && !Number.isNaN(Number(cscore)) ? Number(cscore) : null;
  const challengerInitials = challenger ? challenger.toUpperCase() : null;
  useEffect(() => {
    if (game && challengerInitials && challengeScore != null) {
      setActiveChallenge({
        gameId: game.id,
        challenger: challengerInitials,
        challengerScore: challengeScore,
      });
    }
    return () => {
      // Only clear if THIS screen set it — backing out from a challenge
      // run shouldn't drop someone else's challenge if they're nested
      // somehow. In v1.0 routing the only way to set is via this
      // effect, so clearing on unmount is safe.
      if (challengerInitials && challengeScore != null) {
        clearActiveChallenge();
      }
    };
  }, [game, challengerInitials, challengeScore]);
  // First-play tutorial overlay — only on cabinets the player has
  // never visited (or never scored on). Captured into local state on
  // mount so the player hook updating to seenTutorials[id]=true on
  // dismiss doesn't snap the overlay closed mid-fade.
  const [showTutorial, setShowTutorial] = useState<boolean>(() =>
    game ? !player.hasSeenTutorial(game.id) : false,
  );
  // Token chip pulses when a coin is consumed.
  const chipPulse = useRef(new Animated.Value(1)).current;

  if (!game) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl }}>
        <ArcadeText variant="pixel" size={14} color={neon('red')} align="center">
          {'GAME NOT FOUND'}
        </ArcadeText>
      </View>
    );
  }

  const dismissTutorial = () => {
    player.markTutorialSeen(game.id);
    setShowTutorial(false);
  };

  const accent = neon(game.accentColor);
  const best = getPlayerBest(game.id);
  const top = getTopScores(game.id, 'all', 5);
  const worldRecord = top[0];
  const isDaily = getDailyCabinetId() === game.id;
  const outOfTokens = !isDaily && player.tokens <= 0;

  function startGame() {
    // Re-narrow `game` for TS inside this closure — the parent scope's
    // early return doesn't propagate through nested function bodies.
    // At runtime this is a no-op because the parent already returned.
    if (!game) return;
    if (outOfTokens || inserting) {
      if (outOfTokens) router.push('/shop');
      return;
    }

    // Coin-insertion ceremony: heavy haptic, chip pulse, then the
    // actual spend + navigate after a short delay so it FEELS like
    // a coin clunked into the slot.
    setInserting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    Animated.sequence([
      Animated.timing(chipPulse, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.timing(chipPulse, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(chipPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      if (!player.spendTokenFor(game.id)) {
        setInserting(false);
        router.push('/shop');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (game.status !== 'live') {
        const fakeScore = randomScore(game.id);
        router.push({
          pathname: '/result/[id]',
          params: { id: game.id, score: String(fakeScore) },
        });
        return;
      }

      if (game.id === 'tap-bullseye') router.push('/play/tap-bullseye');
      else if (game.id === 'minesweep') router.push('/play/minesweep');
      else if (game.id === 'tilt-maze') router.push('/play/tilt-maze');
      else if (game.id === 'walk-the-line') router.push('/play/walk-the-line');
      else if (game.id === 'slipstream') router.push('/play/slipstream');
      else if (game.id === 'dead-air') router.push('/play/dead-air');
      else if (game.id === 'trivia') router.push('/play/trivia');
      else if (game.id === 'draw-it') router.push('/play/draw-it');
      else if (game.id === 'pulse') router.push('/play/pulse');
      else if (game.id === 'memory-grid') router.push('/play/memory-grid');
      else if (game.id === 'stroop') router.push('/play/stroop');
      else if (game.id === 'reaction-light') router.push('/play/reaction-light');
      else if (game.id === 'spin-360') router.push('/play/spin-360');
      else if (game.id === 'flip') router.push('/play/flip');
      else if (game.id === 'shake') router.push('/play/shake');
      else if (game.id === 'card-shark') router.push('/play/card-shark');
      else if (game.id === 'vector') router.push('/play/vector');
      else {
        player.refundToken();
        router.replace('/home');
      }
    }, 650);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Top strip — back affordance + token count */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'<<  MENU'}
            </ArcadeText>
          </Pressable>
          <Animated.View style={{ transform: [{ scale: chipPulse }] }}>
            <Pressable
              onPress={() => router.push('/shop')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: outOfTokens ? neon('red') : colors.border,
              }}
            >
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'CREDITS'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={16}
                color={outOfTokens ? neon('red') : neon('yellow')}
                glowColor={outOfTokens ? neon('red') : neon('yellow')}
              >
                {String(player.tokens)}
              </ArcadeText>
            </Pressable>
          </Animated.View>
        </View>

        {/* Challenge banner — only when this route was opened via a
            challenge URL. Sits above the title block so the player's
            eye lands on it first. */}
        {challengerInitials && challengeScore != null && game ? (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.sm,
            }}
          >
            <NeonFrame
              color={neon('green')}
              thickness={2}
              padding={spacing.sm}
              glow
              fill={colors.bgSurface}
            >
              <View style={{ alignItems: 'center' }}>
                <Blink intervalMs={520} minOpacity={0.55}>
                  <ArcadeText
                    variant="pixel"
                    size={10}
                    color={neon('green')}
                    glowColor={neon('green')}
                    align="center"
                  >
                    {`★ ${challengerInitials} CHALLENGED YOU ★`}
                  </ArcadeText>
                </Blink>
                <View style={{ height: 4 }} />
                <ArcadeText
                  variant="mono"
                  size={20}
                  color={neon('green')}
                  glowColor={neon('green')}
                  align="center"
                >
                  {`BEAT ${formatVal(challengeScore, game)}`}
                </ArcadeText>
              </View>
            </NeonFrame>
          </View>
        ) : null}

        {/* Title block — icon, name, tagline */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <GameIcon id={game.id} size={56} color={accent} />
          <View style={{ flex: 1 }}>
            <ArcadeText
              variant="pixel"
              size={16}
              color={accent}
              glowColor={accent}
            >
              {game.name}
            </ArcadeText>
            <View style={{ height: 4 }} />
            <ArcadeText variant="mono" size={14} color={colors.textDim}>
              {game.tagline}
            </ArcadeText>
          </View>
        </View>

        {/* Compact rules */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
          <NeonFrame color={colors.border} thickness={1} glow={false} padding={spacing.sm}>
            {game.rules.slice(0, 4).map((rule, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 }}
              >
                <ArcadeText variant="pixel" size={8} color={accent} style={{ marginRight: 6 }}>
                  {'>'}
                </ArcadeText>
                <ArcadeText
                  variant="mono"
                  size={13}
                  color={colors.textDim}
                  style={{ flex: 1 }}
                >
                  {rule}
                </ArcadeText>
              </View>
            ))}
          </NeonFrame>
        </View>

        {/* Score callouts row */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <Callout
            label="YOUR BEST"
            value={best ? formatVal(best.score, game) : '—'}
            color={neon('cyan')}
          />
          <Callout
            label="WORLD RECORD"
            value={worldRecord ? formatVal(worldRecord.score, game) : '—'}
            sub={worldRecord ? `BY ${worldRecord.initials}` : ''}
            color={neon('yellow')}
          />
        </View>

        {/* Top 5 mini-leaderboard */}
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <ArcadeText variant="pixel" size={8} color={colors.textMute}>
            {'>> TOP 5'}
          </ArcadeText>
          <View style={{ height: 4 }} />
          <NeonFrame color={accent} thickness={1} glow={false} padding={0}>
            {top.length === 0 ? (
              <View style={{ padding: spacing.md, alignItems: 'center' }}>
                <ArcadeText variant="pixel" size={9} color={colors.textMute}>
                  {'BE THE FIRST'}
                </ArcadeText>
              </View>
            ) : (
              top.map((s, i) => (
                <HighScoreRow
                  key={s.id}
                  rank={i + 1}
                  score={s}
                  // Highlight the player's row when their initials hold a
                  // top-5 spot — gives a "defend your rank" hook on entry.
                  highlight={s.initials === player.initials}
                />
              ))
            )}
          </NeonFrame>
        </View>

        {/* START + MAIN MENU buttons */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Pressable onPress={() => router.replace('/home')} style={{ flex: 1 }}>
            <NeonFrame color={colors.border} thickness={2} padding={spacing.md} glow={false}>
              <ArcadeText
                variant="pixel"
                size={11}
                color={colors.textDim}
                align="center"
              >
                {'MAIN  MENU'}
              </ArcadeText>
            </NeonFrame>
          </Pressable>
          <Pressable
            onPress={startGame}
            disabled={inserting}
            style={{ flex: 2, opacity: inserting ? 0.7 : 1 }}
          >
            <NeonFrame
              color={
                inserting
                  ? neon('green')
                  : outOfTokens
                    ? neon('red')
                    : accent
              }
              thickness={3}
              padding={spacing.md}
              glow
              fill={colors.bgSurface}
            >
              {inserting ? (
                <View style={{ alignItems: 'center' }}>
                  <ArcadeText
                    variant="pixel"
                    size={12}
                    color={neon('green')}
                    glowColor={neon('green')}
                    align="center"
                  >
                    {'★ COIN ACCEPTED ★'}
                  </ArcadeText>
                  <View style={{ height: 4 }} />
                  <ArcadeText
                    variant="pixel"
                    size={9}
                    color={colors.textDim}
                    align="center"
                  >
                    {'GAME ON'}
                  </ArcadeText>
                </View>
              ) : outOfTokens ? (
                <View style={{ alignItems: 'center' }}>
                  <ArcadeText
                    variant="pixel"
                    size={12}
                    color={neon('red')}
                    glowColor={neon('red')}
                    align="center"
                  >
                    {'NO  CREDITS'}
                  </ArcadeText>
                  <View style={{ height: 4 }} />
                  <ArcadeText
                    variant="pixel"
                    size={8}
                    color={colors.textDim}
                    align="center"
                  >
                    {'TAP TO CLAIM DAILY'}
                  </ArcadeText>
                </View>
              ) : game.status === 'live' ? (
                <View style={{ alignItems: 'center' }}>
                  <Blink intervalMs={500}>
                    <ArcadeText
                      variant="pixel"
                      size={14}
                      color={isDaily ? neon('green') : accent}
                      glowColor={isDaily ? neon('green') : accent}
                      align="center"
                    >
                      {isDaily ? '★ FREE TODAY · PLAY ▶' : 'INSERT  CREDIT  ▼'}
                    </ArcadeText>
                  </Blink>
                  <View style={{ height: 4 }} />
                  <ArcadeText
                    variant="pixel"
                    size={8}
                    color={colors.textMute}
                    align="center"
                  >
                    {isDaily ? 'FREE — DAILY CHALLENGE' : 'COSTS 1 CREDIT'}
                  </ArcadeText>
                </View>
              ) : (
                <ArcadeText
                  variant="pixel"
                  size={11}
                  color={colors.textMute}
                  align="center"
                >
                  {'COMING SOON'}
                </ArcadeText>
              )}
            </NeonFrame>
          </Pressable>
        </View>

        <ScanlineOverlay opacity={0.04} />
      </SafeAreaView>

      {/* First-play tutorial overlay — covers the pre-game screen the
          first time a player opens this cabinet. Dismissed via GOT IT;
          marking seen persists to AsyncStorage so it never re-shows. */}
      {showTutorial ? (
        <FirstPlayDemo game={game} onDismiss={dismissTutorial} />
      ) : null}
    </View>
  );
}

function Callout({
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
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: color,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
      }}
    >
      <ArcadeText variant="pixel" size={7} color={colors.textMute}>
        {label}
      </ArcadeText>
      <ArcadeText variant="mono" size={18} color={color}>
        {value}
      </ArcadeText>
      {sub ? (
        <ArcadeText variant="pixel" size={7} color={colors.textMute}>
          {sub}
        </ArcadeText>
      ) : null}
    </View>
  );
}

function formatVal(score: number, game: ReturnType<typeof getGame>): string {
  if (!game) return String(score);
  if (game.formatScore) return game.formatScore(score);
  const value = Number.isInteger(score) ? score.toLocaleString() : score.toFixed(2);
  return `${value} ${game.unit}`;
}

// Stub games still get a randomized score so the result-screen flow works.
function randomScore(gameId: string): number {
  switch (gameId) {
    case 'spin-360':
      return Math.round(Math.random() * 12 * 10) / 10;
    default:
      return Math.round(5000 + Math.random() * 4999);
  }
}
