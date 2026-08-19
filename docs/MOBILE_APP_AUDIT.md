# LitwaysPicks Mobile — Engineering Audit & Work Tracker

**Audited:** July 2026 · full codebase (every screen, component, store, lib, config)
**Method:** Static read of all source, `tsc --noEmit` typecheck, runtime-flow tracing, dependency review.
**How to use:** Each item has a stable **ID**, priority, effort, and a checkbox. Work top-down by priority. Update the **Status** column as items move.

---

## Summary

| Priority | Meaning | Count | Resolved |
|----------|---------|-------|----------|
| **P0** | Blocker — breaks a core flow or ships broken | 5 | 4 (A-01,02,04*,05) — **A-03 left** |
| **P1** | High — functional gap / money or data risk | 5 | **5 ✓** (B-01,02†,03,04,05) |
| **P2** | Medium — duplication, cleanup, correctness edge | 7 | **7 ✓** (C-01…C-07) |
| **P3** | Low — hardening, polish, nice-to-have | 6 | 1 (D-02) — D-01,03,04,05,06 left |

\* A-04 code done, needs your SQL trigger · † B-02 de-risked, needs backend confirm. See **[ACTION_ITEMS.md](ACTION_ITEMS.md)** for everything awaiting you.

**Progress (2026-07-03):** Build green (`npm run typecheck` → 0 errors). **All P1 + all P2 done.** Only remaining P0 is A-03 (push), blocked on your EAS account. Remaining work is P3 hardening (tests/CI, a11y, notification typing, banners CMS) — none blocking.

**Headline:** The project **does not currently pass TypeScript** (27 errors), the **cart never saves back to the server** (so "cross-device cart" is not actually working), **push notifications are not production-wired**, and **new-user profile creation + password reset have likely-broken paths**. These are the things to fix before any launch.

Effort key: **S** ≈ <½ day · **M** ≈ ½–2 days · **L** ≈ 2–5 days.

---

## P0 — Blockers (fix first)

### [x] A-01 · TypeScript build is broken (27 errors) — **DONE** (2026-07-03)
`npx tsc --noEmit` failed with 27 errors. **Root cause was structural, not stale content:** the installed `@supabase/postgrest-js@2.106` requires every Table/View in the `Database` type to carry a `Relationships: GenericRelationship[]` field (plus a `__InternalSupabase` version marker). The generated [types/database.types.ts](../types/database.types.ts) had **none**, so no table satisfied `GenericTable`, the `public` schema failed `GenericSchema`, and the *entire* typed client collapsed to `never`/`undefined` — which is why RPC args looked like `undefined` and every insert looked like `never`.

**What was done:**
- Added `Relationships: []` to all tables + views, gave `products` its missing `Insert`/`Update`, and added the `__InternalSupabase` marker — i.e. the shape a current `supabase gen types` emits (regen-safe). This alone cleared the collapse (27 → 20).
- Made the `FlashList` shim generic ([components/ui/List.tsx](../components/ui/List.tsx)) so `renderItem`/`keyExtractor` infer their item type — cleared ~12 implicit-`any` errors at once.
- Fixed tab-icon `ColorValue` typing, the invalid `haptic` prop on `Button` (was C-07), loose notification `data` typing (part of D-04), and a `Json`→`CartItem[]` cast.
- **Surfaced & fixed a real bug:** correct types revealed the review insert was missing the **required `order_id`** column — reviews would have failed at runtime. Now passes `order_id: state.order.id` ([app/(tabs)/account.tsx](../app/(tabs)/account.tsx)).
- Added an `npm run typecheck` script as the CI gate.

**Result:** `npm run typecheck` → **0 errors.** (C-07 folded in here; D-04 partially done — `savePushToken` unused param still open.)

