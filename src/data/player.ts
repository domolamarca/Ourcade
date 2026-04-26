// Player state — tokens, identity, stats, daily challenge logic.
// In-memory for v1; swap the store for AsyncStorage later (single
// drop-in: persist on every set).
//
// Token economy:
//   - Players start with STARTING_TOKENS the first time they open the app.
//   - DAILY_FREE_TOKENS dropped each calendar day (catch-up cap = 3 days).
//   - Tokens are spent at PRESS START (1 per play, including PLAY AGAIN).
//   - Each calendar day, ONE cabinet is the "daily challenge" — playing
//     it that day costs zero tokens. Rotates through the live cabinets.

import { useEffect, useState } from 'react';
import { games } from './games';
import { findPromoCode } from './promo-codes';

const STARTING_TOKENS = 50;
const DAILY_FREE_TOKENS = 50;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

type PlayerState = {
  initials: string;
  tokens: number;
  totalPlays: number;
  highScores: number;
  lastFreeGrantAt: number;
  redeemedCodes: string[];
};

const initial: PlayerState = {
  initials: 'DOM',
  tokens: STARTING_TOKENS,
  totalPlays: 14,
  highScores: 2,
  lastFreeGrantAt: 0,
  redeemedCodes: [],
};

let state: PlayerState = { ...initial };
const subscribers = new Set<(s: PlayerState) => void>();

function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn(state));
}

function dueFreeTokens(now: number, lastGrantAt: number): number {
  if (lastGrantAt === 0) return DAILY_FREE_TOKENS;
  const days = Math.floor((now - lastGrantAt) / ONE_DAY_MS);
  if (days <= 0) return 0;
  return Math.min(days, 3) * DAILY_FREE_TOKENS;
}

/** Returns the cabinet ID promoted as today's free daily challenge. */
export function getDailyCabinetId(now: number = Date.now()): string {
  const liveIds = games.filter((g) => g.status === 'live').map((g) => g.id);
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

    setInitials: (initials: string) =>
      setState({ initials: initials.padEnd(3, 'A').slice(0, 3).toUpperCase() }),

    /**
     * Try to spend one token to start a play. Returns true on success,
     * false if the player has none. Caller should route to /shop on false.
     * If `gameId` matches today's daily-challenge cabinet, no token is
     * spent and the call always returns true.
     */
    spendTokenFor: (gameId: string): boolean => {
      const isDaily = gameId === getDailyCabinetId();
      if (isDaily) {
        // Free play — still bump the play counter.
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

    /** Add tokens (purchase, daily grant, etc.). */
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
  };
}
