// PULSE — falling-tile rhythm cabinet. Infinite mode.
//
// Four vertical lanes. Tiles fall from the top toward a hit line near
// the bottom. Tap the lane the moment a tile crosses the line.
//
// Core rules:
//   - Tap an empty lane (no tile in window)         → game over.
//   - Tile passes the hit line + grace window       → game over.
//   - Off-key (red) tile in your lane: DO NOT tap it.
//       Tapping an off-key tile                     → game over.
//       Letting it fall through                     → no penalty.
//
// Scoring per hit:
//   base 100
//   + accuracy bonus up to +100  (perfect = right on the line)
//   × combo multiplier (5+ = x1.5, 10+ = x2, 20+ = x2.5, 30+ = x3)
//
// Difficulty progression — purely time-based, no cap:
//   - Tempo (fall + spawn) ramps continuously. Past the initial 60s
//     ramp, both keep tightening with diminishing returns toward
//     hard floors so a long run remains brutal but possible.
//   - 30s+: tile heights start varying (some smaller, some normal).
//   - 60s+: off-key (red) decoy tiles appear sporadically. Don't tap.
//   - 90s+: off-key chance climbs, lengths shrink further.
//
// Audio: each lane fires a different note on hit (C-major chord),
// off-key taps trigger a buzz, and a soft chord-pad loop runs in the
// background. All audio loaded best-effort — game still runs silent
// if assets fail to load.

import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

const LANE_COUNT = 4;
const TICK_MS = 33;

// Tempo curve. Linear ramp to RAMP_MS for the first INITIAL_RAMP_SEC,
// then exponential approach toward the floor.
const FALL_START_MS = 1800;
const FALL_RAMP_END_MS = 700;
const FALL_FLOOR_MS = 360;
const SPAWN_START_MS = 650;
const SPAWN_RAMP_END_MS = 280;
const SPAWN_FLOOR_MS = 150;
const INITIAL_RAMP_SEC = 60;
const POST_RAMP_HALF_SEC = 35; // every 35s past ramp, halve the gap to floor

// Tile height — starts uniform, varies with elapsed time.
const TILE_BASE_HEIGHT = 64;
const TILE_MIN_HEIGHT = 32;

// Hit window — tile center must be within this many px of the hit line.
const HIT_WINDOW_PX = 220;
const PERFECT_PX = 22;

const HIT_LINE_OFFSET_FROM_BOTTOM = 110;
const MISS_GRACE_MS = 180;

const ACCENT = neon('yellow');
const LANE_COLORS = [neon('cyan'), neon('magenta'), neon('green'), neon('orange')];
const OFFKEY_COLOR = neon('red');

type Tile = {
  id: number;
  lane: number;
  spawnedAt: number;
  fallMs: number;
  height: number;
  offKey: boolean;
  // Once hit/passed, the tile bursts in place for a few ticks then is removed.
  hitAt?: number;
  hitDelta?: number;
  hitPerfect?: boolean;
};

type Phase = 'countdown' | 'playing' | 'over';

