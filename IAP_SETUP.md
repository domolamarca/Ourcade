# In-App Purchase setup

Walking the project from "no IAP" to "real money via App Store." Heads up: this requires graduating from Expo Go to an EAS dev build, since `react-native-iap` is a native module that Expo Go doesn't ship.

The five token packs are already defined in `src/data/player.ts` (`TOKEN_PACKS`). This guide wires real StoreKit purchases to those packs.

---

## 1. App Store Connect — register your products

You need an active Apple Developer account ($99/yr) and an app listing for `com.ourcade.app` in App Store Connect. Once that exists:

**App Store Connect → My Apps → Ourcade → Monetization → In-App Purchases → Create**.

Create five **Consumable** in-app purchase products. Use these exact product IDs so they match the `pack.id` values in our code:

| Pack ID | Product ID | Reference Name | Price (USD tier) |
|---|---|---|---|
| `starter` | `com.ourcade.tokens.starter` | Starter — 100 tokens | Tier 1 ($0.99) |
| `value` | `com.ourcade.tokens.value` | Value — 250 tokens | Tier 2 ($1.99) |
| `power` | `com.ourcade.tokens.power` | Power — 600 tokens | Tier 4 ($3.99) |
| `tournament` | `com.ourcade.tokens.tournament` | Tournament — 2000 tokens | Tier 10 ($9.99) |
| `legend` | `com.ourcade.tokens.legend` | Legend — 5000 tokens | Tier 20 ($19.99) |

For each product, fill in:
- Reference name (internal, only Apple sees)
- One **localization** for English (US): display name (e.g., "Starter Pack — 100 tokens"), description (e.g., "100 tokens. About 100 plays.")
- One **review screenshot** showing the IAP UI in your app — Apple wants to see what the player sees before buying. Take this from a TestFlight build.
- Status: "Ready to Submit" — no final approval until your first IAP-containing build is reviewed.

## 2. Tax + banking + Small Business Program

**App Store Connect → Agreements, Tax, and Banking**. Required before Apple can pay you.

- **Paid Apps Agreement** — accept it. Status changes to "Active."
- **Tax Forms** — fill in the W-9 (US) or W-8 (non-US). Takes ~10 minutes.
- **Banking** — link a US business or personal bank account for direct deposit.
- **Small Business Program** — opt in via App Store Connect → Apps → Programs. Drops Apple's cut from 30% → 15% on the first $1M/year of revenue. Easy to qualify if you're a new individual or small business.

Apple holds the first payout for ~45 days while they verify the bank account. This doesn't delay your launch — it delays when money hits your account.

## 3. Generate sandbox testers

Sandbox testers let you make pretend purchases without real money. **App Store Connect → Users and Access → Sandbox Testers → +**.

Create 1-2 sandbox tester accounts (use email aliases like `you+sb1@yourdomain.com`). Note the password somewhere safe.

## 4. Add the native package

```bash
cd ~/Documents/WEgomaniac/sensor-arcade
npm install react-native-iap
```

Update `app.json` to register the Expo config plugin:

```jsonc
{
  "expo": {
    // ...
    "plugins": [
      "expo-router",
      "expo-asset",
      ["expo-camera", { "cameraPermission": "..." }],
      ["expo-sensors", { "motionPermission": "..." }],
      ["expo-av", { "microphonePermission": "..." }],
      "react-native-iap"   // <-- add this
    ]
  }
}
```

Native modules can't run in Expo Go. From this point, dev runs use EAS:

```bash
npm i -g eas-cli            # if you haven't already
eas login
eas build:configure         # one-time
eas build --platform ios --profile development
```

That produces an installable `.ipa`. Install on your iPhone via the link EAS gives you. From now on, instead of opening Expo Go, you tap the OURCADE app icon directly. The dev build still hot-reloads from your Metro server when you start it locally.

## 5. Wire the IAP layer in code

Drop this file in `src/lib/iap.ts`:

