// Player state — tokens, identity, stats, daily challenge logic.
//
// Persistence: state is mirrored to AsyncStorage on every change so it
// survives app cold starts. `loadPlayer()` is called once at boot from
// the root layout to hydrate state from disk.
//
// Token economy:
//   - First launch grants STARTING_TOKENS (one-time).
//   - Daily drop grants WELCOME_DAILY_TOKENS for the first 7 days, then
//     DAILY_FREE_TOKENS thereafter (catch-up cap = 3 days of stacking).
//   - Tokens are spent at PRESS START (1 per play, including PLAY AGAIN).
//   - Each calendar day, ONE cabinet is the "daily challenge" — playing
//     it that day costs zero tokens. Rotates through the live cabinets.
//   - Players earn bonus tokens by playing well: see grantPbBonusIfBetter.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { games } from './games';
import { findPromoCode } from './promo-codes';

const STARTING_TOKENS = 50;
const DAILY_FREE_TOKENS = 50;
const WELCOME_DAILY_TOKENS = 100; // first 7 days of new accounts
const WELCOME_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Personal-best reward tiers.
const PB_BONUS_TOKENS = 5; // any new personal best on a cabinet
const TOP10_BONUS_TOKENS = 20; // first time you crack the top 10 on a cabinet
const TOP1_BONUS_TOKENS = 50; // first time you take #1 on a cabinet

// Storage keys — bumped if we ever change the schema in a backwards-
// incompatible way.
const STORAGE_KEY = 'ourcade.player.v1';

export type TokenPack = {
  id: string;
  label: string;
  description: string;
  tokens: number;
  priceUsd: number;
  discountPct?: number;
  accent: 'green' | 'cyan' | 'magenta' | 'yellow' | 'orange';
};

// Penny-per-play pricing — tuned so a casual run-of-30-plays costs
// about a quarter and a heavy weekend session of 200 plays costs $2.
export const TOKEN_PACKS: TokenPack[] = [
  {
    id: 'starter',
    label: 'STARTER',
    description: '~100 plays',
    tokens: 100,
    priceUsd: 0.99,
    accent: 'green',
  },
  {
    id: 'value',
    label: 'VALUE',
    description: 'a weekend of runs',
    tokens: 250,
    priceUsd: 1.99,
    discountPct: 20,
    accent: 'cyan',
  },
  {
    id: 'power',
    label: 'POWER',
    description: 'serious leaderboard chasing',
    tokens: 600,
    priceUsd: 3.99,
    discountPct: 34,
    accent: 'magenta',
  },
  {
    id: 'tournament',
    label: 'TOURNAMENT',
    description: 'a tournament season',
    tokens: 2000,
    priceUsd: 9.99,
    discountPct: 50,
    accent: 'yellow',
  },
  {
    id: 'legend',
    label: 'LEGEND',
    description: 'effectively unlimited',
    tokens: 5000,
    priceUsd: 19.99,
    discountPct: 60,
    accent: 'orange',
  },
];

/** Per-player audio + haptic preferences. Toggles are inverted on screen
 *  (the Settings UI shows "ON" when these are true). All default to true
 *  so a fresh install gets the full feel. */
export type PlayerSettings = {
  soundOn: boolean;
  hapticsOn: boolean;
  musicOn: boolean;
};

type PlayerState = {
  /** True once the user has chosen real initials. False on first launch. */
  initialsChosen: boolean;
  initials: string;
  tokens: number;
  totalPlays: number;
  highScores: number;
  lastFreeGrantAt: number;
  /** First time the app was opened — drives the 7-day welcome bonus. */
  firstSeenAt: number;
  redeemedCodes: string[];
  /** Per-cabinet best score we've credited a PB bonus for (key = gameId). */
  cabinetBests: Record<string, number>;
  /** Cabinets where we've already paid the top-10 bonus. */
  top10Awarded: string[];
  /** Cabinets where we've already paid the #1 bonus. */
  top1Awarded: string[];
  /** Cabinets the player has dismissed the FIRST-PLAY DEMO for. */
  seenTutorials: Record<string, boolean>;
  /** Per-player audio + haptic toggles (Settings screen). */
  settings: PlayerSettings;
};

