// Send-a-Challenge plumbing.
//
// A challenge is a one-way URL handed off through iOS Messages: player
// A finishes a run, taps CHALLENGE, picks a contact, hits send. Player
// B taps the link, opens Ourcade to the same cabinet, and plays trying
// to beat the score. If they win, the result screen offers a SEND IT
// BACK button that re-opens Messages with a new challenge.
//
// URL format:
//   ourcade://game/<cabinetId>?challenger=<initials>&cscore=<score>
//
// We intentionally do NOT validate the score server-side — anyone can
// hand-craft a URL with score=999999. That's a v2 problem; right now
// the social cost of fudging a friendly challenge is on the cheater.
//
// State is held in-memory (not AsyncStorage) so quitting + re-opening
// the app drops you out of challenge mode, which is the right behavior
// — challenges are session-scoped, not part of your saved player.

import { Game } from '../data/games';

export type ActiveChallenge = {
  gameId: string;
  challenger: string; // 3-letter initials
  challengerScore: number;
};

let active: ActiveChallenge | null = null;

export function getActiveChallenge(): ActiveChallenge | null {
  return active;
}

export function setActiveChallenge(c: ActiveChallenge | null) {
  active = c;
}

export function clearActiveChallenge() {
  active = null;
}

/**
 * Returns true if the just-finished run on `gameId` with `score` beat the
 * active challenger's score. Respects "lower is better" cabinets via the
 * `lowerIsBetter` flag the caller passes in (matches leaderboard.ts).
 */
export function didBeatActiveChallenge(
  gameId: string,
  score: number,
  lowerIsBetter: boolean,
): boolean {
  if (!active) return false;
  if (active.gameId !== gameId) return false;
  return lowerIsBetter
    ? score < active.challengerScore
    : score > active.challengerScore;
}

/** Build the deep-link URL that goes inside the iMessage body. */
export function buildChallengeUrl(
  gameId: string,
  initials: string,
  score: number,
): string {
  const safeInitials = initials.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'AAA';
  return `ourcade://game/${gameId}?challenger=${safeInitials}&cscore=${score}`;
}

/**
 * The body players will see in iMessage when they receive a challenge.
 * Native Share sheet picks up the URL automatically as a tappable link
 * on iOS, so we keep the prose short and let the URL do the work.
 */
export function buildChallengeMessage(args: {
  game: Game;
  initials: string;
  score: number;
  formattedScore: string;
}): string {
  return `Beat me on ${args.game.name} — ${args.formattedScore} ${args.game.unit} on OURCADE 🎮\n\n${buildChallengeUrl(args.game.id, args.initials, args.score)}`;
}
