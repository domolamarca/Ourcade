// Slipstream — Flappy-style endless side-scroller with tilt drift, mixed
// obstacle types, moving holes, mine fields, tunnels, and risk-vs-reward
// pickups.
//
// CONTROLS:
//   - TAP anywhere → impulse upward (the Flappy beat)
//   - TILT phone left/right → drift sideways within the play area
//
// OBSTACLES:
//   - TALL walls — vertical bars with 1–3 holes. Two-hole walls split the
//     lane into top/bottom passes that are spread vertically. Past the
//     warm-up, hole positions can oscillate sinusoidally so the gap
//     drifts as it scrolls toward you.
//   - SHORT moving bars (orange) — partial-height obstacles that bob up
//     and down. Don't span the lane, so you fly above or below them.
//     Fill the gaps between TALL walls — sometimes 1, often 2, late game
//     up to 3.
//   - TUNNEL passages — wide horizontal corridors flanked by top + bottom
//     bars. The corridor is wider than a normal hole but tight enough
//     that you have to commit to a height. Corridor center varies per
//     tunnel so you have to adjust altitude.
//
// HAZARDS:
//   - BOMBs (red) — TOUCHING ONE ENDS THE RUN. Spawn singly between
//     obstacles, sometimes paired with an orb to force a path choice.
//   - MINE FIELDS — concentrated bomb clusters in a wider gap. Show up
//     past the warm-up, spaced like a mini-puzzle.
//
// PICKUPS:
//   - ORBs (yellow) — collect to build a streak. Streak tiers unlock
//     score multipliers (5+ → x2, 10+ → x3, 15+ → x4) for several seconds.
//
// VISUAL:
//   - Top + bottom blue death-zone borders so the playable boundary
//     reads as a hazard, not just an empty edge.
//
// SCORE: distance-traveled (px) × current multiplier each frame.

import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Pressable,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

// =====================================================================
// STREAM DEMO MODE — when true, compresses the difficulty ramp so every
// obstacle type appears within the first ~20 seconds. Useful for
// showcase / streaming. Flip to false for normal gameplay.
const DEMO_MODE = true;
const DEMO_TIME_SCALE = DEMO_MODE ? 3 : 1;
// =====================================================================

// ---- Tunables ---------------------------------------------------------
const TICK_MS = 22;

const PLAY_W = 380;
const PLAY_H = 720;

// Visual death-zone borders at top + bottom (cyan/blue bars). The bug
// dies when its center reaches BUG_RADIUS from the edge — so the inner
// edge of the border sits at BORDER_THICKNESS, kept comfortably below
// BUG_RADIUS so the visual barrier overlaps the kill plane.
const BORDER_THICKNESS = 8;

const BUG_RADIUS = 11;
const BUG_X = 110;
const TILT_DRIFT_FACTOR = 90;
const TILT_DAMPING = 0.85;

const GRAVITY = 1100;
const FLAP_VY = -440;
const MAX_FALL_VY = 720;

const SCROLL_INITIAL = 160;
const SCROLL_RAMP_PER_SECOND = 4;
const SCROLL_MAX = 360;

// TALL-wall spacing — tightened from the original 460-640 range, but
// loosened slightly from the previous ultra-tight pass. Sits between
// the two so the rhythm has variety but never goes mind-numbingly wide.
const TALL_GAP_MIN_INITIAL = 420;
const TALL_GAP_MIN_LATE = 330;
const TALL_GAP_MAX_INITIAL = 570;
const TALL_GAP_MAX_LATE = 430;

const SHORT_BAR_WIDTH = 28;

const HOLE_HEIGHT_INITIAL = 160;
const HOLE_HEIGHT_MIN = 95;
const HOLE_HEIGHT_RAMP = 0.6;

const ORB_RADIUS = 9;
const BOMB_RADIUS = 11;

const STREAK_TIERS = [
  { at: 15, multiplier: 4, durationMs: 8000 },
  { at: 10, multiplier: 3, durationMs: 9000 },
  { at: 5, multiplier: 2, durationMs: 10000 },
];

const ACCENT = neon('magenta');
const BORDER_COLOR = neon('blue');
const TUNNEL_COLOR = neon('cyan');
const TRAIL_LEN = 14;

type Phase = 'ready' | 'playing' | 'dead';

// A hole inside a TALL wall. If freq/amp are non-zero, the hole oscillates
// vertically in place.
type Hole = {
  topBase: number;
  bottomBase: number;
  freq: number;
  amp: number;
  phase: number;
};

type Obstacle =
  | {
      kind: 'TALL';
      id: number;
      x: number;
      width: number;
      holes: Hole[];
      passed: boolean;
      hadOrb: boolean;
    }
  | {
      kind: 'SHORT';
      id: number;
      x: number;
      width: number;
      // Bobbing rectangle that doesn't span the lane.
      yBase: number;
      height: number;
      freq: number;
      amp: number;
      phase: number;
      passed: boolean;
      hadOrb: boolean;
    }
  | {
      kind: 'TUNNEL';
      id: number;
      x: number;
      width: number;
      // The corridor is the gap between topBarHeight and PLAY_H - bottomBarHeight.
      // corridorCenter slides up/down per tunnel.
      corridorCenter: number;
      corridorHeight: number;
      passed: boolean;
      hadOrb: boolean;
    };

type Pickup = {
  id: number;
  kind: 'ORB' | 'BOMB';
  x: number;
  y: number;
  collected: boolean;
};

let obstacleIdCounter = 0;
let pickupIdCounter = 0;

const screenDims = Dimensions.get('window');

