// Walk the Line — level definitions.
//
// Targets are now in FEET (indoor-friendly). The play screen converts
// feet to expected steps internally using STRIDE_FT, then scores the
// player's actual step count back into feet so distance error is
// reported in real-world units.
//
// Three modes:
//   STRAIGHT: walk a target distance in a straight line.
//   RETURN:   walk forward, turn 180°, walk back to start.
//   VARIABLE: target updates mid-walk via haptic + 0.5s flash.

export type LevelMode = 'STRAIGHT' | 'RETURN' | 'VARIABLE';

export type Level = {
  name: string;
  mode: LevelMode;
  /** Target distance in feet. */
  targetFeet: number;
  /** For VARIABLE mode: feet to add (or subtract) at midpoint. */
  variableDeltaFt?: number;
  /** Drift tolerance in degrees beyond which score = 0 on the drift axis. */
  driftTolerance: number;
};

/** Average adult stride length, in feet. Used to convert feet to expected steps. */
export const STRIDE_FT = 2.4;

export const WALK_LEVELS: Level[] = [
  // Warm-up: short and indoor-friendly. Most living rooms are 12-15 ft across.
  { name: 'WARM-UP',     mode: 'STRAIGHT', targetFeet: 8,  driftTolerance: 60 },
  { name: 'BACKYARD',    mode: 'STRAIGHT', targetFeet: 12, driftTolerance: 50 },
  { name: 'HALLWAY',     mode: 'STRAIGHT', targetFeet: 18, driftTolerance: 45 },

  // First return — short, so you don't run out of room.
  { name: 'COMEBACK',    mode: 'RETURN',   targetFeet: 10, driftTolerance: 50 },

  { name: 'STREET',      mode: 'STRAIGHT', targetFeet: 22, driftTolerance: 40 },

  // First variable mid-walk update (target grows by 3 ft).
  {
    name: 'CURVEBALL',
    mode: 'VARIABLE',
    targetFeet: 15,
    variableDeltaFt: 4, // walk 19 ft total
    driftTolerance: 45,
  },

  { name: 'ROUND TRIP',  mode: 'RETURN',   targetFeet: 12, driftTolerance: 40 },

  { name: 'TIGHTROPE',   mode: 'STRAIGHT', targetFeet: 25, driftTolerance: 30 },

  // Variable with negative delta (shorter than originally announced).
  {
    name: 'BAIT-AND-SWITCH',
    mode: 'VARIABLE',
    targetFeet: 20,
    variableDeltaFt: -6, // walk 14 ft total
    driftTolerance: 35,
  },

  // Master: long return with tight drift tolerance.
  { name: 'MASTER',      mode: 'RETURN',   targetFeet: 18, driftTolerance: 25 },
];
