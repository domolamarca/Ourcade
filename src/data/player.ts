// In-memory player state. Swap out for AsyncStorage later (single drop-in:
// keep the same hook signature and persist on set).

import { useEffect, useState } from 'react';

type PlayerState = {
  initials: string;
  coins: number;
  totalPlays: number;
  highScores: number; // count of #1 entries
};

const initial: PlayerState = {
  initials: 'DOM',
  coins: 99, // arcade vibes — start with a stack
  totalPlays: 14,
  highScores: 2,
};

// Simple subscriber pattern so multiple screens stay in sync.
let state: PlayerState = { ...initial };
const subscribers = new Set<(s: PlayerState) => void>();

function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn(state));
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
    spendCoin: () => setState({ coins: Math.max(0, state.coins - 1) }),
    recordPlay: () => setState({ totalPlays: state.totalPlays + 1 }),
    recordHighScore: () => setState({ highScores: state.highScores + 1 }),
  };
}
