// VECTOR — vanishing-point arcade shooter.
//
// Your ship sits at the bottom of the screen flying toward a vanishing
// point. Asteroids spawn at the VP and rush out at you. Tilt the phone
// to slide left/right; tap anywhere to fire. Three lives, no cap on
// run length — survive long enough and the tunnel turns lethal.
//
// Coordinate system:
//   z ∈ [0, 1]   1 = at the vanishing point, 0 = at the player plane
//   x ∈ [-W, W]  world X relative to the lane center
//
// Screen projection:
//   t = 1 - z                (0 at VP, 1 at player)
//   screenX = vp.x + worldX * t
//   screenY = vp.y + (playH - vp.y) * t
//   size    = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * t
//
// Bullets travel z 0 → 1 at high speed; asteroids travel z 1 → 0
// at increasing speed as elapsed time grows.
//
// Score:
//   +1 per second alive
//   +50 per asteroid blasted (× combo multiplier on consecutive blasts)
//   Combo tiers: 5+ x1.5, 10+ x2, 20+ x3
//   Combo resets when the ship is hit.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polygon as SvgPolygon } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InGameExit } from '../../src/components/InGameExit';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { colors, neon, spacing } from '../../src/theme';

// ---- Tunables --------------------------------------------------------
const TICK_MS = 22;

const PLAY_W = 380;
const PLAY_H = 720;

// Vanishing point sits roughly a quarter from the top.
const VP_X = PLAY_W / 2;
const VP_Y = PLAY_H * 0.22;

// Lane half-width in world coordinates. Ship and asteroids range
// from -WORLD_HALF to +WORLD_HALF on the x axis. Wider than the play
// area so the ship can chase asteroids to the very edges.
const WORLD_HALF = 200;

// Ship — anchored near the bottom of the play area, world-X driven by tilt.
const SHIP_Y = PLAY_H - 80;
const SHIP_HALF_W = 22;
const SHIP_HEIGHT = 38;
// Direct tilt-to-velocity mapping (no acceleration / damping). At rest
// the ship doesn't drift. Tilting the phone instantly produces lateral
// velocity proportional to the tilt magnitude. Feels arcade-snappy.
const SHIP_MAX_VX = 620; // world px / sec at full tilt
const TILT_SENSITIVITY = 2.6; // tilt.x of (1/SENSITIVITY)g = 100% velocity

// Player plane — z=0 in our perspective. Bullets fire from here and
// asteroids hit the ship's lateral position when they reach this plane.
const PLAYER_PLANE_Y = SHIP_Y;
const PLANE_DEPTH = PLAYER_PLANE_Y - VP_Y;

// Asteroids.
const ASTEROID_MIN_SIZE = 4;
const ASTEROID_MAX_SIZE = 36;

// Obstacle-type unlock thresholds (seconds elapsed).
const CURVING_START_S = 20;
const CLUSTER_START_S = 35;
const MINE_START_S = 50;

// Mine: slow-moving, multi-hit nuisance that lingers in the lane.
const MINE_HP = 3;
const MINE_SIZE_BASE = 9;
const MINE_Z_SPEED_MULT = 0.55; // 55% of normal asteroid z-speed

// Power-ups.
const POWERUP_START_S = 25; // earliest time a power-up can spawn
const POWERUP_INTERVAL_MIN_MS = 11000;
const POWERUP_INTERVAL_MAX_MS = 17000;
const POWERUP_DURATION_MS = 5000;
const POWERUP_Z_SPEED_MULT = 0.65; // float in slowly so player can line up
const POWERUP_SIZE_BASE = 7;
const POWERUP_HIT_DX = 30; // collection radius (world-X)

// Bullets.
const BULLET_Z_SPEED = 1.5; // z units per second — slower bullets, less spam-fire
const BULLET_MAX_ON_SCREEN = 4;
// Bullets only register kills inside the near field. Stops the
// "camp the center, blast everything at the vanishing point" exploit
// — to kill an asteroid you have to wait until it drops into your
// reachable zone.
const BULLET_KILL_MAX_Z = 0.7;

// Difficulty curves.
const SPAWN_INITIAL_MS = 1700;
const SPAWN_FLOOR_MS = 480;
const SPAWN_RAMP_SECONDS = 75;
const Z_SPEED_INITIAL = 0.32; // takes ~3.1s to traverse at start
const Z_SPEED_FLOOR = 1.40; // takes ~0.7s at end
const Z_SPEED_RAMP_SECONDS = 90;

// Collision tuning.
const SHIP_HIT_Z = 0.06; // asteroid z below this & near ship → hit
const SHIP_HIT_DX = 36; // world-X distance threshold
const BULLET_HIT_DZ = 0.08;
const BULLET_HIT_DX = 26;