export default function PulseGame() {
  const { width: screenW } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('countdown');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [tilesCleared, setTilesCleared] = useState(0);
  const [, setRenderTick] = useState(0);
  const [playH, setPlayH] = useState(560);
  const [countdown, setCountdown] = useState(3);
  const [endReason, setEndReason] = useState<'MISS' | 'EMPTY' | 'OFFKEY' | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const phaseRef = useRef<Phase>('countdown');
  const startedAtRef = useRef(0);
  const tilesRef = useRef<Tile[]>([]);
  const nextIdRef = useRef(1);
  const lastSpawnAtRef = useRef(0);
  const lastSpawnLaneRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const clearedRef = useRef(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio.
  const noteSoundsRef = useRef<(Audio.Sound | null)[]>([]);
  const wrongSoundRef = useRef<Audio.Sound | null>(null);
  const bgMusicRef = useRef<Audio.Sound | null>(null);

  const LANE_W = screenW / LANE_COUNT;
  const HIT_Y = playH - HIT_LINE_OFFSET_FROM_BOTTOM;

  // Load audio once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          allowsRecordingIOS: false,
        });
      } catch {
        /* ignore */
      }

      const noteAssets = [
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../assets/sounds/note-1.wav'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../assets/sounds/note-2.wav'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../assets/sounds/note-3.wav'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../assets/sounds/note-4.wav'),
      ];
      const loaded: (Audio.Sound | null)[] = [];
      for (const src of noteAssets) {
        try {
          const { sound } = await Audio.Sound.createAsync(src, { volume: 0.7 });
          loaded.push(sound);
        } catch {
          loaded.push(null);
        }
      }
      if (cancelled) {
        loaded.forEach((s) => s?.unloadAsync().catch(() => {}));
        return;
      }
      noteSoundsRef.current = loaded;

      try {
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../assets/sounds/wrong.wav'),
          { volume: 0.7 },
        );
        if (cancelled) {
          sound.unloadAsync().catch(() => {});
        } else {
          wrongSoundRef.current = sound;
        }
      } catch {
        /* ignore */
      }

      try {
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../assets/sounds/pulse-bg.wav'),
          { volume: 0.35, isLooping: true, shouldPlay: false },
        );
        if (cancelled) {
          sound.unloadAsync().catch(() => {});
        } else {
          bgMusicRef.current = sound;
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      noteSoundsRef.current.forEach((s) => s?.unloadAsync().catch(() => {}));
      wrongSoundRef.current?.unloadAsync().catch(() => {});
      bgMusicRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Countdown then start.
  useEffect(() => {
    let n = 3;
    setCountdown(n);
    countdownIntervalRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        startGame();
      } else {
        setCountdown(n);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }, 700);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startGame() {
    setPhaseSafe('playing');
    startedAtRef.current = Date.now();
    lastSpawnAtRef.current = Date.now() - SPAWN_START_MS;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    tickIntervalRef.current = setInterval(tick, TICK_MS);
    bgMusicRef.current?.playAsync().catch(() => {});
  }

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function tempoCurve(elapsed: number, start: number, rampEnd: number, floor: number): number {
    if (elapsed <= INITIAL_RAMP_SEC) {
      const t = elapsed / INITIAL_RAMP_SEC;
      return start + (rampEnd - start) * t;
    }
    // Past ramp: exponential approach to floor.
    const overrun = elapsed - INITIAL_RAMP_SEC;
    const halves = overrun / POST_RAMP_HALF_SEC;
    const remaining = (rampEnd - floor) * Math.pow(0.5, halves);
    return floor + remaining;
  }

  function offKeyChance(elapsed: number): number {
    if (elapsed < 60) return 0;
    if (elapsed < 90) return 0.08;
    if (elapsed < 120) return 0.14;
    return Math.min(0.22, 0.14 + (elapsed - 120) * 0.0008);
  }

  function tileHeightFor(elapsed: number): number {
    if (elapsed < 30) return TILE_BASE_HEIGHT;
    // Random within a band that narrows over time.
    const minH = Math.max(TILE_MIN_HEIGHT, TILE_BASE_HEIGHT - (elapsed - 30) * 0.4);
    const maxH = TILE_BASE_HEIGHT;
    return minH + Math.random() * (maxH - minH);
  }

  function tick() {
    if (phaseRef.current !== 'playing') return;
    const t = Date.now();
    const elapsed = (t - startedAtRef.current) / 1000;
    const fallMs = tempoCurve(elapsed, FALL_START_MS, FALL_RAMP_END_MS, FALL_FLOOR_MS);
    const spawnMs = tempoCurve(elapsed, SPAWN_START_MS, SPAWN_RAMP_END_MS, SPAWN_FLOOR_MS);
    setElapsedSec(Math.floor(elapsed));

    // Spawn cadence — based on tempo, not frame rate.
    while (t - lastSpawnAtRef.current >= spawnMs) {
      lastSpawnAtRef.current += spawnMs;
      let lane = Math.floor(Math.random() * LANE_COUNT);
      if (lane === lastSpawnLaneRef.current) {
        lane = (lane + 1 + Math.floor(Math.random() * (LANE_COUNT - 1))) % LANE_COUNT;
      }
      lastSpawnLaneRef.current = lane;
      const offKey = Math.random() < offKeyChance(elapsed);
      tilesRef.current.push({
        id: nextIdRef.current++,
        lane,
        spawnedAt: t,
        fallMs,
        height: tileHeightFor(elapsed),
        offKey,
      });
    }

    // Cull / check misses.
    for (let i = tilesRef.current.length - 1; i >= 0; i--) {
      const tile = tilesRef.current[i];
      if (tile.hitAt) {
        if (t - tile.hitAt > 240) tilesRef.current.splice(i, 1);
        continue;
      }
      const overshootMs = t - tile.spawnedAt - tile.fallMs;
      if (overshootMs > MISS_GRACE_MS) {
        if (tile.offKey) {
          // Off-key tiles passing through is GOOD — just remove them.
          tilesRef.current.splice(i, 1);
          continue;
        }
        gameOver('MISS');
        return;
      }
    }

    setRenderTick((v) => (v + 1) % 1_000_000);
  }

  function gameOver(reason: 'MISS' | 'EMPTY' | 'OFFKEY') {
    if (phaseRef.current !== 'playing') return;
    setPhaseSafe('over');
    setEndReason(reason);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    bgMusicRef.current?.stopAsync().catch(() => {});
    if (reason === 'OFFKEY' || reason === 'EMPTY') {
      wrongSoundRef.current?.replayAsync().catch(() => {});
    }
    setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'pulse', score: String(scoreRef.current) },
      });
    }, 1300);
  }

  function tapLane(lane: number) {
    if (phaseRef.current !== 'playing') return;
    const t = Date.now();
    let best: Tile | null = null;
    let bestDist = Infinity;
    for (const tile of tilesRef.current) {
      if (tile.lane !== lane || tile.hitAt) continue;
      const y = ((t - tile.spawnedAt) / tile.fallMs) * HIT_Y;
      const dist = Math.abs(y - HIT_Y);
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }

    if (!best || bestDist > HIT_WINDOW_PX) {
      gameOver('EMPTY');
      return;
    }

    if (best.offKey) {
      // Tapping a red off-key tile is a strike-out.
      best.hitAt = t;
      best.hitDelta = 0;
      gameOver('OFFKEY');
      return;
    }

    // Score a clean hit.
    const accuracy = clamp(1 - bestDist / HIT_WINDOW_PX, 0, 1);
    const perfect = bestDist <= PERFECT_PX;
    const base = 100;
    const accBonus = Math.round(100 * accuracy);
    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    if (newCombo > bestComboRef.current) bestComboRef.current = newCombo;
    const mult = comboMultiplier(newCombo);
    const delta = Math.round((base + accBonus) * mult);
    scoreRef.current += delta;
    clearedRef.current += 1;

    best.hitAt = t;
    best.hitDelta = delta;
    best.hitPerfect = perfect;

    setScore(scoreRef.current);
    setCombo(newCombo);
    setBestCombo(bestComboRef.current);
    setTilesCleared(clearedRef.current);

    Haptics.impactAsync(
      perfect
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});

    // Play the lane's note. replayAsync is non-blocking and overlaps
    // okay if multiple lanes fire close together.
    const sound = noteSoundsRef.current[lane];
    sound?.replayAsync().catch(() => {});
  }

  function onPlayLayout(e: LayoutChangeEvent) {
    setPlayH(e.nativeEvent.layout.height);
  }

  const renderNow = Date.now();
  const tiles = tilesRef.current;
  const mult = comboMultiplier(combo);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            paddingRight: 70, // room for EXIT chip
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'SCORE'}
            </ArcadeText>
            <ArcadeText variant="mono" size={22} color={ACCENT} glowColor={ACCENT}>
              {String(score).padStart(6, '0')}
            </ArcadeText>
            <ArcadeText variant="pixel" size={7} color={colors.textDim}>
              {`${tilesCleared} TILES · ${elapsedSec}s`}
            </ArcadeText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute}>
              {'COMBO'}
            </ArcadeText>
            <ArcadeText
              variant="mono"
              size={22}
              color={combo >= 5 ? neon('green') : colors.text}
              glowColor={combo >= 5 ? neon('green') : undefined}
            >
              {combo > 0 ? `x${combo}` : '—'}
            </ArcadeText>
            {mult > 1 ? (
              <ArcadeText
                variant="pixel"
                size={9}
                color={mult >= 2.5 ? neon('yellow') : neon('cyan')}
                glowColor={mult >= 2.5 ? neon('yellow') : neon('cyan')}
              >
                {`MULT x${mult}`}
              </ArcadeText>
            ) : (
              <ArcadeText variant="pixel" size={7} color={colors.textDim}>
                {'5+ FOR x1.5'}
              </ArcadeText>
            )}
          </View>
        </View>
      </SafeAreaView>

      <View
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onLayout={onPlayLayout}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {Array.from({ length: LANE_COUNT }).map((_, i) => (
            <Pressable
              key={i}
              onPress={() => tapLane(i)}
              style={{
                flex: 1,
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: colors.border,
                backgroundColor: i % 2 === 0 ? '#0c0c18' : '#0a0a14',
              }}
            />
          ))}
        </View>

        {/* Hit line. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: HIT_Y - 2,
            height: 4,
            backgroundColor: ACCENT,
            shadowColor: ACCENT,
            shadowOpacity: 0.9,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        {/* Hit-zone glow. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: HIT_Y - HIT_WINDOW_PX,
            height: HIT_WINDOW_PX,
            backgroundColor: 'rgba(255,234,0,0.04)',
          }}
        />

        {/* Tiles. */}
        {tiles.map((tile) => {
          const laneColor = tile.offKey ? OFFKEY_COLOR : LANE_COLORS[tile.lane];
          if (tile.hitAt && tile.hitDelta != null) {
            const age = renderNow - tile.hitAt;
            const opacity = clamp(1 - age / 240, 0, 1);
            // Off-key tap shows DON'T TAP.
            if (tile.offKey) {
              return (
                <View
                  key={tile.id}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: tile.lane * LANE_W,
                    top: HIT_Y - 30,
                    width: LANE_W,
                    alignItems: 'center',
                    opacity,
                  }}
                >
                  <ArcadeText variant="pixel" size={10} color={OFFKEY_COLOR} glowColor={OFFKEY_COLOR}>
                    {'OFF KEY'}
                  </ArcadeText>
                </View>
              );
            }
            return (
              <View
                key={tile.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: tile.lane * LANE_W,
                  top: HIT_Y - tile.height / 2 - 10,
                  width: LANE_W,
                  alignItems: 'center',
                  opacity,
                }}
              >
                <ArcadeText
                  variant="mono"
                  size={tile.hitPerfect ? 22 : 18}
                  color={tile.hitPerfect ? neon('yellow') : neon('green')}
                  glowColor={tile.hitPerfect ? neon('yellow') : neon('green')}
                >
                  {`+${tile.hitDelta}`}
                </ArcadeText>
                {tile.hitPerfect ? (
                  <ArcadeText
                    variant="pixel"
                    size={8}
                    color={neon('yellow')}
                    glowColor={neon('yellow')}
                  >
                    {'PERFECT'}
                  </ArcadeText>
                ) : null}
              </View>
            );
          }

          const progress = (renderNow - tile.spawnedAt) / tile.fallMs;
          const centerY = progress * HIT_Y;
          const top = centerY - tile.height / 2;
          if (top > playH) return null;

          const distToLine = Math.abs(centerY - HIT_Y);
          const inWindow = distToLine <= HIT_WINDOW_PX;
          return (
            <View
              key={tile.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: tile.lane * LANE_W + 6,
                top,
                width: LANE_W - 12,
                height: tile.height,
                backgroundColor: tile.offKey
                  ? 'rgba(255,46,46,0.15)'
                  : 'rgba(255,255,255,0.06)',
                borderWidth: tile.offKey ? 2 : 2,
                borderColor: laneColor,
                borderStyle: tile.offKey ? 'dashed' : 'solid',
                borderRadius: 4,
                shadowColor: laneColor,
                shadowOpacity: inWindow ? 0.9 : 0.4,
                shadowRadius: inWindow ? 12 : 4,
                shadowOffset: { width: 0, height: 0 },
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {tile.offKey ? (
                <ArcadeText variant="pixel" size={9} color={OFFKEY_COLOR} glowColor={OFFKEY_COLOR}>
                  {'X'}
                </ArcadeText>
              ) : null}
            </View>
          );
        })}

        {/* Tap-pad highlights. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            height: 60,
          }}
        >
          {LANE_COLORS.map((c, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                borderTopWidth: 2,
                borderTopColor: c,
                opacity: 0.5,
              }}
            />
          ))}
        </View>

        {/* Countdown overlay. */}
        {phase === 'countdown' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(8,8,15,0.55)',
            }}
          >
            <ArcadeText variant="pixel" size={11} color={colors.textDim}>
              {'GET READY'}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <ArcadeText
              variant="mono"
              size={96}
              color={ACCENT}
              glowColor={ACCENT}
              glowRadius={24}
            >
              {String(countdown)}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <ArcadeText variant="pixel" size={9} color={colors.textMute} align="center">
              {'TAP THE LANE WHEN A TILE\nCROSSES THE YELLOW LINE\n\nLET RED TILES PASS'}
            </ArcadeText>
          </View>
        ) : null}

        {/* Game-over overlay. */}
        {phase === 'over' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(8,8,15,0.78)',
            }}
          >
            <Blink intervalMs={300} minOpacity={0.4}>
              <ArcadeText
                variant="pixel"
                size={22}
                color={neon('red')}
                glowColor={neon('red')}
                align="center"
              >
                {endReason === 'EMPTY'
                  ? 'EMPTY  TAP'
                  : endReason === 'OFFKEY'
                    ? 'OFF  KEY'
                    : 'MISSED'}
              </ArcadeText>
            </Blink>
            <View style={{ height: spacing.md }} />
            <ArcadeText variant="pixel" size={11} color={colors.textDim}>
              {'GAME  OVER'}
            </ArcadeText>
            <View style={{ height: spacing.lg }} />
            <ArcadeText variant="mono" size={36} color={ACCENT} glowColor={ACCENT}>
              {String(score).padStart(6, '0')}
            </ArcadeText>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {`${tilesCleared} TILES · BEST COMBO x${bestCombo}`}
            </ArcadeText>
          </View>
        ) : null}
      </View>

      <ScanlineOverlay opacity={0.05} />
      <InGameExit />
    </View>
  );
}

function comboMultiplier(combo: number): number {
  if (combo >= 30) return 3;
  if (combo >= 20) return 2.5;
  if (combo >= 10) return 2;
  if (combo >= 5) return 1.5;
  return 1;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