```ts
// Lazy wrapper around react-native-iap. Falls back to no-ops when the
// native module isn't available (e.g., running in Expo Go) so the app
// still loads in dev. Real purchases only fire in EAS dev / TestFlight
// / production builds.

import { TOKEN_PACKS } from '../data/player';

const PRODUCT_IDS = TOKEN_PACKS.map(
  (p) => `com.ourcade.tokens.${p.id}`,
);

export type IapProduct = {
  productId: string;
  price: string; // localized: "$0.99", "€0,99"
  title: string;
};

let mod: any = null;
let initialized = false;

function getMod() {
  if (mod) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-iap');
    return mod;
  } catch {
    return null;
  }
}

export async function initIap(): Promise<boolean> {
  if (initialized) return true;
  const m = getMod();
  if (!m) return false;
  try {
    await m.initConnection();
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export async function getProducts(): Promise<IapProduct[]> {
  const m = getMod();
  if (!m) return [];
  try {
    const products = await m.getProducts({ skus: PRODUCT_IDS });
    return products.map((p: any) => ({
      productId: p.productId,
      price: p.localizedPrice,
      title: p.title,
    }));
  } catch {
    return [];
  }
}

export async function buyProduct(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const m = getMod();
  if (!m) return { ok: false, error: 'iap unavailable' };
  try {
    await m.requestPurchase({ sku: productId });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function restorePurchases(): Promise<void> {
  const m = getMod();
  if (!m) return;
  try {
    await m.getAvailablePurchases();
    // Tokens are consumables — restore is mostly to clear stuck transactions.
  } catch {
    /* ignore */
  }
}

/** Subscribe to purchase events. Returns an unsubscribe fn. */
export function onPurchase(
  onSuccess: (productId: string) => void,
): () => void {
  const m = getMod();
  if (!m) return () => {};
  const sub = m.purchaseUpdatedListener(async (purchase: any) => {
    try {
      onSuccess(purchase.productId);
      await m.finishTransaction({ purchase, isConsumable: true });
    } catch {
      /* ignore */
    }
  });
  return () => sub.remove();
}

export function productIdForPack(packId: string): string {
  return `com.ourcade.tokens.${packId}`;
}
```

Then in `app/shop.tsx`, replace the mock `buy()` with:

```ts
import { useEffect } from 'react';
import {
  buyProduct, getProducts, initIap, onPurchase, productIdForPack,
} from '../src/lib/iap';
import { TOKEN_PACKS } from '../src/data/player';

// ... inside Shop():
useEffect(() => {
  let unsub: (() => void) | null = null;
  (async () => {
    const ok = await initIap();
    if (!ok) return;
    unsub = onPurchase((productId) => {
      const pack = TOKEN_PACKS.find(
        (p) => productIdForPack(p.id) === productId,
      );
      if (pack) player.grantTokens(pack.tokens);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
    await getProducts(); // warm cache
  })();
  return () => {
    if (unsub) unsub();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

function buy(pack: TokenPack) {
  buyProduct(productIdForPack(pack.id)).catch(() => {});
}
```

Apple's UI for the purchase confirmation, payment method, and Touch/Face ID prompt all happen inside StoreKit — you don't render any of that yourself.

## 6. Test in TestFlight (or EAS dev build)

On your iPhone:

1. **Settings → App Store** → scroll to **Sandbox Account** → sign in with the sandbox tester account you created.
2. Open the OURCADE dev build.
3. Lobby → tokens chip top right → BUY a pack.
4. Apple's StoreKit dialog shows "[Sandbox] Confirm purchase" — confirm.
5. Watch tokens credit, leaderboard tokens count update, balance persist across app restart.

Do this for at least the STARTER and LEGEND packs. Apple's reviewer will test all five during App Review.

If a purchase hangs or shows an error like "Cannot connect to iTunes Store", that's almost always a sandbox tester sign-in issue. Sign out, sign back in, retry.

## 7. Submit for App Review

When you submit your build, App Store Connect lets you attach IAP products to the submission. Include all five. Apple's reviewer will buy each one with their reviewer sandbox account during review.

Common rejections:
- IAP product display in your app doesn't match the price/description in App Store Connect.
- "Restore Purchases" button missing (Apple expects one even for consumables — for tokens, hook it to `restorePurchases()` even though it usually does nothing meaningful for consumables).
- Crash during purchase flow.

## 8. Server-side validation (deferred to v1.1)

For v1 we trust StoreKit's success callback and credit tokens client-side. A jailbroken device could potentially spoof success and grant themselves tokens.

For v1.1: write a Supabase Edge Function that takes the StoreKit receipt, calls Apple's `verifyReceipt` endpoint (https://buy.itunes.apple.com/verifyReceipt), and only credits the user's `tokens` row if Apple confirms the receipt is valid.

Deferred because:
- The attack surface is small (consumables, low value, sandbox testing catches most issues).
- You need Supabase Anonymous Auth set up first so each device has a stable `user_id`.
- Better to ship and learn what fraud (if any) actually happens than to over-engineer up front.

---

## Quick reference: what files changed

| File | Why |
|---|---|
| `package.json` | Added `react-native-iap` |
| `app.json` | Added `react-native-iap` config plugin |
| `src/lib/iap.ts` | New IAP wrapper |
| `app/shop.tsx` | Real BUY flow, restore button |

## Cost summary

- Apple's cut: **15%** with Small Business Program, 30% without
- Apple Developer Program: $99/yr (already required)
- Supabase (validation later): $0 on free tier
- StoreKit / IAP itself: free

For a $0.99 STARTER pack (Small Business): you keep $0.84.