const defaultSettings: PlayerSettings = {
  soundOn: true,
  hapticsOn: true,
  musicOn: true,
};

const initial: PlayerState = {
  initialsChosen: false,
  initials: 'AAA',
  tokens: STARTING_TOKENS,
  totalPlays: 0,
  highScores: 0,
  lastFreeGrantAt: 0,
  firstSeenAt: 0,
  redeemedCodes: [],
  cabinetBests: {},
  top10Awarded: [],
  top1Awarded: [],
  seenTutorials: {},
  settings: { ...defaultSettings },
};

let state: PlayerState = { ...initial };
let hydrated = false;
const subscribers = new Set<(s: PlayerState) => void>();

function persist() {
  // Fire-and-forget; we don't block setState on disk writes.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn(state));
  if (hydrated) persist();
}

/**
 * Hydrate player state from AsyncStorage. Called once at app boot from
 * `app/_layout.tsx`. After this returns, every setState() also writes
 * back to disk.
 */
export async function loadPlayer(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerState>;
      // Merge into defaults so additions to PlayerState don't break
      // upgrade paths. `settings` is deep-merged so partial saves
      // (e.g. older versions missing a toggle key) inherit defaults
      // for any unknown sub-keys instead of getting `undefined`.
      state = {
        ...initial,
        ...parsed,
        settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      };
    }
    if (state.firstSeenAt === 0) {
      // First launch ever — record it for welcome-bonus tracking.
      state.firstSeenAt = Date.now();
    }
  } catch {
    /* corrupt or missing — fall back to fresh defaults */
  }
  hydrated = true;
  persist();
  subscribers.forEach((fn) => fn(state));
}

/** True if the player has never set their initials. UI uses this to gate. */
export function needsInitialsSetup(): boolean {
  return !state.initialsChosen;
}

/** Module-level read of the SOUND toggle. Used by the sound manager so
 *  it doesn't need to subscribe to the hook. Defaults to true if the
 *  settings block hasn't been hydrated yet. */
export function isSoundOn(): boolean {
  return state.settings?.soundOn ?? true;
}

/** Same idea for the MUSIC toggle (lobby loop, etc. — not yet wired). */
export function isMusicOn(): boolean {
  return state.settings?.musicOn ?? true;
}

/** And HAPTICS — used by the central sound/haptics dispatch. */
export function areHapticsOn(): boolean {
  return state.settings?.hapticsOn ?? true;
}

function isInWelcomeWindow(now: number): boolean {
  if (state.firstSeenAt === 0) return true;
  return now - state.firstSeenAt < WELCOME_DAYS * ONE_DAY_MS;
}

function dailyDropAmount(now: number): number {
  return isInWelcomeWindow(now) ? WELCOME_DAILY_TOKENS : DAILY_FREE_TOKENS;
}

function dueFreeTokens(now: number, lastGrantAt: number): number {
  const drop = dailyDropAmount(now);
  if (lastGrantAt === 0) return drop;
  const days = Math.floor((now - lastGrantAt) / ONE_DAY_MS);
  if (days <= 0) return 0;
  return Math.min(days, 3) * drop;
}

/** Returns the cabinet ID promoted as today's free daily challenge. */
export function getDailyCabinetId(now: number = Date.now()): string {
  // Hidden cabinets are benched between content drops — never picked
  // as the daily challenge.
  const liveIds = games
    .filter((g) => g.status === 'live' && !g.hidden)
    .map((g) => g.id);
  if (liveIds.length === 0) return '';
  const dayIndex = Math.floor(now / ONE_DAY_MS);
  return liveIds[dayIndex % liveIds.length];
}

