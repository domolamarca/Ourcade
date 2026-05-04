# Ourcade — Monetization Strategy

Captures the token economy, paid-IAP plan, and the trade-offs that drove the design decisions. Living doc — update as we ship.

---

## TL;DR

**Free-tier economy is generous** — most players never hit zero tokens. **IAP is for grinders** who want to keep pushing world records past their daily allotment. **Apple's cut is 15%** if we opt into the Small Business Program (we will).

Total ongoing infra cost: $99/yr Apple Developer fee. Everything else free at our scale.

---

## 1. Current token economy

| Source | Amount | Frequency |
|---|---|---|
| First-launch grant | 50 tokens | Once |
| Daily drop | 50 tokens | Every 24h (UTC midnight reset, up to 3-day catch-up) |
| Daily challenge cabinet | Free play | Always — one cabinet rotates daily, no token cost |
| Promo codes | 25 – 2,500 tokens | One-shot, drops via social/email |

A token = one play. 1 token ≈ 30 seconds to 5 minutes of gameplay depending on cabinet.

**Realistic player budget:** 50 tokens/day = 50 plays. A casual session is 5–15 plays. So a typical user has ~3+ days of normal play in a single daily allotment. Most players never run out.

## 2. What happens when a player hits zero

Without IAP, a zero-balance player has three options:

1. **Wait for the daily drop** — refreshes at 00:00 UTC every day
2. **Play the daily challenge cabinet** — one cabinet is always free, every day
3. **Redeem a promo code** — if they catch one on social

The shop screen (`app/shop.tsx`) handles this gracefully: balance card, daily-drop banner with CLAIM button when ready, promo code redemption box. When IAP is off, we'd swap "Token Packs" for a "More packs coming soon" line.

## 3. Mitigations that ship at v1 launch (no IAP needed)

These keep the free experience welcoming so the run-out moment isn't punitive:

### 3.1 AsyncStorage persistence
Tokens, initials, redeemed codes, total plays — all persist to disk via `@react-native-async-storage/async-storage`. Hydrated at boot. **Solves:** tokens reset on every app cold start (current bug). **Doesn't solve:** uninstall (that's an IAP-grade problem).

### 3.2 7-day welcome bonus
New accounts get **100 tokens/day for their first week** (vs. the standard 50/day). Drops to 50/day after day 7. Gives players a generous taste during the period when they're deciding if they like the app.

### 3.3 Personal-best token bonuses
Earn tokens by playing well:
- First time on a cabinet's top 10: **+20 tokens**
- New personal best on any cabinet: **+5 tokens**
- (Future) First time #1 globally: **+50 tokens**

Self-balancing: skilled players replenish faster, encouraging the "one more run" loop.

### 3.4 First-launch initials prompt
New users land on a "PICK YOUR INITIALS" screen before the lobby. Saves to persistent player state. **Solves:** every new player's first leaderboard entry showing as "DOM" (the dev default).

## 4. Paid IAP — the plan

### 4.1 Pack catalog (already defined in `src/data/player.ts`)

| Pack | Tokens | Price | Discount | Plays |
|---|---|---|---|---|
| STARTER | 100 | $0.99 | — | ~100 |
| VALUE | 250 | $1.99 | 20% | ~250 |
| POWER | 600 | $3.99 | 34% | ~600 |
| TOURNAMENT | 2,000 | $9.99 | 50% | ~2,000 |
| LEGEND | 5,000 | $19.99 | 60% | ~5,000 |

Penny-per-play floor on the smallest pack; aggressive discounts up the ladder so the LEGEND pack is the obvious choice for serious players.

### 4.2 Tech stack