### [x] A-02 · Cart never persists to the server — **DONE** (2026-07-03)
`useCartStore.syncToDb()` was defined but called from nowhere; `loadFromDb` only *read* the server copy, so it went stale — contradicting the "cross-device cart sync" spec claim.
**What was done:** Added a `useCartStore.subscribe(...)` in the root layout ([app/_layout.tsx](../app/_layout.tsx)) that fires the store's existing debounced `syncToDb(userId)` whenever `items` changes while a user is signed in (guarded by `useAuthStore.getState().user?.id`). Reads (`loadFromDb`) and writes now round-trip, so the spec's cross-device claim holds. Typecheck green.
**Verify at runtime:** sign in on two sessions, add an item on one, confirm it appears on the other after reload.

### [ ] A-03 · Push notifications not production-wired — **M**
Two independent breakages:
1. **No EAS `projectId`** in [app.json](../app.json) → `getExpoPushTokenAsync({ projectId })` receives `undefined` and cannot mint a token in a production build. [lib/notifications.ts:56](../lib/notifications.ts#L56).
2. **Token stored in the wrong place** — `savePushToken` writes to Supabase Auth `user_metadata` (`auth.updateUser({ data: { push_token } })`), which the backend can't query to fan-out order notifications. [lib/notifications.ts:64](../lib/notifications.ts#L64).
**Fix:** Add the EAS project ID; persist the token to a queryable `users.push_token` column (or a `device_tokens` table); confirm the backend send path.

### [~] A-04 · New-user profile row blocked by RLS — **CODE DONE, needs 1 SQL step** (2026-07-03)
**Confirmed real:** email confirmation is ON, so `signUp()` returns no session and the old client-side `users` insert ran as anon → RLS rejected it → new users had no profile.
**What was done (app side):** signup now passes the name via `signUp({ options: { data: { first_name, last_name } } })` and the failing client insert was removed ([app/(auth)/login.tsx](../app/(auth)/login.tsx)). Typecheck green.
**⚠️ Requires you:** run the `handle_new_user` trigger SQL (a DB trigger creates the profile from signup metadata, immune to RLS). Full SQL is in **[ACTION_ITEMS.md](ACTION_ITEMS.md) → item #2**. Not complete until that trigger exists.

### [x] A-05 · Password reset cannot be completed in-app — **DONE** (2026-07-03)
The reset email pointed back at the email-entry screen and there was no way to set a new password.
**What was done:**
- New screen [app/(auth)/new-password.tsx](../app/(auth)/new-password.tsx): reads the incoming deep link (`Linking.useURL()` + `getInitialURL()` fallback), establishes a recovery session, then lets the user set + confirm a new password via `supabase.auth.updateUser({ password })`, signs out, and routes to login. Has verifying / invalid-link / ready states.
- **Robust to both auth flows:** parses tokens from the URL **fragment** (implicit flow — the current default, which `Linking.parse` can't read) *and* a `?code=` param (PKCE), so it keeps working if the flow type changes.
- Repointed the reset email `redirectTo` → `litwaypicks://new-password` ([app/(auth)/reset-password.tsx](../app/(auth)/reset-password.tsx)) and registered the route ([app/(auth)/_layout.tsx](../app/(auth)/_layout.tsx)).
- Verified: default `flowType` is `implicit`; typecheck green.

**⚠️ One manual step (yours):** In the Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**, add `litwaypicks://new-password` to the allow-list, or Supabase will strip the redirect and the link won't return to the app. Then test end-to-end on a device.

---

## P1 — High (functional / money / data risk)

### [x] B-01 · No stock or price re-validation at checkout — **DONE** (2026-07-03)
The persisted cart held `price`/`stock` from add-to-cart time; a user could pay a stale price or buy a sold-out item.
**What was done:** `handlePlaceOrder` now re-fetches live `price`/`sale_price`/`stock` from `products_with_categories` for all cart items before initiating payment. Any price change or stock shortfall aborts the charge, updates the cart to current values via a new `useCartStore.reconcile()` action (clamps quantity, drops sold-out items), sends the user back to review, and shows exactly what changed. Also folded in **D-02** (empty-cart guard). [app/checkout.tsx](../app/checkout.tsx), [store/cart.ts](../store/cart.ts).

### [~] B-02 · Verify payment realtime filter field mapping — **DE-RISKED, needs backend confirm** (2026-07-03)
Checkout filters `orders` on `external_id=eq.${referenceId}`, but the table has both `external_id` and `reference_id` and the API returns both `referenceId` and `externalId` — likely mismatch (the ref probably lands in `reference_id`).
**What was done:** B-03's polling fallback now confirms payments correctly regardless of whether the realtime filter matches, so a wrong filter can no longer cause a 5-minute timeout — only a slightly slower confirm. **Still needs you to confirm the column** so we can restore instant realtime: see [ACTION_ITEMS.md](ACTION_ITEMS.md) → item #4.

### [x] B-03 · Payment confirmation has no fallback if realtime drops — **DONE** (2026-07-03)
Confirmation relied solely on the realtime channel; a dropped socket or backgrounded app meant waiting out the 5-min timeout.
**What was done:** refactored the confirmation effect around a single guarded `finalize()` used by three sources — the realtime subscription, a 6-second `momoAPI.checkStatus()` **poll**, and an `AppState` **foreground re-check**. All share one-time settle logic and a unified `cleanup()`. Now the (previously unused) `checkStatus` endpoint backs up realtime. [app/checkout.tsx](../app/checkout.tsx).

### [x] B-04 · MoMo phone number not validated/normalized — **DONE, format needs backend confirm** (2026-07-03)
Any string was forwarded to the payment API; malformed numbers failed opaquely.
**What was done:** new [lib/phone.ts](../lib/phone.ts) with `isValidLiberianMobile` (used in delivery-step validation with a clear inline error) and `normalizeLiberianPhone` (canonicalizes to `231XXXXXXXX` before sending). All wire formatting goes through one helper. **Confirm the exact format the MoMo backend wants** → [ACTION_ITEMS.md](ACTION_ITEMS.md) item #5 (one-line change if different).

### [x] B-05 · Push registration re-runs on every auth change — **DONE** (2026-07-03)
`registerForPushNotifications()` fired in both `getSession` and every `onAuthStateChange` event.
**What was done:** extracted a shared `hydrate(session)` + a `registerPushOnce(userId)` guarded by a `registeredUserRef` — push registers at most once per signed-in user and resets on sign-out. Also DRY'd the duplicated session-handling. [app/_layout.tsx](../app/_layout.tsx).

---

## P2 — Medium (duplication / cleanup / edges)

### [x] C-01 · Two wishlist implementations, one unreachable — **DONE** (2026-07-03)
Deleted the unreachable standalone `app/wishlist.tsx` (0 inbound links) and its `Stack.Screen` registration; the reachable Account → Wishlist tab is now the single source. Also removed the dead `WishlistTabIcon` and now-unused `useWishlistStore` import from the tab layout. [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx), [app/_layout.tsx](../app/_layout.tsx).

### [x] C-02 · Dead dependency: `react-native-mmkv` — **DONE** (2026-07-03)
`npm uninstall react-native-mmkv` (removed native module + build weight) and renamed the misleading `mmkvAdapter` → `storageAdapter` across [lib/storage.ts](../lib/storage.ts), [store/cart.ts](../store/cart.ts), [store/wishlist.ts](../store/wishlist.ts).

### [x] C-03 · Leftover template files — **DONE** (2026-07-03)
Deleted `app/(tabs)/two.tsx` + its `<Tabs.Screen name="two">` registration, and `app/modal.tsx` (unreferenced). [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx).

### [x] C-04 · Search + filter breaks pagination — **DONE** (2026-07-03)
Deeper than first scoped: the query was keyed by `page`, so each page **replaced** the list instead of accumulating (only one page ever visible), *and* the `data.length === PAGE_SIZE` check stopped early once client filters shrank the page.
**What was done:** migrated both [app/(tabs)/shop.tsx](../app/(tabs)/shop.tsx) and [app/category/[slug].tsx](../app/category/%5Bslug%5D.tsx) to `useInfiniteQuery`. Pages now accumulate via `flatMap`, and `getNextPageParam` keys off the **raw server page size** (not the post-filter length), so filtered searches keep loading correctly. Removed all `page` state/`setPage` plumbing.
**Follow-up (nice-to-have):** push brand/size/price filters into the RPC so filtering is fully server-side (removes the last client-filter edge case).

### [x] C-05 · Cart item image tap does nothing — **DONE** (2026-07-03)
The cart-row thumbnail now navigates to `/product/{slug}` via `useRouter` in `CartItemRow`. [app/(tabs)/cart.tsx](../app/(tabs)/cart.tsx).

### [x] C-06 · `formatCurrency` has no guard — **DONE** (2026-07-03)
`formatCurrency` now coerces and falls back to `0` for non-finite input; `discountPercent` guards against zero/invalid price (no more `$NaN` / divide-by-zero). [lib/currency.ts](../lib/currency.ts).

### [x] C-07 · Invalid `haptic` prop passed to `Button` — **DONE** (fixed as part of A-01)
`FilterSheet` renders `<Button ... haptic />`, but `Button` has no `haptic` prop (it's always haptic internally). This is one of the TS errors and a no-op.
Evidence: [components/shop/FilterSheet.tsx:245](../components/shop/FilterSheet.tsx#L245), [components/ui/Button.tsx:5](../components/ui/Button.tsx#L5).
**Fix:** Remove the prop (or add it to `Button`'s API).

---

## P3 — Low (hardening / polish)

### [ ] D-01 · No tests, no lint script — **M**
`package.json` has no `test`/`lint`/`typecheck` scripts and there are no tests. Add at least `tsc --noEmit` + ESLint to CI, and smoke tests for cart math and the checkout reducer. [package.json:46](../package.json#L46).

### [x] D-02 · Empty-cart guard missing before payment — **DONE** (fixed with B-01)
`handlePlaceOrder` now returns early with an "Empty cart" alert if `items.length === 0`. [app/checkout.tsx](../app/checkout.tsx).

### [ ] D-03 · Accessibility labels missing on icon-only controls — **M**
Wishlist/close/qty/nav buttons are icon-only with no `accessibilityLabel`/`accessibilityRole`. Affects screen-reader users and store review. Broad, low-per-item effort.

### [ ] D-04 · Loose notification typings & unused param — **S**
`savePushToken(userId, ...)` ignores `userId`; `sendLocalNotification` data typing causes a TS error; `useNotificationListener` uses `any`. [lib/notifications.ts:64](../lib/notifications.ts#L64), [lib/notifications.ts:77](../lib/notifications.ts#L77).

### [ ] D-05 · Home banners are hardcoded — **M**
Promo banners live in the app bundle; changing them needs an app release. If marketing needs to rotate them, add a lightweight remote-config/CMS source. [app/(tabs)/index.tsx:32](../app/(tabs)/index.tsx#L32). *(Also flagged in the client spec.)*

### [ ] D-06 · No dark mode — **note only**
`userInterfaceStyle` is locked to `light` in [app.json:9](../app.json#L9). Acceptable for v1; listed so it's a conscious decision, not an oversight.

---

## Suggested sequencing

1. **Stabilize the build:** A-01 (types compile) → gate CI on typecheck.
2. **Fix the money/data paths:** A-04, A-05 (auth), B-01, B-02, B-03, B-04 (checkout/payments), A-02 (cart persistence).
3. **Wire push properly:** A-03, B-05, D-04.
4. **Cleanup & correctness:** C-01…C-07.
5. **Hardening:** D-01…D-05.

## Not problems (verified healthy)
Error boundary at the root, skeleton loaders, empty states, offline-persisted cart/wishlist (local), debounced search with recent-search history, haptics, Expo-Go-safe shims for FlashList/notifications, real-time checkout listener with a timeout safeguard, and a consistent color/design system. The foundation is solid — the P0/P1 items are targeted, not a rewrite.

---

*Generated from a full read of the codebase on the `master` branch. IDs are stable — reference them in commits/PRs (e.g. "A-02: sync cart on mutation").*
