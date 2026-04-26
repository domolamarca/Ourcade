// Promo codes — redeemable token grants.
//
// Each player can redeem a given code at most once. The redemption set is
// tracked on the player state (in-memory for v1, swap to AsyncStorage when
// we wire persistence). New codes can be dropped in here without any
// schema migration; the code itself is the primary key.
//
// Keep this file synced with whatever marketing/promo flows are sending
// codes out. When dropping a code in a Tweet/email/etc., just add a row
// here and ship.

export type PromoCode = {
  /** Normalized to uppercase + trimmed at lookup time. */
  code: string;
  /** Tokens granted on successful redemption. */
  tokens: number;
  /** Short label shown in the success toast. */
  label: string;
};

export const PROMO_CODES: PromoCode[] = [
  // Welcome / starter codes — small grants, easy to share.
  { code: 'WELCOME', tokens: 100, label: 'Welcome to Ourcade' },
  { code: 'INSERTCOIN', tokens: 25, label: 'Coin slot bonus' },
  { code: 'PLAYER1', tokens: 50, label: 'Player one ready' },
  { code: 'OURCADE', tokens: 75, label: 'Brand bonus' },
  { code: 'NEONLIGHT', tokens: 60, label: 'Neon night drop' },

  // Mid-tier — for newsletter / social drops.
  { code: 'ARCADE2026', tokens: 250, label: 'Anniversary drop' },
  { code: 'HIGHSCORE', tokens: 200, label: 'Leaderboard fuel' },
  { code: 'TOURNAMENT', tokens: 500, label: 'Tournament starter' },
  { code: 'DAILYDOUBLE', tokens: 400, label: 'Daily double' },

  // Big drops — for milestones / partnership / press.
  { code: 'WORLDRECORD', tokens: 1000, label: 'World record stash' },
  { code: 'LEGEND', tokens: 1500, label: 'Legendary drop' },
  { code: 'KINGOFTHEHILL', tokens: 2500, label: 'King of the hill' },
];

/**
 * Look up a code by user-typed input. Returns null if no match. Does NOT
 * check redemption state — that lives on the player.
 */
export function findPromoCode(input: string): PromoCode | null {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) return null;
  return PROMO_CODES.find((p) => p.code === normalized) ?? null;
}
