# Ourcade — App Store Launch Checklist

Track everything from "code on a phone" to "live in the App Store." Tick the box (`- [ ]` → `- [x]`) as items land.

---

## 0. Hosting & infrastructure summary

Apple distributes the app itself for free — once approved, the `.ipa` lives on Apple's CDN and downloads are zero cost to you. Your only ongoing infra:

| Piece | Service | Cost |
|---|---|---|
| App distribution | Apple App Store | $0 (covered by $99/yr developer fee) |
| Leaderboard DB | Supabase (free tier) | $0 until 500MB DB / 2GB egress / 50k MAU |
| Privacy + support pages | GitHub Pages | $0 |
| Custom domain | Namecheap / Cloudflare | ~$12/yr (optional) |

**~$99/year** to be on the App Store, period. Scaling kicks Supabase to ~$25/mo somewhere around 50k monthly active players.

## 1. Apple Developer setup

- [ ] Enroll in Apple Developer Program ($99/yr, ID-verified, 24–48h)
- [ ] Register `com.ourcade.app` bundle ID in developer portal
- [ ] Confirm signing certs are managed by EAS (no manual cert wrangling needed)
- [ ] Create an App Store Connect entry (name: Ourcade, SKU, primary category)
- [ ] Complete the age-rating questionnaire on the listing
- [ ] Provide reviewer contact info / demo account on listing if required

## 2. Privacy + legal

- [ ] Publish a privacy policy at a public URL (GitHub Pages or simple site is fine)
- [ ] Publish a support URL (mailto page works)
- [ ] Fill out App Store Connect data-collection disclosure (currently zero data → simple)
- [ ] Confirm mic and camera audio/photos are NOT stored or transmitted (verify in code)

## 3. Code prep before submitting