// Stars (background).
const STAR_COUNT = 30;
const STAR_BASE_SPEED = 0.7;

const ACCENT = neon('cyan');
const ASTEROID_COLOR = neon('red');
const BULLET_COLOR = neon('yellow');

const STARTING_LIVES = 3;
const HIT_INVULN_MS = 1100; // brief immunity after a hit

type Phase = 'ready' | 'flying' | 'over';

type AsteroidType = 'standard' | 'big' | 'curving' | 'mine';

type Asteroid = {
  id: number;
  type: AsteroidType;
  /** Lane-center anchor (used as the curving sinewave midpoint). */
  baseWorldX: number;
  /** Current worldX — recomputed each tick for curving asteroids. */
  worldX: number;
  z: number;
  zSpeed: number;
  size: number;
  /** Hits remaining before destruction. */
  hp: number;
  // Curving fields — only set when type === 'curving'.
  curveAmp?: number;
  curveFreq?: number;
  curvePhase?: number;
  // Visual ping when struck but not destroyed.
  hitFlashUntil?: number;
  // Hit feedback — when set, asteroid is dying and is rendered as a
  // brief explosion before being removed.
  destroyedAt?: number;
};

type Bullet = {
  id: number;
  worldX: number;
  z: number;
  /** worldX change per unit z. Used by spread-shot bullets to fan out. */
  xVelPerZ: number;
};

type PowerUpKind = 'spread' | 'rapid';

type PowerUp = {
  id: number;
  kind: PowerUpKind;
  worldX: number;
  z: number;
  zSpeed: number;
  collected?: boolean;
};

type Star = {
  id: number;
  worldX: number; // direction off VP
  worldY: number; // direction off VP (positive = downward)
  z: number;
};

let nextAsteroidId = 1;
let nextBulletId = 1;
let nextPowerUpId = 1;