/** Milliseconds until the next 00:00 UTC reset. */
export function msUntilNextUtcMidnight(now: number = Date.now()): number {
  const d = new Date(now);
  const utcMidnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, utcMidnight - now);
}

/** Humanizes a millisecond duration as "Xh" or "Ym" — for the lobby ticker. */
export function formatTimeUntil(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  if (totalMin >= 60) {
    const hours = Math.ceil(totalMin / 60);
    return `${hours} HOUR${hours === 1 ? '' : 'S'}`;
  }
  return `${totalMin} MINUTE${totalMin === 1 ? '' : 'S'}`;
}

export function usePlayer() {
  const [snapshot, setSnapshot] = useState<PlayerState>(state);

  useEffect(() => {
    subscribers.add(setSnapshot);
    return () => {
      subscribers.delete(setSnapshot);
    };
  }, []);

  return {
    ...snapshot,
    /** First-launch flag for the initials prompt. */
    needsInitialsSetup: !snapshot.initialsChosen,

    /** Whether the player is still inside the 7-day welcome window. */
    inWelcomeWindow: isInWelcomeWindow(Date.now()),

    setInitials: (initials: string, finalize: boolean = true) =>
      setState({
        initials: initials.padEnd(3, 'A').slice(0, 3).toUpperCase(),
        initialsChosen: finalize ? true : state.initialsChosen,
      }),

    /**
     * Try to spend one token to start a play. Returns true on success,
     * false if the player has none. Caller should route to /shop on false.
     * If `gameId` matches today's daily-challenge cabinet, no token is
     * spent and the call always returns true.
     */
    spendTokenFor: (gameId: string): boolean => {
      const isDaily = gameId === getDailyCabinetId();
      if (isDaily) {
        setState({ totalPlays: state.totalPlays + 1 });
        return true;
      }
      if (state.tokens <= 0) return false;
      setState({
        tokens: state.tokens - 1,
        totalPlays: state.totalPlays + 1,
      });
      return true;
    },

    /** Refund a token — used when a play is abandoned at the entry. */
    refundToken: () => {
      setState({ tokens: state.tokens + 1 });
    },

    /** Add tokens (purchase, daily grant, bonus, etc.). */
    grantTokens: (amount: number) => {
      setState({ tokens: state.tokens + amount });
    },

    recordHighScore: () => setState({ highScores: state.highScores + 1 }),

    /** Claim the daily drop if eligible. Returns the count granted. */
    claimDailyIfDue: () => {
      const now = Date.now();
      const due = dueFreeTokens(now, state.lastFreeGrantAt);
      if (due > 0) {
        setState({
          tokens: state.tokens + due,
          lastFreeGrantAt: now,
        });
      }
      return due;
    },

    /** How many free tokens the player can claim right now. */
    pendingFreeTokens: (): number => {
      return dueFreeTokens(Date.now(), state.lastFreeGrantAt);
    },

    /**
     * Has the player already seen the FIRST-PLAY DEMO for this cabinet?
     *
     * Treats existing players as already-tutored on any cabinet they've
     * scored on (a `cabinetBests` entry implies they've played at least
     * once and don't need the introduction). New players coming in fresh
     * see the tutorial on every cabinet's first visit.
     */
    hasSeenTutorial: (gameId: string): boolean => {
      if (state.seenTutorials?.[gameId]) return true;
      if (state.cabinetBests?.[gameId] != null) return true;
      return false;
    },

    /**
     * Mark the FIRST-PLAY DEMO as dismissed for this cabinet — they
     * won't see it again. Persisted to disk on next setState flush.
     */
    markTutorialSeen: (gameId: string) => {
      if (state.seenTutorials?.[gameId]) return;
      setState({
        seenTutorials: { ...state.seenTutorials, [gameId]: true },
      });
    },

    /**
     * Flip a single audio/haptic toggle. Persists to AsyncStorage.
     * Returns the new value so the caller can update local UI state
     * without an extra render trip.
     */
    setSetting: <K extends keyof PlayerSettings>(
      key: K,
      value: PlayerSettings[K],
    ): PlayerSettings[K] => {
      setState({
        settings: { ...state.settings, [key]: value },
      });
      return value;
    },

    /**
     * Wipe all local player state and return to first-launch defaults.
     * Used by the Settings → DELETE ACCOUNT flow. Caller is responsible
     * for any server-side scrub (Supabase RPC) before invoking this.
     */
    resetPlayer: async (): Promise<void> => {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        /* swallow — even if disk write fails, in-memory wipe still happens */
      }
      state = { ...initial, settings: { ...defaultSettings }, firstSeenAt: Date.now() };
      subscribers.forEach((fn) => fn(state));
      persist();
    },

    /**
     * Try to redeem a promo code. Returns one of:
     *   { ok: true, tokens, label } — granted (also updates state)
     *   { ok: false, reason: 'invalid' | 'used' }
     */
    redeemPromoCode: (
      input: string,
    ):
      | { ok: true; tokens: number; label: string; code: string }
      | { ok: false; reason: 'invalid' | 'used' } => {
      const promo = findPromoCode(input);
      if (!promo) return { ok: false, reason: 'invalid' };
      if (state.redeemedCodes.includes(promo.code)) {
        return { ok: false, reason: 'used' };
      }
      setState({
        tokens: state.tokens + promo.tokens,
        redeemedCodes: [...state.redeemedCodes, promo.code],
      });
      return {
        ok: true,
        tokens: promo.tokens,
        label: promo.label,
        code: promo.code,
      };
    },

    /**
     * Reward a player who just finished a run. Issues bonus tokens for
     * personal bests and leaderboard milestones (top 10, top 1). Each
     * bonus is awarded at most once per cabinet for the milestone tiers
     * to prevent farming.
     *
     * Returns a detailed result so the UI can pick the right celebration
     * tier ("PERSONAL BEST" vs "TOP 10!" vs "WORLD RECORD"):
     *   - bonus: total tokens credited this call
     *   - isPb: this run beat the player's previous best on the cabinet
     *   - isFirstTop10: first time this player ever ranked top-10 here
     *   - isFirstTop1: first time this player ever took #1 here
     *   - prevBest: the score they were beating (null on first ever play)
     *
     * Score comparison respects "lower is better" games via the
     * `lowerIsBetter` flag the caller passes in.
     */
    grantPbBonusIfBetter: (args: {
      gameId: string;
      score: number;
      rank: number;
      lowerIsBetter: boolean;
    }): {
      bonus: number;
      isPb: boolean;
      isFirstTop10: boolean;
      isFirstTop1: boolean;
      prevBest: number | null;
    } => {
      const prev = state.cabinetBests[args.gameId];
      const prevBest = prev == null ? null : prev;
      const isPb =
        prev == null
          ? true
          : args.lowerIsBetter
            ? args.score < prev
            : args.score > prev;
      const isFirstTop10 =
        args.rank <= 10 && !state.top10Awarded.includes(args.gameId);
      const isFirstTop1 =
        args.rank === 1 && !state.top1Awarded.includes(args.gameId);

      let bonus = 0;
      const patch: Partial<PlayerState> = {};

      if (isPb) {
        bonus += PB_BONUS_TOKENS;
        patch.cabinetBests = { ...state.cabinetBests, [args.gameId]: args.score };
      }
      if (isFirstTop10) {
        bonus += TOP10_BONUS_TOKENS;
        patch.top10Awarded = [...state.top10Awarded, args.gameId];
      }
      if (isFirstTop1) {
        bonus += TOP1_BONUS_TOKENS;
        patch.top1Awarded = [...state.top1Awarded, args.gameId];
      }
      if (bonus > 0) {
        patch.tokens = state.tokens + bonus;
        setState(patch);
      }
      return { bonus, isPb, isFirstTop10, isFirstTop1, prevBest };
    },
  };
}