- [ ] `DEMO_MODE` flipped to `false` in `app/play/slipstream.tsx`
- [ ] Search-and-remove dev / demo / WIP copy across the app
- [ ] Strip the `"DEV BUILD — NO REAL CHARGES."` line from `app/shop.tsx`
- [ ] Decide on Polaroid: finish it OR remove from `src/data/games.ts` catalog before submit
- [ ] Verify `assets/sounds/*.wav` bundle correctly in an EAS production build (test Pulse audio on TestFlight)
- [ ] Test on a real iPhone (sensors don't all work in simulator)
- [x] Camera usage description in `app.json`
- [x] Microphone usage description in `app.json`
- [x] Motion usage description in `app.json`
- [x] Portrait orientation locked

## 4. EAS build pipeline

- [ ] `npm i -g eas-cli`
- [ ] `eas login`
- [ ] `eas build:configure` (creates `eas.json`)
- [ ] First production build: `eas build --platform ios --profile production`
- [ ] Verify build downloads + opens on a physical device (TestFlight or direct install)

## 5. Credit economy

v1.0 ships **free** — no purchases of any kind. The credit system is
fully self-sustaining via the daily drop, the welcome bonus, personal-
best bonuses, and promo codes. No payment surface exists in the v1.0
build, no products are configured in App Store Connect, no tax forms
are required.

- [x] AsyncStorage persistence for player state (credits, initials, redeemed codes survive app kill)
- [x] First-launch initials prompt — new players pick their 3 letters before the lobby
- [x] 7-day welcome bonus — 100 credits/day for first week, 50/day after
- [x] Personal-best credit rewards — +5 PB, +20 first top-10, +50 first #1
- [x] Daily challenge cabinet always free
- [x] Promo code system

## 6. Leaderboard — Supabase (chosen)

Code wiring is **complete**. Falls back to mock data until you plug in real credentials. Full setup steps live in `SUPABASE_SETUP.md`.

- [x] Pick provider — Supabase
- [x] Install `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`
- [x] Create Supabase client (`src/lib/supabase.ts`) + config placeholder (`src/lib/supabase-config.ts`)
- [x] Refactor `src/data/leaderboard.ts` — async load on boot, sync getters from cache, `submitScore()` for inserts
- [x] Wire `loadLeaderboard()` in `app/_layout.tsx` boot path
- [x] Wire `submitScore()` from result screen SUBMIT button
- [x] Mock-data fallback when Supabase is unconfigured
- [ ] **Create a Supabase project** (free tier, https://supabase.com)
- [ ] **Run schema SQL** from `SUPABASE_SETUP.md` step 3
- [ ] **Enable RLS + policies** from `SUPABASE_SETUP.md` step 4
- [ ] **Paste real `SUPABASE_URL` + `SUPABASE_ANON_KEY`** into `src/lib/supabase-config.ts`
- [ ] (Optional) Run seed-data SQL from `SUPABASE_SETUP.md` step 5
- [ ] **Run `npm install`** to fetch the new dependencies
- [ ] Test: play a cabinet → tap SUBMIT → confirm new row in Supabase Table Editor
- [ ] (Later) Add rate-limiting + per-game score caps once abuse becomes a real problem

## 7. Visual assets

- [ ] App icon — 1024×1024 PNG, no transparency, no rounded corners
- [ ] Adaptive icon variants for required iOS sizes (Expo handles from 1024×)
- [ ] Splash / launch screen image configured via `expo-splash-screen`
- [ ] Screenshots — required:
  - [ ] iPhone 6.7" (1290×2796) — 3 to 10 shots
  - [ ] iPhone 6.5" (1242×2688) — 3 to 10 shots
  - [ ] iPhone 5.5" (1242×2208) — 3 to 10 shots (optional but covers older devices)
- [ ] Suggested screenshot lineup:
  - [ ] Lobby with daily challenge card
  - [ ] Tilt Maze mid-level
  - [ ] Pulse mid-run
  - [ ] Trivia question + score screen
  - [ ] Slipstream with bombs / tunnels
  - [ ] Result screen with leaderboard
- [ ] App preview video (15–30s, optional but boosts conversion)

## 8. Marketing copy

- [ ] App name: **Ourcade** (already set)
- [ ] Subtitle (30 chars): e.g. "everyone's arcade"
- [ ] Description (4000 chars max): pitch + cabinet list + how scoring works
- [ ] Keywords (100 chars max): comma-separated, no spaces — `arcade,sensor,leaderboard,trivia,reflex,...`
- [ ] Promotional text (170 chars max, editable without resubmission)
- [ ] What's New (for updates)
- [ ] Categories: Games → primary "Action" or "Casual"; secondary at your discretion

## 9. Content review pass

- [ ] Read the trivia question bank — flag anything religious / political / medical
- [ ] No copyrighted brand logos in icons or assets
- [ ] No mention of competitor app stores or "best on iOS" superlatives
- [ ] Verify the Pulse music + note WAVs aren't recognizable copyrighted melodies (they're synthetic, should be fine)

## 10. TestFlight beta

- [ ] Upload first build via `eas submit --platform ios`
- [ ] Internal testing group (you + ~5 friends, no Apple review needed)
- [ ] Test all sensors on real iPhone:
  - [ ] Camera (Polaroid — if shipping)
  - [ ] Microphone (Dead Air, Pulse audio output)
  - [ ] Accelerometer (Tilt Maze, Slipstream, Walk the Line)
  - [ ] DeviceMotion (Walk the Line yaw)
- [ ] Test all 11 (or 12) cabinets end-to-end: pre-game → play → result
- [ ] Test EXIT chip works on every play screen
- [ ] Test long Slipstream/Pulse runs for memory leaks (>5 min)
- [ ] Test offline behavior — confirm nothing requires network in v1
- [ ] Test promo code redemption (try all 12 codes, verify one-time-use)

## 11. Pre-submission checklist (Apple's common rejection causes)

- [ ] Every interactive element responds (no dead-end screens)
- [ ] Every game can be exited mid-run (EXIT chip + confirm dialog)
- [ ] No crashes on launch (try cold start, background → foreground, low memory)
- [ ] No placeholder text in user-visible UI (search for `TODO`, `FIXME`, `XXX`)
- [ ] No external links to non-iOS purchase pages
- [ ] No mention of beta / alpha / unfinished status

## 12. Submission

- [ ] Final EAS production build uploaded
- [ ] Build attached to the App Store Connect listing
- [ ] All metadata fields filled in (description, keywords, screenshots, support URL)
- [ ] Submit for review
- [ ] Respond to reviewer questions within 24h if asked (typical first review = 24–48h)
- [ ] Approved → schedule release date (manual or auto-on-approval)
- [ ] **🎉 Live on the App Store**

## 13. Post-launch (v1.1+)

- [ ] Add a backend if Game Center isn't enough
- [ ] Push notifications (daily challenge reminder?)
- [ ] iPad support (currently `supportsTablet: false`)
- [ ] Android via EAS Build → Google Play
- [ ] More cabinets / more shapes / more questions
- [ ] Live world records pulled from your backend → marquee on title screen

---

**Fastest possible path:** v1.0 ships free (no IAP) + Supabase leaderboards + minimal screenshots + hosted privacy page = ~5 focused days from "now" to "submitted." First review usually completes within 48h.

Last updated: 2026-05-03
