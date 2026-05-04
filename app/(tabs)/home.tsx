// Lobby — the arcade floor.
//
// Today's promoted cabinet renders as a full-width "FREE TODAY" card at
// the top of the grid. The remaining cabinets fill the standard 2-col
// grid below it. Marquee at the top shows a humanized countdown to
// tomorrow's reset.

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { GameCabinetCard } from '../../src/components/GameCabinetCard';
import { Marquee } from '../../src/components/Marquee';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { games, getGame } from '../../src/data/games';
import { getPlayerBest, getPlayerRank } from '../../src/data/leaderboard';
import {
  formatTimeUntil,
  getDailyCabinetId,
  msUntilNextUtcMidnight,
  usePlayer,
} from '../../src/data/player';
import { colors, neon, spacing } from '../../src/theme';

export default function HomeScreen() {
  const player = usePlayer();
  const dailyId = getDailyCabinetId();
  const dailyGame = getGame(dailyId);
  // Order shuffles every UTC day so different cabinets surface at the top
  // each morning. Same seed as the daily challenge → both rotate together.
  // `hidden` cabinets are benched between weekly content drops — they
  // never appear in the lobby but their code/leaderboard data are intact.
  const otherGames = dailyShuffle(
    games.filter((g) => g.id !== dailyId && !g.hidden),
    todaysShuffleSeed(),
  );

  // Live-updating reset clock. Re-renders every minute — cheap.
  const [resetMs, setResetMs] = useState(() => msUntilNextUtcMidnight());
  useEffect(() => {
    const id = setInterval(() => setResetMs(msUntilNextUtcMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);
  const resetCountdown = formatTimeUntil(resetMs);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        {/* Breathing room below the SafeArea so marquee clears the Dynamic Island. */}
        <View style={{ height: spacing.sm }} />

        {/* Brand strip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'center',
            paddingBottom: spacing.xs,
          }}
        >
          <ArcadeText variant="pixel" size={11} color={neon('cyan')} glowColor={neon('cyan')}>
            {'OUR'}
          </ArcadeText>
          <ArcadeText variant="pixel" size={11} color={neon('magenta')} glowColor={neon('magenta')}>
            {'CADE'}
          </ArcadeText>
        </View>

        <Marquee
          text={`★ FREE TODAY: ${dailyGame?.name ?? '???'} ★ RESET IN ${resetCountdown} ★ DAILY CHALLENGE — NO TOKEN ★`}
          color={neon('green')}
          glowColor={neon('green')}
          size={9}
        />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.huge,
        }}
      >
        {/* Header row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: spacing.md,
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
          <Pressable onPress={() => router.push('/shop')}>
            <View
              style={{
                alignItems: 'flex-end',
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
              }}
            >
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'TOKENS  +'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {String(player.tokens).padStart(2, '0')}
              </ArcadeText>
            </View>
          </Pressable>
        </View>

        {/* Daily challenge — full-width feature card */}
        {dailyGame ? (
          <View style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ArcadeText variant="pixel" size={9} color={neon('green')} glowColor={neon('green')}>
                {'★ DAILY CHALLENGE'}
              </ArcadeText>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {`· FREE FOR ${resetCountdown}`}
              </ArcadeText>
            </View>
            {(() => {
              const best = getPlayerBest(dailyGame.id);
              const rank = getPlayerRank(dailyGame.id);
              return (
                <GameCabinetCard
                  game={dailyGame}
                  bestScore={best?.score ?? null}
                  rank={rank}
                  scoreDetail={{ level: best?.level, taps: best?.taps }}
                  onPress={() => router.push(`/game/${dailyGame.id}`)}
                  freeToday
                  variant="wide"
                />
              );
            })()}
          </View>
        ) : null}

        {/* 2-per-row grid that exactly matches the daily card width.
            Cabinets are mixed across skills — header color tells you the
            genre. Order rotates daily (see `dailyShuffle`). */}
        {chunkPairs(otherGames).map((pair, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            {pair.map((game) => {
              const best = getPlayerBest(game.id);
              const rank = getPlayerRank(game.id);
              return (
                <View key={game.id} style={{ flex: 1 }}>
                  <GameCabinetCard
                    game={game}
                    bestScore={best?.score ?? null}
                    rank={rank}
                    scoreDetail={{ level: best?.level, taps: best?.taps }}
                    onPress={() => router.push(`/game/${game.id}`)}
                  />
                </View>
              );
            })}
            {pair.length < 2 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}

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

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push(arr.slice(i, i + 2));
  }
  return out;
}

// ---- Daily-rotating cabinet order --------------------------------------
//
// Goal: every day the cabinet placement reshuffles so different cabinets
// catch the eye at the top of the lobby. The shuffle is deterministic
// from the UTC day index, so all players in a given UTC day see the
// same order — important because that's also when the daily challenge
// rotates.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** UTC day index — same seed source as `getDailyCabinetId`. */
function todaysShuffleSeed(now: number = Date.now()): number {
  return Math.floor(now / ONE_DAY_MS);
}

/** Mulberry32-seeded Fisher-Yates. Pure; never mutates input. */
function dailyShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    // Mulberry32 step
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