export default function VectorGame() {
  useWindowDimensions(); // keep screen size hot if user rotates

  const [phase, setPhase] = useState<Phase>('ready');
  const [, setRenderTick] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);

  const phaseRef = useRef<Phase>('ready');
  const shipXRef = useRef(0); // world X
  const shipVxRef = useRef(0);
  const accelRef = useRef({ x: 0, y: 0 });
  const asteroidsRef = useRef<Asteroid[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const starsRef = useRef<Star[]>(seedStars());
  const lastFrameRef = useRef(Date.now());
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);
  const lastSpawnAtRef = useRef(0);
  const lastPowerUpAtRef = useRef(0);
  const nextPowerUpAtRef = useRef(0);
  const spreadUntilRef = useRef(0);
  const rapidUntilRef = useRef(0);
  // Live state for the HUD chip — updated when buffs activate/expire.
  const [activeBuff, setActiveBuff] = useState<PowerUpKind | null>(null);
  const [buffRemainingMs, setBuffRemainingMs] = useState(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const lastHitAtRef = useRef(0);
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
    shipXRef.current = 0;
    shipVxRef.current = 0;
    asteroidsRef.current = [];
    bulletsRef.current = [];
    powerUpsRef.current = [];
    starsRef.current = seedStars();
    elapsedRef.current = 0;
    scoreRef.current = 0;
    livesRef.current = STARTING_LIVES;
    comboRef.current = 0;
    bestComboRef.current = 0;
    lastHitAtRef.current = 0;
    spreadUntilRef.current = 0;
    rapidUntilRef.current = 0;
    setScore(0);
    setLives(STARTING_LIVES);
    setCombo(0);
    setBestCombo(0);
    setActiveBuff(null);
    setBuffRemainingMs(0);
    startedAtRef.current = Date.now();
    lastFrameRef.current = Date.now();
    lastSpawnAtRef.current = Date.now() - SPAWN_INITIAL_MS;
    // First power-up appears no earlier than POWERUP_START_S into the run.
    nextPowerUpAtRef.current =
      Date.now() + POWERUP_START_S * 1000 +
      Math.random() * (POWERUP_INTERVAL_MAX_MS - POWERUP_INTERVAL_MIN_MS);
    setPhaseSafe('flying');
    scheduleFrame();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }

  function scheduleFrame() {
    rafRef.current = setTimeout(gameLoop, TICK_MS);
  }

  function gameLoop() {
    if (phaseRef.current !== 'flying') return;
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
    lastFrameRef.current = now;
    elapsedRef.current = (now - startedAtRef.current) / 1000;
    const t = elapsedRef.current;

    // --- Pacing ramps ----------------------------------------------
    const spawnMs = lerp(SPAWN_INITIAL_MS, SPAWN_FLOOR_MS, clamp(t / SPAWN_RAMP_SECONDS, 0, 1));
    const baseZSpeed = lerp(Z_SPEED_INITIAL, Z_SPEED_FLOOR, clamp(t / Z_SPEED_RAMP_SECONDS, 0, 1));

    // --- Ship physics: direct tilt-to-velocity --------------------
    // accelRef.current.x is the device tilt in g (~ -1 to +1 in
    // typical use). We scale by TILT_SENSITIVITY so even a modest
    // tilt yields full speed, then clamp to [-1, 1] to avoid runaway.
    const tilt = clamp(accelRef.current.x * TILT_SENSITIVITY, -1, 1);
    shipVxRef.current = tilt * SHIP_MAX_VX;
    shipXRef.current += shipVxRef.current * dt;
    if (shipXRef.current < -WORLD_HALF + SHIP_HALF_W) {
      shipXRef.current = -WORLD_HALF + SHIP_HALF_W;
      shipVxRef.current = 0;
    } else if (shipXRef.current > WORLD_HALF - SHIP_HALF_W) {
      shipXRef.current = WORLD_HALF - SHIP_HALF_W;
      shipVxRef.current = 0;
    }

    // --- Spawn asteroids ------------------------------------------
    if (now - lastSpawnAtRef.current >= spawnMs) {
      lastSpawnAtRef.current = now;
      const type = decideSpawnType(t);
      if (type === 'cluster') {
        // 3 standard asteroids in a tight horizontal cluster — must
        // sweep across them in time. They share zSpeed so they arrive
        // together.
        const baseX = (Math.random() * 2 - 1) * (WORLD_HALF - 80);
        const sharedSpeed = baseZSpeed * (0.85 + Math.random() * 0.25);
        for (let i = -1; i <= 1; i++) {
          const wx = clamp(baseX + i * 52, -WORLD_HALF + 30, WORLD_HALF - 30);
          asteroidsRef.current.push(makeStandardAsteroid(wx, sharedSpeed));
        }
      } else if (type === 'curving') {
        const baseX = (Math.random() * 2 - 1) * (WORLD_HALF - 60);
        // Amplitude clamped so the asteroid doesn't curve out of the
        // playable lane. Frequency tuned so the curve completes
        // roughly 1 cycle per second of approach.
        const amp = 35 + Math.random() * 50;
        asteroidsRef.current.push({
          id: nextAsteroidId++,
          type: 'curving',
          baseWorldX: baseX,
          worldX: baseX,
          z: 1,
          zSpeed: baseZSpeed * (0.85 + Math.random() * 0.25),
          size: ASTEROID_MIN_SIZE + Math.random() * 4,
          hp: 1,
          curveAmp: amp,
          curveFreq: 1.4 + Math.random() * 1.2, // ~0.7–1.0 Hz
          curvePhase: Math.random() * Math.PI * 2,
        });
      } else if (type === 'mine') {
        const wx = (Math.random() * 2 - 1) * (WORLD_HALF - 30);
        asteroidsRef.current.push({
          id: nextAsteroidId++,
          type: 'mine',
          baseWorldX: wx,
          worldX: wx,
          z: 1,
          zSpeed: baseZSpeed * MINE_Z_SPEED_MULT,
          size: MINE_SIZE_BASE,
          hp: MINE_HP,
        });
      } else if (type === 'big') {
        const wx = (Math.random() * 2 - 1) * (WORLD_HALF - 30);
        asteroidsRef.current.push({
          id: nextAsteroidId++,
          type: 'big',
          baseWorldX: wx,
          worldX: wx,
          z: 1,
          zSpeed: baseZSpeed * 0.78,
          size: 7,
          hp: 2,
        });
      } else {
        const wx = (Math.random() * 2 - 1) * (WORLD_HALF - 30);
        asteroidsRef.current.push(
          makeStandardAsteroid(wx, baseZSpeed * (0.85 + Math.random() * 0.3)),
        );
      }
    }

    // --- Update curving asteroid lateral positions ----------------
    for (const a of asteroidsRef.current) {
      if (a.type === 'curving' && !a.destroyedAt) {
        const offset =
          (a.curveAmp ?? 0) *
          Math.sin(t * (a.curveFreq ?? 1) + (a.curvePhase ?? 0));
        a.worldX = clamp(a.baseWorldX + offset, -WORLD_HALF + 25, WORLD_HALF - 25);
      }
    }

    // --- Spawn power-ups every POWERUP_INTERVAL --------------------
    if (now >= nextPowerUpAtRef.current) {
      const kind: PowerUpKind = Math.random() < 0.5 ? 'spread' : 'rapid';
      powerUpsRef.current.push({
        id: nextPowerUpId++,
        kind,
        worldX: (Math.random() * 2 - 1) * (WORLD_HALF - 60),
        z: 1,
        zSpeed: baseZSpeed * POWERUP_Z_SPEED_MULT,
      });
      nextPowerUpAtRef.current =
        now +
        POWERUP_INTERVAL_MIN_MS +
        Math.random() * (POWERUP_INTERVAL_MAX_MS - POWERUP_INTERVAL_MIN_MS);
    }

    // Cached ship X used by both the power-up pickup check below and
    // the asteroid collision check further down. Declared once here so
    // we don't read the ref twice and so TS narrows for both loops.
    const shipX = shipXRef.current;

    // --- Move power-ups + check ship pickup ------------------------
    for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
      const p = powerUpsRef.current[i];
      if (p.collected) {
        powerUpsRef.current.splice(i, 1);
        continue;
      }
      p.z -= p.zSpeed * dt;
      if (p.z <= SHIP_HIT_Z) {
        if (Math.abs(p.worldX - shipX) < POWERUP_HIT_DX) {
          p.collected = true;
          activatePowerUp(p.kind);
        } else if (p.z < -0.05) {
          powerUpsRef.current.splice(i, 1);
        }
      }
    }

    // --- Tick down active buffs ------------------------------------
    const spreadActive = now < spreadUntilRef.current;
    const rapidActive = now < rapidUntilRef.current;
    if (spreadActive || rapidActive) {
      const remaining = Math.max(
        spreadUntilRef.current - now,
        rapidUntilRef.current - now,
      );
      setBuffRemainingMs(remaining);
      setActiveBuff(spreadActive ? 'spread' : 'rapid');
    } else if (activeBuff != null) {
      setActiveBuff(null);
      setBuffRemainingMs(0);
    }

    // --- Move asteroids + check ship collisions -------------------
    const invuln = now - lastHitAtRef.current < HIT_INVULN_MS;
    for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
      const a = asteroidsRef.current[i];
      if (a.destroyedAt) {
        if (now - a.destroyedAt > 220) asteroidsRef.current.splice(i, 1);
        continue;
      }
      a.z -= a.zSpeed * dt;
      if (a.z <= SHIP_HIT_Z) {
        // Reached the ship's plane.
        if (!invuln && Math.abs(a.worldX - shipX) < SHIP_HIT_DX) {
          // Hit the ship.
          a.destroyedAt = now;
          loseLife();
        } else if (a.z < -0.05) {
          asteroidsRef.current.splice(i, 1);
        }
      }
    }

    // --- Move bullets + check asteroid collisions -----------------
    for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
      const b = bulletsRef.current[i];
      const dz = BULLET_Z_SPEED * dt;
      b.z += dz;
      // Spread-shot bullets fan out as they travel — xVelPerZ shifts
      // the bullet's worldX as z grows.
      if (b.xVelPerZ !== 0) b.worldX += b.xVelPerZ * dz;
      if (b.z >= 1) {
        bulletsRef.current.splice(i, 1);
        continue;
      }
      // Bullets only register kills in the near field. Far-away
      // asteroids (still bunched near the VP) are unkillable, so the
      // player has to wait for them to drop into the reachable zone.
      if (b.z > BULLET_KILL_MAX_Z) continue;

      // Check against each live asteroid.
      let hit = false;
      for (const a of asteroidsRef.current) {
        if (a.destroyedAt) continue;
        if (a.z > BULLET_KILL_MAX_Z) continue; // same-zone restriction
        if (Math.abs(a.z - b.z) < BULLET_HIT_DZ && Math.abs(a.worldX - b.worldX) < BULLET_HIT_DX) {
          hit = true;
          a.hp -= 1;
          if (a.hp <= 0) {
            a.destroyedAt = now;
            onAsteroidBlasted(a.type);
          } else {
            // Multi-hit target still alive — flash + small haptic.
            a.hitFlashUntil = now + 140;
            Haptics.selectionAsync().catch(() => {});
          }
          break;
        }
      }
      if (hit) bulletsRef.current.splice(i, 1);
    }

    // --- Stars (background flow) ----------------------------------
    for (const s of starsRef.current) {
      s.z -= STAR_BASE_SPEED * dt;
      if (s.z <= 0) {
        // recycle to vanishing point with a fresh angle
        s.z = 1;
        const angle = Math.random() * Math.PI * 2;
        const r = 0.4 + Math.random() * 0.6; // direction strength
        s.worldX = Math.cos(angle) * 220 * r;
        s.worldY = Math.sin(angle) * 220 * r;
      }
    }

    // --- Score: 1pt/sec alive --------------------------------------
    scoreRef.current += dt * 1;
    setScore(Math.floor(scoreRef.current));

    setRenderTick((tick) => (tick + 1) % 1_000_000);
    scheduleFrame();
  }

  function fire() {
    if (phaseRef.current === 'ready') {
      startRun();
      return;
    }
    if (phaseRef.current !== 'flying') return;
    const now = Date.now();
    const rapid = now < rapidUntilRef.current;
    const spread = now < spreadUntilRef.current;
    // Rapid fire bumps the on-screen cap so taps don't get swallowed.
    const cap = rapid ? 12 : BULLET_MAX_ON_SCREEN;
    if (bulletsRef.current.length >= cap) return;

    if (spread) {
      // Three bullets fan out from the ship as they travel toward the VP.
      const baseX = shipXRef.current;
      bulletsRef.current.push({ id: nextBulletId++, worldX: baseX, z: 0, xVelPerZ: 0 });
      bulletsRef.current.push({ id: nextBulletId++, worldX: baseX, z: 0, xVelPerZ: -90 });
      bulletsRef.current.push({ id: nextBulletId++, worldX: baseX, z: 0, xVelPerZ: 90 });
    } else {
      bulletsRef.current.push({
        id: nextBulletId++,
        worldX: shipXRef.current,
        z: 0,
        xVelPerZ: 0,
      });
    }
    Haptics.selectionAsync().catch(() => {});
  }

  function activatePowerUp(kind: PowerUpKind) {
    const now = Date.now();
    if (kind === 'spread') {
      spreadUntilRef.current = now + POWERUP_DURATION_MS;
    } else {
      rapidUntilRef.current = now + POWERUP_DURATION_MS;
    }
    setActiveBuff(kind);
    setBuffRemainingMs(POWERUP_DURATION_MS);
    // Score bonus for the pickup itself, since it doesn't "kill" anything
    // but cost the player a navigation choice.
    scoreRef.current += 100;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function onAsteroidBlasted(type: AsteroidType = 'standard') {
    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    setCombo(newCombo);
    if (newCombo > bestComboRef.current) {
      bestComboRef.current = newCombo;
      setBestCombo(newCombo);
    }
    const mult = comboMult(newCombo);
    // Per-type base value. Mines pay biggest (3 shots, lingering);
    // big and curving reward harder kills; standards stay 50.
    const base =
      type === 'mine' ? 250 : type === 'big' ? 120 : type === 'curving' ? 80 : 50;
    scoreRef.current += base * mult;
    Haptics.impactAsync(
      type === 'mine' || type === 'big' || newCombo >= 10
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
  }

  function loseLife() {
    lastHitAtRef.current = Date.now();
    livesRef.current -= 1;
    setLives(livesRef.current);
    comboRef.current = 0;
    setCombo(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (livesRef.current <= 0) {
      finishRun();
    }
  }

  function finishRun() {
    setPhaseSafe('over');
    finishTimeoutRef.current = setTimeout(() => {
      router.replace({
        pathname: '/result/[id]',
        params: { id: 'vector', score: String(Math.floor(scoreRef.current)) },
      });
    }, 1700);
  }

  // ---- Render --------------------------------------------------------
  const now = Date.now();
  const invuln = now - lastHitAtRef.current < HIT_INVULN_MS;
  const blink = invuln && Math.floor((now - lastHitAtRef.current) / 90) % 2 === 0;
  const mult = comboMult(combo);

  return (
    <View style={{ flex: 1, backgroundColor: '#020208' }}>
      <Pressable onPress={fire} style={{ flex: 1 }}>
        {/* HUD */}
        <SafeAreaView edges={['top']} pointerEvents="none">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              paddingLeft: 44,
            }}
          >
            <View>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'SCORE'}
              </ArcadeText>
              <ArcadeText
                variant="mono"
                size={22}
                color={ACCENT}
                glowColor={ACCENT}
              >
                {String(score).padStart(5, '0')}
              </ArcadeText>
              {phase === 'flying' && combo >= 2 ? (
                <ArcadeText
                  variant="pixel"
                  size={9}
                  color={
                    mult >= 3
                      ? neon('yellow')
                      : mult >= 2
                        ? neon('green')
                        : neon('cyan')
                  }
                  glowColor={
                    mult >= 3
                      ? neon('yellow')
                      : mult >= 2
                        ? neon('green')
                        : neon('cyan')
                  }
                >
                  {`COMBO x${mult > 1 ? mult : 1} · ${combo}`}
                </ArcadeText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                {'LIVES'}
              </ArcadeText>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                {[0, 1, 2].map((i) => {
                  const alive = lives > i;
                  return (
                    <ArcadeText
                      key={i}
                      variant="pixel"
                      size={20}
                      color={alive ? neon('green') : colors.textMute}
                      glowColor={alive ? neon('green') : undefined}
                    >
                      {'∆'}
                    </ArcadeText>
                  );
                })}
              </View>
              {activeBuff != null ? (
                <ArcadeText
                  variant="pixel"
                  size={9}
                  color={activeBuff === 'spread' ? neon('cyan') : neon('yellow')}
                  glowColor={activeBuff === 'spread' ? neon('cyan') : neon('yellow')}
                >
                  {`${activeBuff === 'spread' ? 'SPREAD' : 'RAPID'} ${(buffRemainingMs / 1000).toFixed(1)}s`}
                </ArcadeText>
              ) : null}
            </View>
          </View>
        </SafeAreaView>

        {/* Play area — fills the rest of the screen at fixed viewBox. */}
        <View
          style={{
            flex: 1,
            marginHorizontal: 4,
            marginBottom: 4,
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
            {/* Vanishing-point glow + tunnel guide chevrons */}
            <Circle cx={VP_X} cy={VP_Y} r={3} fill={ACCENT} />
            <Circle cx={VP_X} cy={VP_Y} r={9} fill={ACCENT} fillOpacity={0.25} />
            <Circle cx={VP_X} cy={VP_Y} r={20} fill={ACCENT} fillOpacity={0.08} />
            {[0.18, 0.36, 0.58, 0.82].map((t) => {
              const y = VP_Y + PLANE_DEPTH * t;
              const halfW = WORLD_HALF * t;
              return (
                <Line
                  key={t}
                  x1={VP_X - halfW}
                  y1={y}
                  x2={VP_X + halfW}
                  y2={y}
                  stroke={ACCENT}
                  strokeOpacity={0.08 + t * 0.07}
                  strokeWidth={1}
                />
              );
            })}
            {/* Lane edge lines from VP to the player plane (where the
                ship lives). Anchoring at PLAYER_PLANE_Y instead of
                PLAY_H means the lane visually wraps the ship at all
                lateral positions — no more "ship slides outside the
                lane." */}
            <Line
              x1={VP_X}
              y1={VP_Y}
              x2={VP_X - WORLD_HALF}
              y2={PLAYER_PLANE_Y}
              stroke={ACCENT}
              strokeOpacity={0.18}
              strokeWidth={1}
            />
            <Line
              x1={VP_X}
              y1={VP_Y}
              x2={VP_X + WORLD_HALF}
              y2={PLAYER_PLANE_Y}
              stroke={ACCENT}
              strokeOpacity={0.18}
              strokeWidth={1}
            />

            {/* Stars */}
            {starsRef.current.map((s) => {
              const t = 1 - s.z;
              const x = VP_X + s.worldX * t;
              const y = VP_Y + s.worldY * t;
              if (x < 0 || x > PLAY_W || y < 0 || y > PLAYER_PLANE_Y) return null;
              return (
                <Circle
                  key={s.id}
                  cx={x}
                  cy={y}
                  r={0.5 + t * 1.5}
                  fill="#fff"
                  fillOpacity={0.2 + t * 0.5}
                />
              );
            })}

            {/* Asteroids */}
            {asteroidsRef.current.map((a) => {
              const t = 1 - a.z;
              const sx = VP_X + a.worldX * t;
              const sy = VP_Y + PLANE_DEPTH * t;
              const size =
                ASTEROID_MIN_SIZE + (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE) * t;
              if (a.destroyedAt) {
                const age = now - a.destroyedAt;
                const opacity = clamp(1 - age / 220, 0, 1);
                return (
                  <G key={a.id}>
                    <Circle
                      cx={sx}
                      cy={sy}
                      r={size * 1.6}
                      fill={ASTEROID_COLOR}
                      fillOpacity={opacity * 0.45}
                    />
                    <Circle
                      cx={sx}
                      cy={sy}
                      r={size}
                      fill={neon('yellow')}
                      fillOpacity={opacity * 0.9}
                    />
                  </G>
                );
              }
              // Type-specific render. drawSize/colors/decorations vary;
              // hit-flash applies to multi-hit types when struck.
              const flashing = a.hitFlashUntil != null && now < a.hitFlashUntil;
              if (a.type === 'mine') {
                // Hexagonal grey-purple mine. Spikier outline =
                // "stay away from this."
                const r = MINE_SIZE_BASE + (ASTEROID_MAX_SIZE - MINE_SIZE_BASE) * t;
                const points = hexagonPoints(sx, sy, r);
                const innerPts = hexagonPoints(sx, sy, r * 0.55);
                return (
                  <G key={a.id}>
                    <SvgPolygon
                      points={points}
                      fill={flashing ? '#fff' : neon('purple')}
                      fillOpacity={flashing ? 1 : 0.85}
                      stroke={neon('yellow')}
                      strokeWidth={2}
                      strokeOpacity={0.8}
                    />
                    <SvgPolygon
                      points={innerPts}
                      fill="#08080f"
                      fillOpacity={0.7}
                    />
                    {/* HP indicator pip, shrinks as hits land */}
                    <Circle
                      cx={sx}
                      cy={sy}
                      r={Math.max(2, r * 0.18 * (a.hp / MINE_HP))}
                      fill={neon('yellow')}
                    />
                  </G>
                );
              }
              if (a.type === 'big') {
                const drawSize = size * 1.4;
                return (
                  <G key={a.id}>
                    <Circle cx={sx} cy={sy} r={drawSize + 8} fill={neon('orange')} fillOpacity={0.25} />
                    <Circle
                      cx={sx}
                      cy={sy}
                      r={drawSize}
                      fill={flashing ? '#fff' : neon('orange')}
                      fillOpacity={flashing ? 1 : 0.85}
                    />
                    <Circle
                      cx={sx}
                      cy={sy}
                      r={drawSize - 4}
                      fill="none"
                      stroke={neon('yellow')}
                      strokeWidth={2}
                      strokeOpacity={0.8}
                    />
                    <Circle
                      cx={sx - drawSize * 0.3}
                      cy={sy - drawSize * 0.3}
                      r={drawSize * 0.3}
                      fill="#08080f"
                      fillOpacity={0.5}
                    />
                  </G>
                );
              }
              if (a.type === 'curving') {
                // Standard look + a faint trailing dot showing where it
                // recently was, so the player can read the curve direction.
                const trailOffset =
                  (a.curveAmp ?? 0) *
                  Math.sin(elapsedRef.current * (a.curveFreq ?? 1) + (a.curvePhase ?? 0) - 0.35);
                const trailWX = clamp(
                  a.baseWorldX + trailOffset,
                  -WORLD_HALF + 25,
                  WORLD_HALF - 25,
                );
                const trailX = VP_X + trailWX * t;
                return (
                  <G key={a.id}>
                    <Circle
                      cx={trailX}
                      cy={sy}
                      r={size * 0.6}
                      fill={ASTEROID_COLOR}
                      fillOpacity={0.18}
                    />
                    <Circle cx={sx} cy={sy} r={size + 4} fill={ASTEROID_COLOR} fillOpacity={0.18} />
                    <Circle cx={sx} cy={sy} r={size} fill={ASTEROID_COLOR} fillOpacity={0.85} />
                    <Circle
                      cx={sx - size * 0.3}
                      cy={sy - size * 0.3}
                      r={size * 0.3}
                      fill="#08080f"
                      fillOpacity={0.5}
                    />
                  </G>
                );
              }
              // Standard
              return (
                <G key={a.id}>
                  <Circle cx={sx} cy={sy} r={size + 4} fill={ASTEROID_COLOR} fillOpacity={0.18} />
                  <Circle cx={sx} cy={sy} r={size} fill={ASTEROID_COLOR} fillOpacity={0.85} />
                  <Circle
                    cx={sx - size * 0.3}
                    cy={sy - size * 0.3}
                    r={size * 0.3}
                    fill="#08080f"
                    fillOpacity={0.5}
                  />
                </G>
              );
            })}

            {/* Power-ups — render as glowing capsules with a letter glyph */}
            {powerUpsRef.current.map((p) => {
              if (p.collected) return null;
              const tt = 1 - p.z;
              const sx = VP_X + p.worldX * tt;
              const sy = VP_Y + PLANE_DEPTH * tt;
              const sz = POWERUP_SIZE_BASE + 22 * tt;
              const color = p.kind === 'spread' ? neon('cyan') : neon('yellow');
              return (
                <G key={p.id}>
                  <Circle cx={sx} cy={sy} r={sz + 6} fill={color} fillOpacity={0.25} />
                  <Circle cx={sx} cy={sy} r={sz} fill={color} fillOpacity={0.95} />
                  <Circle cx={sx} cy={sy} r={sz - 4} fill="#08080f" fillOpacity={0.75} />
                  {/* Glyph: S for spread, R for rapid */}
                  <SvgPolygon
                    points={
                      p.kind === 'spread'
                        ? `${sx - sz * 0.3},${sy + sz * 0.4} ${sx},${sy - sz * 0.4} ${sx + sz * 0.3},${sy + sz * 0.4}`
                        : `${sx - sz * 0.3},${sy - sz * 0.4} ${sx + sz * 0.3},${sy - sz * 0.4} ${sx - sz * 0.05},${sy + sz * 0.4}`
                    }
                    fill={color}
                  />
                </G>
              );
            })}

            {/* Bullets — render as a streak from previous-z to current-z */}
            {bulletsRef.current.map((b) => {
              const t = 1 - b.z;
              const tPrev = 1 - clamp(b.z + 0.05, 0, 1);
              const x1 = VP_X + b.worldX * tPrev;
              const y1 = VP_Y + PLANE_DEPTH * tPrev;
              const x2 = VP_X + b.worldX * t;
              const y2 = VP_Y + PLANE_DEPTH * t;
              return (
                <G key={b.id}>
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={BULLET_COLOR}
                    strokeWidth={3}
                    strokeOpacity={0.9}
                  />
                  <Circle cx={x2} cy={y2} r={2} fill={BULLET_COLOR} />
                </G>
              );
            })}

            {/* Ship — at bottom, x driven by tilt. Blinks during invuln. */}
            {!blink ? <Ship x={VP_X + shipXRef.current} y={SHIP_Y} /> : null}
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
                backgroundColor: 'rgba(2,2,8,0.55)',
              }}
            >
              <ArcadeText
                variant="pixel"
                size={26}
                color={ACCENT}
                glowColor={ACCENT}
                glowRadius={16}
                align="center"
              >
                {'VECTOR'}
              </ArcadeText>
              <View style={{ height: spacing.md }} />
              <ArcadeText variant="mono" size={16} color={colors.textDim} align="center">
                {'TILT TO STEER\nTAP TO FIRE\n3 LIVES'}
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
          {phase === 'over' ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: '38%',
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
            >
              <Blink intervalMs={300} minOpacity={0.4}>
                <ArcadeText
                  variant="pixel"
                  size={22}
                  color={neon('red')}
                  glowColor={neon('red')}
                  glowRadius={14}
                  align="center"
                >
                  {'WIPED OUT'}
                </ArcadeText>
              </Blink>
              <View style={{ height: spacing.sm }} />
              <ArcadeText variant="mono" size={20} color={colors.textDim}>
                {String(Math.floor(scoreRef.current))}
              </ArcadeText>
              <ArcadeText variant="pixel" size={9} color={colors.textMute}>
                {`BEST COMBO x${bestCombo}`}
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
// Ship — chunky neon triangle.
function Ship({ x, y }: { x: number; y: number }) {
  return (
    <G>
      {/* Glow halo */}
      <SvgPolygon
        points={`${x},${y - SHIP_HEIGHT - 4} ${x - SHIP_HALF_W - 4},${y + 4} ${x + SHIP_HALF_W + 4},${y + 4}`}
        fill={ACCENT}
        fillOpacity={0.25}
      />
      {/* Body */}
      <SvgPolygon
        points={`${x},${y - SHIP_HEIGHT} ${x - SHIP_HALF_W},${y} ${x + SHIP_HALF_W},${y}`}
        fill={ACCENT}
      />
      {/* Cockpit */}
      <SvgPolygon
        points={`${x},${y - SHIP_HEIGHT + 8} ${x - SHIP_HALF_W * 0.6},${y - 4} ${x + SHIP_HALF_W * 0.6},${y - 4}`}
        fill="#040408"
        fillOpacity={0.7}
      />
      {/* Engine flares */}
      <SvgPolygon
        points={`${x - SHIP_HALF_W * 0.5},${y} ${x - SHIP_HALF_W * 0.2},${y + 8} ${x},${y}`}
        fill={neon('yellow')}
        fillOpacity={0.9}
      />
      <SvgPolygon
        points={`${x},${y} ${x + SHIP_HALF_W * 0.2},${y + 8} ${x + SHIP_HALF_W * 0.5},${y}`}
        fill={neon('yellow')}
        fillOpacity={0.9}
      />
    </G>
  );
}

// =====================================================================
// Spawn type decision — independent rolls so each unlocked type has a
// fair shot at any given spawn event. Standard is the fallback.
function decideSpawnType(t: number): AsteroidType | 'cluster' {
  if (t >= MINE_START_S && Math.random() < 0.10) return 'mine';
  if (t >= CLUSTER_START_S && Math.random() < 0.18) return 'cluster';
  if (t >= CURVING_START_S && Math.random() < 0.32) return 'curving';
  const bigChance = t < 25 ? 0 : t < 60 ? 0.18 : 0.28;
  if (Math.random() < bigChance) return 'big';
  return 'standard';
}

function makeStandardAsteroid(worldX: number, zSpeed: number): Asteroid {
  return {
    id: nextAsteroidId++,
    type: 'standard',
    baseWorldX: worldX,
    worldX,
    z: 1,
    zSpeed,
    size: ASTEROID_MIN_SIZE + Math.random() * 4,
    hp: 1,
  };
}

// Hexagon polygon points, flat-topped, used for mines.
function hexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

// =====================================================================
// Helpers
function seedStars(): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 0.6;
    out.push({
      id: i,
      worldX: Math.cos(angle) * 220 * r,
      worldY: Math.sin(angle) * 220 * r,
      z: Math.random(),
    });
  }
  return out;
}

function comboMult(combo: number): number {
  if (combo >= 20) return 3;
  if (combo >= 10) return 2;
  if (combo >= 5) return 1.5;
  return 1;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