- **`react-native-iap`** — open-source MIT, mature, handles iOS StoreKit + Android Play Billing. Native module (won't run in Expo Go — needs an EAS dev build).
- **Consumable products** — tokens are spent, so each pack registers as a consumable IAP. Apple permits client-side credit on success; restore-purchases not strictly required.
- **Receipt validation** — for v1 we credit client-side after StoreKit confirms payment. v1.1 should add server-side validation via a Supabase Edge Function that hits Apple's verifyReceipt endpoint.

### 4.3 Implementation in the app

```
shop.tsx BUY button
  ↓
react-native-iap requestPurchase(productId)
  ↓
StoreKit dialog → user pays
  ↓
purchaseUpdatedListener fires with receipt
  ↓
player.grantTokens(pack.tokens)  ← v1 client trust
  ↓
finishTransaction()
  ↓
"+N TOKENS" haptic + toast
```

v1.1 inserts a server-validation step between "purchase fired" and "grantTokens":

```
purchase → Supabase Edge Function → verify receipt with Apple → write to user's tokens row → app reads new balance
```

### 4.4 Apple-side setup (one-time, ~1-2 hours)

Required steps in App Store Connect before the IAP works:

1. **Register 5 IAP products.** Each pack gets a unique product ID matching `pack.id` in our data file:
   - `com.ourcade.tokens.starter`
   - `com.ourcade.tokens.value`
   - `com.ourcade.tokens.power`
   - `com.ourcade.tokens.tournament`
   - `com.ourcade.tokens.legend`
   
   Each needs: type (consumable), reference name, price tier, localized display name + description, review screenshot.

2. **Tax + banking.** App Store Connect → Agreements, Tax, and Banking. W-9 (US) or equivalent. Bank account for direct deposit. Apple holds the first payout for ~45 days while they verify.

3. **Small Business Program enrollment.** App Store Connect → Apps → enroll. Drops Apple's cut from 30% → 15% on the first $1M/year of revenue. Easy to qualify if you're a new individual/small business.

4. **Sandbox tester accounts.** Free Apple IDs for testing purchases without real money. App Store Connect → Users and Access → Sandbox Testers. Create one per email alias.

5. **Sandbox test in TestFlight.** Sign into the sandbox tester on your iPhone (Settings → App Store → Sandbox Account), open the dev build, run through each pack purchase, confirm tokens credit correctly.

### 4.5 EAS Build requirement

`react-native-iap` includes native iOS code, so once IAP is wired the app **stops running in Expo Go**. From that point forward you build dev clients and TestFlight builds via EAS:

```bash
eas build --platform ios --profile development  # for daily testing
eas build --platform ios --profile production   # for App Store / TestFlight
```

The QR-code flow keeps working for non-IAP screens, but tapping BUY in Expo Go would crash. Plan to switch to EAS dev builds before testing IAP.

## 5. Cost analysis

### 5.1 Per-purchase economics (Small Business Program, 15% Apple cut)

| Pack | Price | Apple takes | You get | Per-token revenue |
|---|---|---|---|---|
| STARTER | $0.99 | $0.15 | $0.84 | $0.0084 |
| VALUE | $1.99 | $0.30 | $1.69 | $0.0068 |
| POWER | $3.99 | $0.60 | $3.39 | $0.0057 |
| TOURNAMENT | $9.99 | $1.50 | $8.49 | $0.0042 |
| LEGEND | $19.99 | $3.00 | $16.99 | $0.0034 |

Without Small Business Program (30% cut) you'd take home roughly half as much net.

### 5.2 Infrastructure cost

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/yr | Required for the App Store |
| App Store distribution | $0 | Apple's CDN |
| Supabase (free tier) | $0 | Until 500MB DB / 2GB egress / 50k MAU |
| Edge Function invocations | $0 | 500K/mo on free tier; receipt validation = 1 call per purchase |
| Privacy + support pages | $0 | GitHub Pages |
| Domain (optional) | ~$12/yr | If we want ourcade.com |

**Total: $99/yr** until we have many tens of thousands of monthly active users.

### 5.3 When we hit a paid Supabase tier

Roughly when we cross 50k MAU or 8GB monthly bandwidth. At that point Supabase Pro = $25/mo. Should be a great problem to have.

## 6. Future work (post-launch)

### 6.1 v1.1 — server-side IAP validation
Move receipt verification into a Supabase Edge Function. App sends StoreKit receipt → function calls Apple's verifyReceipt endpoint → if valid, increments token balance in Supabase. Closes the "user spoofs purchase, gets free tokens" hole.

### 6.2 v1.1 — Supabase Anonymous Auth
Every device gets a real `user_id` from Supabase on first launch (no email needed). Scores key off `user_id`. Tokens live on the server. **Solves:** uninstall losing your tokens. Players can later "claim" their account via email link to migrate to a new phone.

### 6.3 v1.x — Watch-an-ad for tokens (maybe)
Adds AdMob (or similar). Optional 30-second ad → +10 tokens. Real-money path without forcing IAP. Some players prefer ads to direct payment.

### 6.4 v2 — Subscriptions?
"OURCADE+ — unlimited plays, $4.99/mo." Subscription product type in App Store Connect. Significant extra complexity (renewal, lapse handling, restore-on-lapse). Not v1 territory.

## 7. Migration path summary

```
v1 (now)
├── AsyncStorage tokens (survives kill, not uninstall)
├── Free-tier generous (50 start, 50/day, free daily challenge, PB bonuses)
├── Promo code system (one-time per device)
├── react-native-iap wired to consumable IAP
├── Client-trusts-StoreKit token credit
└── Apple App Store Connect: 5 products, tax/banking, SBP enrolled

v1.1 (post-launch hardening)
├── Supabase Anonymous Auth (real user_id)
├── Server-side tokens table
├── Edge Function receipt validation
└── Cross-device token persistence

v1.x — v2 (growth iterations)
├── Watch-an-ad rewarded video
├── Subscription tier
└── Backend-side promo code redemption (uninstall-safe)
```

---

Last updated: 2026-05-03