export default function SlipstreamGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [streakCount, setStreakCount] = useState(0);
  const [endReason, setEndReason] = useState<'CRASHED' | 'BOMB' | null>(null);

  // Refs (game loop state)
  const phaseRef = useRef<Phase>('ready');
  const bugYRef = useRef(PLAY_H / 2);
  const bugXOffsetRef = useRef(0);
  const bugVyRef = useRef(0);
  const bugVxRef = useRef(0);
  const accelRef = useRef({ x: 0, y: 0 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastFrameRef = useRef(Date.now());
  const startTimeRef = useRef(0);
  const distancePxRef = useRef(0);
  const rawScoreRef = useRef(0);
  const elapsedRef = useRef(0);
  const multiplierRef = useRef(1);
  const streakRef = useRef(0);
  const multiplierUntilRef = useRef(0);

  // Spawn-cycle bookkeeping. After each TALL we plan its filler population
  // and the next TALL's gap, then dribble them out as the world scrolls.
  const lastTallXRef = useRef(0);
  const nextTallGapRef = useRef(TALL_GAP_MAX_INITIAL);
  const fillersTotalRef = useRef(0);
  const fillersRemainingRef = useRef(0);
  // Cooldown counters so tunnels and minefields don't pile on top of
  // each other — they get spaced out across normal walls.
  const wallsSinceTunnelRef = useRef(0);
  const wallsSinceMineFieldRef = useRef(0);

  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Accelerometer.setUpdateInterval(20);
    accelSubRef.current = Accelerometer.addListener(({ x, y }) => {
      accelRef.current = { x, y };
    });
    return () => {
      accelSubRef.current?.remove();
      if (rafRef.current) clearTimeout(rafRef.current);
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    };
  }, []);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function startRun() {
    bugYRef.current = PLAY_H / 2;
    bugXOffsetRef.current = 0;
    bugVyRef.current = 0;
    bugVxRef.current = 0;
    obstaclesRef.current = [];
    pickupsRef.current = [];
    trailRef.current = [];
    distancePxRef.current = 0;
    rawScoreRef.current = 0;
    elapsedRef.current = 0;
    multiplierRef.current = 1;
    streakRef.current = 0;
    multiplierUntilRef.current = 0;
    lastTallXRef.current = 0;
    nextTallGapRef.current = TALL_GAP_MAX_INITIAL;
    fillersTotalRef.current = 0;
    fillersRemainingRef.current = 0;
    wallsSinceTunnelRef.current = 0;
    wallsSinceMineFieldRef.current = 0;
    setMultiplier(1);
    setStreakCount(0);
    setScore(0);
    setEndReason(null);
    startTimeRef.current = Date.now();
    setPhaseSafe('playing');
    lastFrameRef.current = Date.now();
    scheduleFrame();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }

  function scheduleFrame() {
    rafRef.current = setTimeout(gameLoop, TICK_MS);
  }

  function gameLoop() {
    if (phaseRef.current !== 'playing') return;
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
    lastFrameRef.current = now;
    elapsedRef.current = (now - startTimeRef.current) / 1000;
    const t = elapsedRef.current;

    // --- Pacing ramps -------------------------------------------------
    const scrollSpeed = clamp(
      SCROLL_INITIAL + t * SCROLL_RAMP_PER_SECOND,
      SCROLL_INITIAL,
      SCROLL_MAX,
    );
    const holeHeight = clamp(
      HOLE_HEIGHT_INITIAL - t * HOLE_HEIGHT_RAMP,
      HOLE_HEIGHT_MIN,
      HOLE_HEIGHT_INITIAL,
    );

    // --- Bug physics --------------------------------------------------
    bugVyRef.current += GRAVITY * dt;
    if (bugVyRef.current > MAX_FALL_VY) bugVyRef.current = MAX_FALL_VY;
    bugYRef.current += bugVyRef.current * dt;

    bugVxRef.current += accelRef.current.x * TILT_DRIFT_FACTOR * dt * 2;
    bugVxRef.current *= Math.pow(TILT_DAMPING, dt * 60);
    bugXOffsetRef.current += bugVxRef.current * dt;

    const drifted = BUG_X + bugXOffsetRef.current;
    if (drifted < BUG_RADIUS + 10) {
      bugXOffsetRef.current = BUG_RADIUS + 10 - BUG_X;
      bugVxRef.current = 0;
    } else if (drifted > PLAY_W - BUG_RADIUS - 10) {
      bugXOffsetRef.current = PLAY_W - BUG_RADIUS - 10 - BUG_X;
      bugVxRef.current = 0;
    }

    // Top/bottom death-zone (the cyan border bars).
    if (
      bugYRef.current < BUG_RADIUS + BORDER_THICKNESS / 2 ||
      bugYRef.current > PLAY_H - BUG_RADIUS - BORDER_THICKNESS / 2
    ) {
      triggerFail('CRASHED');
      return;
    }

    // --- Trail --------------------------------------------------------
    trailRef.current.push({
      x: BUG_X + bugXOffsetRef.current,
      y: bugYRef.current,
    });
    if (trailRef.current.length > TRAIL_LEN) trailRef.current.shift();

    // --- Move world ---------------------------------------------------
    for (const o of obstaclesRef.current) o.x -= scrollSpeed * dt;
    for (const p of pickupsRef.current) p.x -= scrollSpeed * dt;

    const distGain = scrollSpeed * dt;
    distancePxRef.current += distGain;
    rawScoreRef.current += distGain * multiplierRef.current;
    setScore(Math.round(rawScoreRef.current));

    // --- Spawn new content -------------------------------------------
    // Spawn decisions use the (optionally compressed) effective time so
    // demo mode pulls all the obstacle types in within ~20 seconds.
    // Animation phases keep using real `t` so visuals stay smooth.
    const effSec = t * DEMO_TIME_SCALE;
    spawnIfNeeded(effSec, holeHeight);

    // --- Cull + check collisions -------------------------------------
    const bugPx = BUG_X + bugXOffsetRef.current;
    for (const o of obstaclesRef.current) {
      if (o.kind === 'TALL') {
        if (!o.passed && o.x + o.width < bugPx - BUG_RADIUS) {
          o.passed = true;
          if (!o.hadOrb && streakRef.current > 0) {
            streakRef.current = 0;
            setStreakCount(0);
          }
        }
        if (
          bugPx + BUG_RADIUS > o.x &&
          bugPx - BUG_RADIUS < o.x + o.width
        ) {
          const inHole = o.holes.some((h) => {
            const offset =
              h.amp === 0 ? 0 : Math.sin(t * h.freq + h.phase) * h.amp;
            const top = h.topBase + offset;
            const bottom = h.bottomBase + offset;
            return (
              bugYRef.current - BUG_RADIUS > top &&
              bugYRef.current + BUG_RADIUS < bottom
            );
          });
          if (!inHole) {
            triggerFail('CRASHED');
            return;
          }
        }
      } else if (o.kind === 'TUNNEL') {
        if (!o.passed && o.x + o.width < bugPx - BUG_RADIUS) {
          o.passed = true;
        }
        if (
          bugPx + BUG_RADIUS > o.x &&
          bugPx - BUG_RADIUS < o.x + o.width
        ) {
          const corridorTop = o.corridorCenter - o.corridorHeight / 2;
          const corridorBottom = o.corridorCenter + o.corridorHeight / 2;
          if (
            bugYRef.current - BUG_RADIUS < corridorTop ||
            bugYRef.current + BUG_RADIUS > corridorBottom
          ) {
            triggerFail('CRASHED');
            return;
          }
        }
      } else {
        // SHORT moving bar.
        if (!o.passed && o.x + o.width < bugPx - BUG_RADIUS) {
          o.passed = true;
        }
        if (
          bugPx + BUG_RADIUS > o.x &&
          bugPx - BUG_RADIUS < o.x + o.width
        ) {
          const offset = Math.sin(t * o.freq + o.phase) * o.amp;
          const top = o.yBase + offset;
          const bottom = top + o.height;
          if (
            bugYRef.current + BUG_RADIUS > top &&
            bugYRef.current - BUG_RADIUS < bottom
          ) {
            triggerFail('CRASHED');
            return;
          }
        }
      }
    }
    obstaclesRef.current = obstaclesRef.current.filter(
      (o) => o.x + o.width > -50,
    );

    // Pickup interactions.
    for (const p of pickupsRef.current) {
      if (p.collected) continue;
      const dx = bugPx - p.x;
      const dy = bugYRef.current - p.y;
      const r = p.kind === 'BOMB' ? BOMB_RADIUS : ORB_RADIUS;
      if (Math.hypot(dx, dy) < BUG_RADIUS + r) {
        if (p.kind === 'BOMB') {
          p.collected = true;
          triggerFail('BOMB');
          return;
        }
        // ORB.
        p.collected = true;
        streakRef.current += 1;
        setStreakCount(streakRef.current);
        const nextWall = obstaclesRef.current.find(
          (o) => o.kind === 'TALL' && !o.passed,
        );
        if (nextWall) (nextWall as Extract<Obstacle, { kind: 'TALL' }>).hadOrb = true;
        const tier = STREAK_TIERS.find((tt) => streakRef.current >= tt.at);
        if (tier) {
          if (tier.multiplier > multiplierRef.current) {
            multiplierRef.current = tier.multiplier;
            setMultiplier(tier.multiplier);
            multiplierUntilRef.current = Date.now() + tier.durationMs;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          } else {
            multiplierUntilRef.current = Date.now() + tier.durationMs;
          }
        }
        Haptics.selectionAsync().catch(() => {});
      }
    }
    pickupsRef.current = pickupsRef.current.filter(
      (p) => p.x > -30 && !p.collected,
    );

    // Multiplier expiry.
    if (multiplierRef.current > 1 && Date.now() > multiplierUntilRef.current) {
      multiplierRef.current = 1;
      setMultiplier(1);
      streakRef.current = 0;
      setStreakCount(0);
    }

    setTick((tick) => tick + 1);
    scheduleFrame();
  }

  // Spawning policy: keep the rightmost obstacle within ~PLAY_W of the
  // right edge. When we need a new obstacle, decide whether it's the next
  // TALL wall (or a TUNNEL stand-in), or a SHORT filler in the gap.
  function spawnIfNeeded(elapsedSec: number, holeHeight: number) {
    const last = obstaclesRef.current[obstaclesRef.current.length - 1];
    const lastX = last ? last.x : 0;
    if (last && lastX > PLAY_W + 20) return;

    if (!last) {
      // First obstacle on a fresh run — TALL right past the right edge.
      const tall = makeTall(PLAY_W + 60, holeHeight, elapsedSec);
      obstaclesRef.current.push(tall);
      lastTallXRef.current = tall.x;
      planNextGapAndFillers(elapsedSec);
      return;
    }

    if (fillersRemainingRef.current > 0) {
      // Spawn a SHORT filler at a fractional position in the current gap.
      const idx = fillersTotalRef.current - fillersRemainingRef.current;
      const slotFrac = (idx + 1) / (fillersTotalRef.current + 1);
      const jitter = (Math.random() - 0.5) * 0.18;
      const frac = clamp(slotFrac + jitter, 0.12, 0.88);
      const x = lastTallXRef.current + nextTallGapRef.current * frac;
      const filler = makeShort(x, elapsedSec);
      obstaclesRef.current.push(filler);
      fillersRemainingRef.current -= 1;
      // Pickup tied to this filler slot.
      maybeSpawnPickup(x, elapsedSec);
      return;
    }

    // No fillers left — spawn the next major obstacle. Either TALL or TUNNEL.
    const newX = lastTallXRef.current + nextTallGapRef.current;

    // TUNNEL gating: only past warm-up, with cooldown so they don't
    // chain right after each other.
    const tunnelChance = tunnelChanceFor(elapsedSec, wallsSinceTunnelRef.current);
    const useTunnel = Math.random() < tunnelChance;

    if (useTunnel) {
      const tunnel = makeTunnel(newX, elapsedSec);
      obstaclesRef.current.push(tunnel);
      lastTallXRef.current = newX + tunnel.width - 32; // anchor next gap from the tunnel's exit
      wallsSinceTunnelRef.current = 0;
      wallsSinceMineFieldRef.current += 1;
    } else {
      const tall = makeTall(newX, holeHeight, elapsedSec);
      obstaclesRef.current.push(tall);
      lastTallXRef.current = newX;
      wallsSinceTunnelRef.current += 1;
      wallsSinceMineFieldRef.current += 1;

      // Pickup before the wall — sometimes a guarded orb-vs-bomb pair.
      maybeSpawnPickup(newX - 60 - Math.random() * 40, elapsedSec);
    }

    planNextGapAndFillers(elapsedSec);

    // After planning, decide if this gap should be a MINEFIELD. Mine
    // fields override the normal pickup spawn for this gap with a cluster
    // of bombs.
    const mineChance = mineFieldChanceFor(elapsedSec, wallsSinceMineFieldRef.current);
    if (Math.random() < mineChance) {
      // Stretch the next gap so the player has room to navigate.
      nextTallGapRef.current = Math.max(nextTallGapRef.current, 480);
      // Skip filler so the bombs are the only hazards in the gap.
      fillersTotalRef.current = 0;
      fillersRemainingRef.current = 0;
      spawnMineField(lastTallXRef.current, nextTallGapRef.current, elapsedSec);
      wallsSinceMineFieldRef.current = 0;
    }
  }

  function planNextGapAndFillers(elapsedSec: number) {
    const ramp = clamp(elapsedSec / 60, 0, 1);
    const gapMin = TALL_GAP_MIN_INITIAL + (TALL_GAP_MIN_LATE - TALL_GAP_MIN_INITIAL) * ramp;
    const gapMax = TALL_GAP_MAX_INITIAL + (TALL_GAP_MAX_LATE - TALL_GAP_MAX_INITIAL) * ramp;
    nextTallGapRef.current = gapMin + Math.random() * (gapMax - gapMin);

    // Filler frequency — split the difference: more than the original
    // (which routinely had a quiet gap) but less than the aggressive
    // pass (which packed every gap). Late game still allows 3 fillers
    // but only when the run is genuinely long.
    let fillerCount = 0;
    if (elapsedSec < 8) {
      fillerCount = 0;
    } else if (elapsedSec < 19) {
      fillerCount = Math.random() < 0.62 ? 1 : 0;
    } else if (elapsedSec < 38) {
      const r = Math.random();
      fillerCount = r < 0.39 ? 1 : r < 0.78 ? 2 : 0;
    } else if (elapsedSec < 60) {
      const r = Math.random();
      fillerCount = r < 0.32 ? 1 : r < 0.85 ? 2 : 3;
    } else {
      const r = Math.random();
      fillerCount = r < 0.25 ? 1 : r < 0.78 ? 2 : 3;
    }

    // Cap by gap room — each filler needs ~140px of breathing space.
    const maxFromGap = Math.max(0, Math.floor((nextTallGapRef.current - 200) / 140));
    if (fillerCount > maxFromGap) fillerCount = maxFromGap;

    fillersTotalRef.current = fillerCount;
    fillersRemainingRef.current = fillerCount;
  }

  function maybeSpawnPickup(x: number, elapsedSec: number) {
    const bombChance = bombChanceFor(elapsedSec);
    const r = Math.random();
    if (r < bombChance) {
      const y = clamp(70 + Math.random() * (PLAY_H - 140), 60, PLAY_H - 60);
      pickupsRef.current.push({
        id: ++pickupIdCounter,
        kind: 'BOMB',
        x,
        y,
        collected: false,
      });
      // Sometimes pair with an orb above/below to force a choice.
      if (Math.random() < 0.45) {
        const dy = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30);
        const oy = clamp(y + dy, 60, PLAY_H - 60);
        pickupsRef.current.push({
          id: ++pickupIdCounter,
          kind: 'ORB',
          x: x + (Math.random() - 0.5) * 30,
          y: oy,
          collected: false,
        });
      }
      return;
    }
    if (r < bombChance + 0.6) {
      const y = clamp(70 + Math.random() * (PLAY_H - 140), 60, PLAY_H - 60);
      pickupsRef.current.push({
        id: ++pickupIdCounter,
        kind: 'ORB',
        x,
        y,
        collected: false,
      });
    }
  }

  function spawnMineField(startX: number, gap: number, elapsedSec: number) {
    // Cluster of 4–6 bombs across most of the gap, in two staggered rows
    // so the player has to weave through. The rows leave a navigable
    // serpentine path; we don't try to guarantee a clean line, so a
    // hesitating player will hit one.
    const count = Math.random() < 0.5 ? 4 : Math.random() < 0.7 ? 5 : 6;
    const startCol = startX + 80;
    const colWidth = (gap - 160) / count;
    const yTop = 130;
    const yBottom = PLAY_H - 130;
    for (let i = 0; i < count; i++) {
      const x = startCol + colWidth * i + (Math.random() - 0.5) * 10;
      const y = i % 2 === 0 ? yTop + Math.random() * 60 : yBottom - Math.random() * 60;
      pickupsRef.current.push({
        id: ++pickupIdCounter,
        kind: 'BOMB',
        x,
        y,
        collected: false,
      });
    }
    // Toss in one orb in the middle as bait — picking it up requires
    // crossing the field cleanly.
    if (elapsedSec > 25 && Math.random() < 0.6) {
      pickupsRef.current.push({
        id: ++pickupIdCounter,
        kind: 'ORB',
        x: startCol + (gap - 160) / 2,
        y: PLAY_H / 2 + (Math.random() - 0.5) * 60,
        collected: false,
      });
    }
  }

  function bombChanceFor(elapsedSec: number): number {
    // Bombs first appear around 10s (between orig 12s and aggressive 7s).
    if (elapsedSec < 10) return 0;
    if (elapsedSec < 22) return 0.15;
    if (elapsedSec < 40) return 0.26;
    if (elapsedSec < 60) return 0.36;
    return 0.40;
  }

  function tunnelChanceFor(elapsedSec: number, wallsSince: number): number {
    if (elapsedSec < 18) return 0;
    // Tighter cooldown in demo mode so tunnels actually fire in 20s.
    if (wallsSince < (DEMO_MODE ? 1 : 2)) return 0;
    if (elapsedSec < 35) return DEMO_MODE ? 0.30 : 0.15;
    if (elapsedSec < 60) return DEMO_MODE ? 0.40 : 0.24;
    return DEMO_MODE ? 0.45 : 0.28;
  }

  function mineFieldChanceFor(elapsedSec: number, wallsSince: number): number {
    if (elapsedSec < 25) return 0;
    if (wallsSince < (DEMO_MODE ? 2 : 4)) return 0;
    if (elapsedSec < 50) return DEMO_MODE ? 0.25 : 0.08;
    if (elapsedSec < 80) return DEMO_MODE ? 0.35 : 0.14;
    return DEMO_MODE ? 0.40 : 0.18;
  }

  function handleTap(_e: GestureResponderEvent) {
    if (phaseRef.current === 'ready') {
      startRun();
      return;
    }
    if (phaseRef.current === 'playing') {
      bugVyRef.current = FLAP_VY;
      Haptics.selectionAsync().catch(() => {});
    }
  }

  function triggerFail(reason: 'CRASHED' | 'BOMB') {
    if (phaseRef.current !== 'playing') return;
    setPhaseSafe('dead');
    setEndReason(reason);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    finishTimeoutRef.current = setTimeout(() => finalize(), 1600);
  }

  function finalize() {
    router.replace({
      pathname: '/result/[id]',
      params: {
        id: 'slipstream',
        score: String(Math.round(rawScoreRef.current)),
      },
    });
  }

  // ---- Render --------------------------------------------------------
  const elapsedRender = elapsedRef.current;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable onPress={handleTap} style={{ flex: 1 }}>
        {/* HUD */}
        <SafeAreaView edges={['top']} pointerEvents="none">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              paddingLeft: 44, // room for EXIT chip on the left
            }}
          >
            <View>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'SCORE'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={neon('yellow')}
                glowColor={neon('yellow')}
              >
                {String(score).padStart(6, '0')}
              </ArcadeText>
              {phase === 'playing' && multiplier > 1 ? (
                <ArcadeText
                  variant="pixel"
                  size={11}
                  color={mulColor(multiplier)}
                  glowColor={mulColor(multiplier)}
                >
                  {`x${multiplier} STREAK`}
                </ArcadeText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'STREAK'}
              </ArcadeText>
              <ArcadeText variant="mono" size={22} color={ACCENT} glowColor={ACCENT}>
                {String(streakCount).padStart(2, '0')}
              </ArcadeText>
            </View>
          </View>
        </SafeAreaView>

        <View
          style={{
            flex: 1,
            marginHorizontal: 4,
            backgroundColor: '#040408',
            borderWidth: 2,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${PLAY_W} ${PLAY_H}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <BgGrid scrollX={(distancePxRef.current * 0.3) % 60} />

            {/* Top + bottom blue death-zone borders. Drawn before the
                obstacles so walls visually "sit between" the borders. */}
            <DeathBorders />

            {/* Obstacles */}
            {obstaclesRef.current.map((o) =>
              o.kind === 'TALL' ? (
                <TallWallView key={o.id} wall={o} t={elapsedRender} />
              ) : o.kind === 'TUNNEL' ? (
                <TunnelView key={o.id} tunnel={o} />
              ) : (
                <ShortBarView key={o.id} bar={o} t={elapsedRender} />
              ),
            )}

            {/* Pickups */}
            {pickupsRef.current.map((p) =>
              p.collected ? null : p.kind === 'ORB' ? (
                <G key={p.id}>
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={ORB_RADIUS + 5}
                    fill={neon('yellow')}
                    fillOpacity={0.18}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={ORB_RADIUS}
                    fill={neon('yellow')}
                    fillOpacity={0.9}
                  />
                </G>
              ) : (
                <G key={p.id}>
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={BOMB_RADIUS + 7}
                    fill={neon('red')}
                    fillOpacity={0.22}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={BOMB_RADIUS}
                    fill={neon('red')}
                    fillOpacity={0.95}
                  />
                  <Line
                    x1={p.x - 4}
                    y1={p.y - 4}
                    x2={p.x + 4}
                    y2={p.y + 4}
                    stroke="#08080f"
                    strokeWidth={2}
                  />
                  <Line
                    x1={p.x + 4}
                    y1={p.y - 4}
                    x2={p.x - 4}
                    y2={p.y + 4}
                    stroke="#08080f"
                    strokeWidth={2}
                  />
                </G>
              ),
            )}

            {/* Trail */}
            {trailRef.current.map((p, i) => {
              const tNorm = i / TRAIL_LEN;
              return (
                <Circle
                  key={`tr-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={(BUG_RADIUS - 2) * tNorm + 2}
                  fill={ACCENT}
                  fillOpacity={tNorm * 0.5}
                />
              );
            })}

            {/* Bug */}
            <Circle
              cx={BUG_X + bugXOffsetRef.current}
              cy={bugYRef.current}
              r={BUG_RADIUS + 6}
              fill={ACCENT}
              fillOpacity={0.3}
            />
            <Circle
              cx={BUG_X + bugXOffsetRef.current}
              cy={bugYRef.current}
              r={BUG_RADIUS}
              fill={ACCENT}
            />
            <Circle
              cx={BUG_X + bugXOffsetRef.current - 2}
              cy={bugYRef.current - 2}
              r={BUG_RADIUS / 2.5}
              fill="white"
              fillOpacity={0.7}
            />
          </Svg>

          {/* READY overlay */}
          {phase === 'ready' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(8,8,15,0.5)',
              }}
            >
              <ArcadeText
                variant="pixel"
                size={20}
                color={ACCENT}
                glowColor={ACCENT}
                align="center"
              >
                {'BOUNCE'}
              </ArcadeText>
              <View style={{ height: spacing.md }} />
              <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
                {'TAP TO FLAP\nTILT TO DRIFT\nGRAB ORBS · DODGE BOMBS'}
              </ArcadeText>
              <View style={{ height: spacing.lg }} />
              <Blink>
                <ArcadeText
                  variant="pixel"
                  size={11}
                  color={neon('yellow')}
                  glowColor={neon('yellow')}
                >
                  {'TAP TO BEGIN'}
                </ArcadeText>
              </Blink>
            </View>
          ) : null}

          {/* DEAD overlay */}
          {phase === 'dead' ? (
            <View
              style={{
                position: 'absolute',
                top: '40%',
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
            >
              <Blink intervalMs={300} minOpacity={0.3}>
                <ArcadeText
                  variant="pixel"
                  size={22}
                  color={neon('red')}
                  glowColor={neon('red')}
                  glowRadius={14}
                  align="center"
                >
                  {endReason === 'BOMB' ? 'BOOM' : 'CRASHED'}
                </ArcadeText>
              </Blink>
              <View style={{ height: spacing.sm }} />
              <ArcadeText variant="mono" size={20} color={colors.textDim}>
                {String(score)}
              </ArcadeText>
            </View>
          ) : null}

          <ScanlineOverlay opacity={0.05} />
        </View>
      </Pressable>
      <InGameExit />
    </View>
  );
}

// =====================================================================
// DeathBorders — top + bottom blue bars marking the kill zone. Visually
// reads as a wall the bug must avoid.
function DeathBorders() {
  return (
    <G>
      {/* Top */}
      <Rect
        x={0}
        y={0}
        width={PLAY_W}
        height={BORDER_THICKNESS}
        fill={BORDER_COLOR}
        fillOpacity={0.95}
      />
      <Rect
        x={0}
        y={BORDER_THICKNESS}
        width={PLAY_W}
        height={3}
        fill={BORDER_COLOR}
        fillOpacity={0.35}
      />
      {/* Bottom */}
      <Rect
        x={0}
        y={PLAY_H - BORDER_THICKNESS}
        width={PLAY_W}
        height={BORDER_THICKNESS}
        fill={BORDER_COLOR}
        fillOpacity={0.95}
      />
      <Rect
        x={0}
        y={PLAY_H - BORDER_THICKNESS - 3}
        width={PLAY_W}
        height={3}
        fill={BORDER_COLOR}
        fillOpacity={0.35}
      />
      {/* Subtle hazard stripes inside the borders to read as "no-go" */}
      {Array.from({ length: 12 }).map((_, i) => (
        <Rect
          key={`tt-${i}`}
          x={i * 36}
          y={1}
          width={18}
          height={BORDER_THICKNESS - 2}
          fill="#08080f"
          fillOpacity={0.4}
        />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <Rect
          key={`bt-${i}`}
          x={i * 36 + 18}
          y={PLAY_H - BORDER_THICKNESS + 1}
          width={18}
          height={BORDER_THICKNESS - 2}
          fill="#08080f"
          fillOpacity={0.4}
        />
      ))}
    </G>
  );
}

// =====================================================================
// TallWallView — vertical neon-bordered wall with 1-3 holes (any of which
// may oscillate vertically in place).
function TallWallView({
  wall,
  t,
}: {
  wall: Extract<Obstacle, { kind: 'TALL' }>;
  t: number;
}) {
  const liveHoles = wall.holes
    .map((h) => {
      const offset = h.amp === 0 ? 0 : Math.sin(t * h.freq + h.phase) * h.amp;
      return { top: h.topBase + offset, bottom: h.bottomBase + offset };
    })
    .sort((a, b) => a.top - b.top);

  const segments: Array<{ top: number; height: number }> = [];
  let cursor = BORDER_THICKNESS;
  for (const h of liveHoles) {
    if (h.top > cursor) segments.push({ top: cursor, height: h.top - cursor });
    cursor = Math.max(cursor, h.bottom);
  }
  if (cursor < PLAY_H - BORDER_THICKNESS) {
    segments.push({ top: cursor, height: PLAY_H - BORDER_THICKNESS - cursor });
  }

  const moving = wall.holes.some((h) => h.amp > 0);
  const wallColor = moving ? neon('purple') : neon('cyan');

  return (
    <G>
      {segments.map((s, i) => (
        <G key={i}>
          <Rect
            x={wall.x - 2}
            y={s.top - 2}
            width={wall.width + 4}
            height={s.height + 4}
            fill={wallColor}
            fillOpacity={0.18}
          />
          <Rect
            x={wall.x}
            y={s.top}
            width={wall.width}
            height={s.height}
            fill={wallColor}
            fillOpacity={0.85}
          />
          <Rect
            x={wall.x + 4}
            y={s.top + 4}
            width={Math.max(0, wall.width - 8)}
            height={Math.max(0, s.height - 8)}
            fill="#040408"
            fillOpacity={0.4}
          />
        </G>
      ))}
    </G>
  );
}

// =====================================================================
// ShortBarView — partial-height moving bar that doesn't span the lane.
function ShortBarView({
  bar,
  t,
}: {
  bar: Extract<Obstacle, { kind: 'SHORT' }>;
  t: number;
}) {
  const offset = Math.sin(t * bar.freq + bar.phase) * bar.amp;
  const top = bar.yBase + offset;
  return (
    <G>
      <Rect
        x={bar.x - 2}
        y={top - 2}
        width={bar.width + 4}
        height={bar.height + 4}
        fill={neon('orange')}
        fillOpacity={0.18}
      />
      <Rect
        x={bar.x}
        y={top}
        width={bar.width}
        height={bar.height}
        fill={neon('orange')}
        fillOpacity={0.9}
      />
      <Rect
        x={bar.x + 3}
        y={top + 3}
        width={Math.max(0, bar.width - 6)}
        height={Math.max(0, bar.height - 6)}
        fill="#040408"
        fillOpacity={0.35}
      />
      <Rect
        x={bar.x - 4}
        y={top - 2}
        width={bar.width + 8}
        height={3}
        fill={neon('orange')}
      />
      <Rect
        x={bar.x - 4}
        y={top + bar.height - 1}
        width={bar.width + 8}
        height={3}
        fill={neon('orange')}
      />
    </G>
  );
}

// =====================================================================
// TunnelView — wide horizontal passage. Top + bottom slabs span the play
// area's vertical extent; the corridor between them is the safe zone.
function TunnelView({
  tunnel,
}: {
  tunnel: Extract<Obstacle, { kind: 'TUNNEL' }>;
}) {
  const top = tunnel.corridorCenter - tunnel.corridorHeight / 2;
  const bottom = tunnel.corridorCenter + tunnel.corridorHeight / 2;
  return (
    <G>
      {/* Top slab */}
      <Rect
        x={tunnel.x - 2}
        y={BORDER_THICKNESS - 2}
        width={tunnel.width + 4}
        height={top - BORDER_THICKNESS + 2}
        fill={TUNNEL_COLOR}
        fillOpacity={0.18}
      />
      <Rect
        x={tunnel.x}
        y={BORDER_THICKNESS}
        width={tunnel.width}
        height={Math.max(0, top - BORDER_THICKNESS)}
        fill={TUNNEL_COLOR}
        fillOpacity={0.85}
      />
      <Rect
        x={tunnel.x + 4}
        y={BORDER_THICKNESS + 4}
        width={Math.max(0, tunnel.width - 8)}
        height={Math.max(0, top - BORDER_THICKNESS - 8)}
        fill="#040408"
        fillOpacity={0.4}
      />
      {/* Bottom slab */}
      <Rect
        x={tunnel.x - 2}
        y={bottom - 2}
        width={tunnel.width + 4}
        height={PLAY_H - BORDER_THICKNESS - bottom + 4}
        fill={TUNNEL_COLOR}
        fillOpacity={0.18}
      />
      <Rect
        x={tunnel.x}
        y={bottom}
        width={tunnel.width}
        height={Math.max(0, PLAY_H - BORDER_THICKNESS - bottom)}
        fill={TUNNEL_COLOR}
        fillOpacity={0.85}
      />
      <Rect
        x={tunnel.x + 4}
        y={bottom + 4}
        width={Math.max(0, tunnel.width - 8)}
        height={Math.max(0, PLAY_H - BORDER_THICKNESS - bottom - 8)}
        fill="#040408"
        fillOpacity={0.4}
      />
      {/* Entrance/exit chevrons inside the corridor for readability */}
      <Line
        x1={tunnel.x + 6}
        y1={tunnel.corridorCenter}
        x2={tunnel.x + tunnel.width - 6}
        y2={tunnel.corridorCenter}
        stroke={TUNNEL_COLOR}
        strokeWidth={1}
        strokeOpacity={0.35}
        strokeDasharray="4,6"
      />
    </G>
  );
}

function BgGrid({ scrollX }: { scrollX: number }) {
  const cols = Math.ceil(PLAY_W / 60) + 1;
  const rows = Math.ceil(PLAY_H / 60) + 1;
  return (
    <G opacity={0.08}>
      {Array.from({ length: cols }).map((_, c) => (
        <Line
          key={`vc-${c}`}
          x1={c * 60 - scrollX}
          y1={0}
          x2={c * 60 - scrollX}
          y2={PLAY_H}
          stroke={neon('cyan')}
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: rows }).map((_, r) => (
        <Line
          key={`hr-${r}`}
          x1={0}
          y1={r * 60}
          x2={PLAY_W}
          y2={r * 60}
          stroke={neon('cyan')}
          strokeWidth={1}
        />
      ))}
    </G>
  );
}

// =====================================================================
// Wall generator — picks 1, 2, or 3 holes, biased toward 2 once past the
// warm-up. Two-hole walls spread the holes vertically (one in the upper
// half, one in the lower half). Late-game walls have a chance to be
// "moving" — each hole oscillates vertically as the wall scrolls.
function makeTall(
  x: number,
  holeHeight: number,
  elapsedSec: number,
): Extract<Obstacle, { kind: 'TALL' }> {
  const width = 32;
  const minTop = BORDER_THICKNESS + 22;
  const maxBottom = PLAY_H - BORDER_THICKNESS - 22;
  const usable = maxBottom - minTop;

  // Hole count distribution — sits between the original (which kept
  // 1-hole walls until 22s) and the very-aggressive bump that put 2-hole
  // walls at 6s. 2-hole walls show up around 7s, become the default by
  // ~19s, and 3-hole walls start sneaking in past ~20s.
  const r = Math.random();
  let holeCount: number;
  if (elapsedSec < 7) {
    holeCount = 1;
  } else if (elapsedSec < 19) {
    holeCount = r < 0.60 ? 1 : 2;
  } else if (elapsedSec < 42) {
    holeCount = r < 0.30 ? 1 : r < 0.85 ? 2 : 3;
  } else {
    holeCount = r < 0.12 ? 1 : r < 0.68 ? 2 : 3;
  }

  // Moving holes — first appear at 15s (between the orig 18s and the
  // aggressive 12s), then ramp gradually.
  const movingChance =
    elapsedSec < 15 ? 0
    : elapsedSec < 30 ? 0.28
    : elapsedSec < 52 ? 0.47
    : 0.62;
  const moving = Math.random() < movingChance;
  const amp = moving ? 18 + Math.random() * Math.min(34, holeHeight * 0.25) : 0;
  const freq = moving ? 1.2 + Math.random() * 1.4 : 0;

  const holes: Hole[] = [];

  if (holeCount === 1) {
    const top = minTop + Math.random() * (usable - holeHeight);
    holes.push(makeHole(top, top + holeHeight, freq, amp));
  } else if (holeCount === 2) {
    const minDivider = 70;
    const half = minTop + usable / 2;
    const upperMaxTop = half - holeHeight - minDivider / 2;
    const lowerMinTop = half + minDivider / 2;
    const upperTop = clamp(
      minTop + Math.random() * Math.max(0, upperMaxTop - minTop),
      minTop,
      Math.max(minTop, upperMaxTop),
    );
    const lowerMaxTop = maxBottom - holeHeight;
    const lowerTop = clamp(
      lowerMinTop + Math.random() * Math.max(0, lowerMaxTop - lowerMinTop),
      lowerMinTop,
      Math.max(lowerMinTop, lowerMaxTop),
    );
    holes.push(makeHole(upperTop, upperTop + holeHeight, freq, amp));
    holes.push(makeHole(lowerTop, lowerTop + holeHeight, freq, amp));
  } else {
    const slot = (usable - 3 * holeHeight) / 4;
    let cursor = minTop + slot;
    for (let i = 0; i < 3; i++) {
      const jitter = (Math.random() - 0.5) * slot * 0.4;
      const top = clamp(cursor + jitter, minTop, maxBottom - holeHeight);
      holes.push(makeHole(top, top + holeHeight, freq, amp));
      cursor += holeHeight + slot;
    }
  }

  return {
    kind: 'TALL',
    id: ++obstacleIdCounter,
    x,
    width,
    holes,
    passed: false,
    hadOrb: false,
  };
}

function makeHole(top: number, bottom: number, freq: number, amp: number): Hole {
  return {
    topBase: top,
    bottomBase: bottom,
    freq,
    amp,
    phase: Math.random() * Math.PI * 2,
  };
}

// SHORT moving bar — height 70-130, oscillates over 50–60% of the play
// area's vertical range. Bug must fly above OR below it.
function makeShort(
  x: number,
  elapsedSec: number,
): Extract<Obstacle, { kind: 'SHORT' }> {
  const height = 70 + Math.random() * 60;
  const ampMax = (PLAY_H - height - 80) / 2;
  const amp = ampMax * (0.55 + Math.random() * 0.35);
  const yBase = (PLAY_H - height) / 2;
  const freq = 1.4 + Math.random() * (elapsedSec < 25 ? 0.6 : 1.4);
  return {
    kind: 'SHORT',
    id: ++obstacleIdCounter,
    x,
    width: SHORT_BAR_WIDTH,
    yBase,
    height,
    freq,
    amp,
    phase: Math.random() * Math.PI * 2,
    passed: false,
    hadOrb: false,
  };
}

// TUNNEL — wide passage with corridor between top and bottom slabs.
// Corridor center varies so consecutive tunnels make the bug climb/dive.
function makeTunnel(
  x: number,
  elapsedSec: number,
): Extract<Obstacle, { kind: 'TUNNEL' }> {
  // Width and corridor height tighten with time.
  const width = 100 + Math.random() * 50; // 100–150
  const ramp = clamp(elapsedSec / 60, 0, 1);
  const corridorHeight = clamp(
    270 - ramp * 60 + (Math.random() - 0.5) * 30, // 240 → 180-ish
    170,
    310,
  );
  // Place corridor center within the playable band (with margin so the
  // top/bottom slabs aren't degenerate).
  const margin = corridorHeight / 2 + 24;
  const minCenter = BORDER_THICKNESS + margin;
  const maxCenter = PLAY_H - BORDER_THICKNESS - margin;
  const corridorCenter = minCenter + Math.random() * Math.max(0, maxCenter - minCenter);
  return {
    kind: 'TUNNEL',
    id: ++obstacleIdCounter,
    x,
    width,
    corridorCenter,
    corridorHeight,
    passed: false,
    hadOrb: false,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function mulColor(m: number): string {
  if (m >= 4) return neon('yellow');
  if (m >= 3) return neon('cyan');
  if (m >= 2) return neon('green');
  return colors.textDim;
}
