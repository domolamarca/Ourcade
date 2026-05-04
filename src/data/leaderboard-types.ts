// Shared types for the leaderboard module. Pulled out so that
// mock-scores.ts can import without creating a circular dep with
// leaderboard.ts (which depends on the Supabase client and is therefore
// import-heavy).

export type Score = {
  id: string;
  initials: string;
  gameId: string;
  score: number;
  unit: string;
  date: string; // ISO date
  city?: string;
  // Composite-score detail used by Minesweep / Tilt Maze.
  level?: number;
  taps?: number;
};

export type Timeframe = 'today' | 'week' | 'all';
