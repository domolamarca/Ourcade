# Ourcade

Mini-games built around iPhone sensors, with a global leaderboard and an arcade-cabinet aesthetic. **OUR + arCADE** — everyone's arcade, every record yours.

Tap Bullseye is wired up as the first real game (continuous-spawn survival mode — let one target expire and the run is over). The other cabinets still route to a fake-score result so you can exercise the full flow while we build them.

## Run it

```bash
cd sensor-arcade
npm install
npx expo start
```

Then open Expo Go on your iPhone and scan the QR code. The theme preview works in Expo Go — no dev build needed yet.

If npm complains about peer-dep mismatches, run `npx expo install --fix` and try again.

## What you'll see

- **Title screen** — INSERT COIN marquee, blinking "PRESS ANYWHERE."
- **Lobby (tab 1)** — grid of 8 game cabinets, color-coded by sensor category. Tap one.
- **Hall of Fame (tab 2)** — per-game leaderboard with timeframe pills (today / week / all time). Mock scores.
- **Profile (tab 3)** — editable 3-letter initials, credit count, sensor-permission status panel.
- **Pre-game** — game description, your best, world record, top 5, blinking PRESS START.
- **Result** — score reveal, NEW WORLD RECORD callout, classic arcade initials entry.

## Architecture

```
app/                     # expo-router file-based routes
  _layout.tsx            # root: font loading, splash control
  index.tsx              # title / "INSERT COIN"
  (tabs)/                # bottom-tab group
    home.tsx             # lobby
    leaderboard.tsx      # hall of fame
    profile.tsx
  game/[id].tsx          # pre-game splash
  result/[id].tsx        # score + initials entry

src/
  theme/index.ts         # colors, fonts, spacing, glow helper
  components/            # ArcadeText, NeonFrame, ScanlineOverlay,
                         # Marquee, Blink, GameCabinetCard,
                         # HighScoreRow, InitialsEntry, GameIcon
  data/                  # games registry, mock leaderboard, in-memory player
```

## Design tokens

- Background: near-black (`#08080f`) with elevated surfaces for depth.
- Neon palette: magenta, cyan, yellow, green, purple, orange, red, blue. Each game in `src/data/games.ts` is assigned an `accentColor` from this set — its cabinet, scoreboard glow, and title text all key off it.
- Typography: **Press Start 2P** for headings/scores (chunky 8-bit), **VT323** for body and longer leaderboard text (terminal mono).
- Subtle scanline overlay on every screen at low opacity to hint at CRT.

## Next steps (in order)

1. **Wire one real game first — Tap Bullseye.** Build `app/play/tap-bullseye.tsx`, change the pre-game `startGame()` to route there. Validates the full play→submit loop on a touch-only game with no sensor permissions to wrangle.
2. **Pick a leaderboard backend.** Recommendation: Supabase with anonymous auth — Postgres queries make daily/weekly/all-time leaderboards trivial, and anon auth means no signup friction. Replace the functions in `src/data/leaderboard.ts` with Supabase queries.
3. **Add motion games.** Switch to a dev build (`npx expo prebuild` + EAS Build) so `expo-sensors` is included. Implement Dead Still and 360 Spin.
4. **Localized leaderboards** for the high-rise / city games — store a city tag with each score, query a per-city ranking.
5. **Combo / tie-breaker games.** The data model already supports them via `sensors: ['TOUCH', 'ACCEL']`.

## Known TODOs

- The play screens are stubs — pressing START on any game jumps straight to a result with a randomized score. This is intentional for the theme preview.
- `src/data/player.ts` is in-memory only — refresh the app and your initials reset. Swap to AsyncStorage when you start saving real scores.
- The "world record" check in `app/result/[id].tsx` compares to mock data. Will need server-side validation once Supabase is wired in.
- No haptics or sound effects yet. `expo-haptics` and `expo-av` are the targets.
- Splash screen uses default — add a real splash image and switch the `expo-splash-screen` plugin back on in `app.json`.
