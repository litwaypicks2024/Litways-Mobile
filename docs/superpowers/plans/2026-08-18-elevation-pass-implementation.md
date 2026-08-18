# LitwaysPicks Elevation Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the redesigned app a distinctive identity: Bricolage Grotesque display typography, five orchestrated motion moments, a country-cloth lozenge signature motif, and six custom SVG spot illustrations.

**Architecture:** Foundations first (deps + fonts + tokens), then the motif and illustration component libraries, then per-surface application (typography sweep, motion moments, illustration wiring). All presentational — zero logic, data, or navigation changes.

**Tech Stack:** Expo SDK 56, `expo-font` + `@expo-google-fonts/bricolage-grotesque`, `react-native-svg` (new), `react-native-reanimated` 4 (`ReduceMotion.System` everywhere).

**Spec:** `docs/superpowers/specs/2026-08-18-elevation-pass-design.md`

## Global Constraints

- No test runner exists; `npm run typecheck` (0 errors) is the correctness gate for every task, plus honest reporting that no simulator is available for visual checks.
- **Custom-font rule:** wherever a `fontFamily` from the new `font` token is applied, `fontWeight` must be REMOVED from that same style object (RN binds weight into the custom family name; specifying both breaks Android fallback). The reverse also holds: never apply `font.display*` without deleting the co-located `fontWeight`.
- Display face is for **display roles only**: screen titles, section headers, hero headlines, prices, `EmptyState` titles, `InkHeader` headline. Body copy, buttons, tab labels, inputs, chips, and meta text stay on the system font. When in doubt, leave it system.
- Every animation passes `reduceMotion: ReduceMotion.System` (or the `.reduceMotion(ReduceMotion.System)` modifier on entering animations) — imported from `react-native-reanimated`.
- The motif appears in exactly three places (auth `InkHeader`, confirmation band, Home deals banner) — a fourth placement anywhere is a spec violation, not an improvement.
- Illustration style contract: viewBox `0 0 120 120`; stroke = `color.ink` at `strokeWidth 3`, `strokeLinecap="round"`, `strokeLinejoin="round"`; fills limited to `color.accent`, `color.accentSoft`, `color.peachTint`, `color.surface`; no gradients, no other colors; geometric shapes over organic curves.
- No change to any handler, store, query, or navigation registration. If a visual change appears to require touching logic, STOP and escalate.
- Work happens directly on `master` in `/Users/mac/Developer/litways/mobile` (established with user consent in phase 1).

## File Structure

**New files:** `components/brand/Motif.tsx` (MotifOverlay + MotifBand), `components/illustrations/index.tsx` (six exported illustration components + shared style constants).

**Modified:** `package.json`/lock (two deps), `theme/tokens.ts` (`font` export, `type` preset families), `app/_layout.tsx` (font loading), `components/auth/InkHeader.tsx`, `components/ui/EmptyState.tsx`, `components/navigation/TabBar.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/cart.tsx`, `app/(tabs)/shop.tsx`, `app/(tabs)/account.tsx`, `app/(auth)/new-password.tsx`, `app/product/[slug].tsx`, `app/checkout.tsx`, `app/confirmation.tsx`, `app/onboarding.tsx`.

---

## Task 1: Dependencies, font loading, and font tokens

**Files:**
- Modify: `package.json` (via install commands), `theme/tokens.ts`, `app/_layout.tsx`

**Interfaces:**
- Produces: `font` export from `theme/tokens.ts`: `{ display: 'BricolageGrotesque_700Bold', displayHeavy: 'BricolageGrotesque_800ExtraBold' }`; `type.display/h1/h2` presets carrying `fontFamily: font.display` and **no** `fontWeight`. Fonts guaranteed loaded before first paint (BrandSplash gate). `react-native-svg` installed and importable.
- Consumes: existing root-layout startup flow (`Promise.all([...])` + `SplashScreen.hideAsync()` + `BrandSplash`).

- [ ] **Step 1: Install dependencies**

```bash
npx expo install react-native-svg
npm install @expo-google-fonts/bricolage-grotesque
```

`expo install` picks the SDK-56-pinned svg version. Verify both appear in `package.json` and `node_modules`.

- [ ] **Step 2: Add the font tokens**

In `theme/tokens.ts`, replace the existing `fontFamily` export (currently a `Platform.select` placeholder returning `undefined`) with:

```ts
/* ── Typefaces ─────────────────────────────────────────────────────────── */
/**
 * Display face: Bricolage Grotesque, loaded in app/_layout.tsx. RN binds
 * weight into the custom family name, so each cut is its own family — NEVER
 * pair these with a fontWeight in the same style object (breaks Android).
 * Body text intentionally stays on the platform system font.
 */
export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
} as const;
```

Keep the old `fontFamily` export name as a deprecated alias only if something imports it — grep first; if nothing does (expected), delete it and update the `theme` aggregate export at the bottom of the file to include `font`.

Then update the three display presets in `type` (leave `h3` and below on system):

```ts
  display: { fontSize: 26, lineHeight: 32, fontFamily: font.display, letterSpacing: -0.2, color: color.text },
  h1: { fontSize: 20, lineHeight: 26, fontFamily: font.display, letterSpacing: -0.1, color: color.text },
  h2: { fontSize: 17, lineHeight: 22, fontFamily: font.display, letterSpacing: 0, color: color.text },
```

(`fontWeight` removed from these three per the Global Constraint. If `type` is declared before `font` in the file, move the `font` export above it.)

- [ ] **Step 3: Load fonts at startup**

In `app/_layout.tsx`: add

```tsx
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
```

Inside `AppContent`, call the hook and fold it into the existing readiness gate:

```tsx
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
```

The existing startup effect sets `appReady` after `Promise.all([supabase.auth.getSession(), onboarding.hasSeen()])`. Gate the splash-hide on fonts too: change `setAppReady(true)` handling so `BrandSplash` stays up until **both** the session/onboarding promise resolves **and** `fontsLoaded` is true — e.g. track `startupDone` state from the effect, and derive `const appReady = startupDone && fontsLoaded;` (adjusting the existing `useState(false)` accordingly). Keep `SplashScreen.hideAsync()` where it is (native splash → BrandSplash handoff is unchanged); it's `BrandSplash`'s `visible={!appReady}` that holds until fonts land. Do not restructure anything else in the file.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` — 0 errors. Also verify `node -e "require('react-native-svg/package.json')"` succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json theme/tokens.ts app/_layout.tsx
git commit -m "Add Bricolage Grotesque display face and react-native-svg"
```

---

## Task 2: Typography sweep

**Files:**
- Modify: `app/(tabs)/index.tsx`, `app/(tabs)/cart.tsx`, `app/(tabs)/shop.tsx`, `app/(tabs)/account.tsx`, `app/product/[slug].tsx`, `app/checkout.tsx`, `app/confirmation.tsx`, `app/onboarding.tsx`, `components/auth/InkHeader.tsx`, `components/ui/EmptyState.tsx`, `components/shop/ProductCard.tsx`

**Interfaces:**
- Consumes: `font` from `theme/tokens.ts` (Task 1). No component API changes anywhere.

- [ ] **Step 1: Apply the display face site-by-site**

In each file, import `font` from `@/theme/tokens` and convert these sites — **removing the co-located `fontWeight` each time** (Global Constraint):

- `components/auth/InkHeader.tsx`: the 34px headline → `fontFamily: font.displayHeavy`. Wordmark stays system (it's letter-spaced chrome).
- `app/onboarding.tsx`: already uses `t.display` (inherits from Task 1) — verify only; no edit expected.
- `app/(tabs)/index.tsx`: `LITWAYS.` wordmark (20px, '800') → `font.displayHeavy`; hero headline (30px, '800') → `font.displayHeavy`; `SectionHeader`'s title (20px, '800') → `font.display`; deals banner headline (26px, '800') → `font.displayHeavy`.
- `app/(tabs)/shop.tsx`: no display-role text in the chrome (search/sort/chips are UI) — result-count numbers stay system. No edit expected; verify and say so.
- `app/(tabs)/cart.tsx`: "My Cart" title (20px) → `font.display`; "Order Summary" (15px) → `font.display`; the Total row's price (16px, '900') → `font.displayHeavy`; `CartItemRow` line price (15px, '900') → `font.displayHeavy`.
- `app/(tabs)/account.tsx`: header display name (base bold) → `font.display`; `OrdersTab` order total price → `font.displayHeavy`. (NativeWind `font-bold` classes on these two: replace the text's weight class with an inline `style={{ fontFamily: ... }}` merged alongside remaining classes.)
- `app/product/[slug].tsx`: product name (20px, '800') → `font.display`; the big price (28px, '900') → `font.displayHeavy`; "Reviews (N)" heading → `font.display`. Size/color labels, description heading stay system.
- `app/checkout.tsx`: "Checkout" title → `font.display`; Order Summary total price → `font.displayHeavy`; Pay-button text stays system (Button chrome).
- `app/confirmation.tsx`: "Thank You!" → `font.displayHeavy`; "Your Order is Confirmed" → `font.display`; Total Paid `Row` values stay system.
- `components/ui/EmptyState.tsx`: the title (19px, '800') → `font.display`.
- `components/shop/ProductCard.tsx`: the price line (16px, '800') → `font.displayHeavy`; product name stays system (13px body role).

- [ ] **Step 2: Sweep-check the constraint**

```bash
grep -rn "font.display" app components | grep "fontWeight"
```
Expected: no output (no style object carrying both).

- [ ] **Step 3: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add app components && git commit -m "Apply Bricolage Grotesque to display roles and prices"
```

---

## Task 3: Motif component + three placements

**Files:**
- Create: `components/brand/Motif.tsx`
- Modify: `components/auth/InkHeader.tsx`, `app/confirmation.tsx`, `app/(tabs)/index.tsx`

**Interfaces:**
- Produces: `MotifOverlay({ color?: string; opacity?: number; cell?: number })` — an absolutely-positioned fill lattice (parent must be `overflow: 'hidden'` + relative); `MotifBand({ height?: number; colors?: [string, string]; cell?: number })` — a horizontal woven strip.
- Consumes: `react-native-svg` (Task 1), `color` tokens.

- [ ] **Step 1: Build the Motif component**

```tsx
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color as tokens } from '@/theme/tokens';

/* Country-cloth lozenge lattice. Each cell is one diamond; alternate rows are
   offset half a cell, echoing a woven strip-cloth repeat. Rendered as a single
   Path per color for perf. */

function diamondPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
}

function latticePath(width: number, height: number, cell: number): string {
  const r = cell * 0.32;
  let d = '';
  const rows = Math.ceil(height / cell) + 1;
  const cols = Math.ceil(width / cell) + 1;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : cell / 2;
    for (let col = 0; col < cols; col++) {
      d += diamondPath(col * cell + offset, row * cell, r) + ' ';
    }
  }
  return d;
}

interface OverlayProps {
  color?: string;
  opacity?: number;
  cell?: number;
}

export function MotifOverlay({ color = '#ffffff', opacity = 0.05, cell = 34 }: OverlayProps) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Path d={latticePath(size.w, size.h, cell)} fill={color} opacity={opacity} />
        </Svg>
      )}
    </View>
  );
}

interface BandProps {
  height?: number;
  colors?: [string, string];
  cell?: number;
}

/* A single woven strip — two alternating diamond rows, like the selvedge of a
   country-cloth panel. */
export function MotifBand({ height = 14, colors = [tokens.accent, tokens.peachTint], cell = 14 }: BandProps) {
  const [width, setWidth] = React.useState(0);
  const r = cell * 0.42;
  const cols = Math.ceil(width / cell) + 1;
  let dA = '';
  let dB = '';
  for (let col = 0; col < cols; col++) {
    const cx = col * cell + cell / 2;
    (col % 2 === 0 ? (dA += diamondPath(cx, height / 2, r) + ' ') : (dB += diamondPath(cx, height / 2, r) + ' '));
  }
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
      {width > 0 && (
        <Svg width={width} height={height}>
          <Path d={dA} fill={colors[0]} />
          <Path d={dB} fill={colors[1]} />
        </Svg>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Place it — exactly three sites**

1. `components/auth/InkHeader.tsx`: give the root ink `View` `overflow: 'hidden'`, and render `<MotifOverlay />` as its first child (defaults: white at 0.05).
2. `app/confirmation.tsx`: render `<MotifBand style-free />` between the success header block and the order-ID card — i.e. immediately after the centered header `View` closes, add `<View style={{ marginBottom: 24, borderRadius: 4, overflow: 'hidden' }}><MotifBand /></View>`.
3. `app/(tabs)/index.tsx`: inside the deals banner's ink container (`backgroundColor: color.ink`, already `overflow: 'hidden'`), add `<MotifOverlay color="#ffffff" opacity={0.05} cell={28} />` as its first child.

- [ ] **Step 3: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add components/brand app/confirmation.tsx "app/(tabs)/index.tsx" components/auth/InkHeader.tsx
git commit -m "Add country-cloth lozenge motif in its three placements"
```

---

## Task 4: Illustration set + EmptyState support

**Files:**
- Create: `components/illustrations/index.tsx`
- Modify: `components/ui/EmptyState.tsx`

**Interfaces:**
- Produces: `EmptyBagIllustration`, `HeartIllustration`, `NoResultsIllustration`, `ReceiptIllustration`, `BrokenLinkIllustration`, `DeliveryBikeIllustration` — each `({ size?: number })`, default `size 120`, rendering a `react-native-svg` `<Svg viewBox="0 0 120 120">`. `EmptyState` gains `illustration?: React.ReactNode`; when set, it renders (at natural size, centered, `marginBottom: 20`) instead of the icon circle; the existing `icon` path is unchanged when `illustration` is absent.
- Consumes: `react-native-svg`, `color` tokens.

**This is a creative task.** The style contract (Global Constraints) is binding: viewBox `0 0 120 120`, ink strokes at `strokeWidth 3` with round caps/joins, fills only from `accent`/`accentSoft`/`peachTint`/`surface`, geometric composition. Each illustration should read instantly at 120px and still read at 90px. Use this as the style anchor — build it first, then match the other five to it:

```tsx
export function EmptyBagIllustration({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* soft ground */}
      <Circle cx={60} cy={64} r={44} fill={color.accentSoft} />
      {/* bag body */}
      <Rect x={32} y={44} width={56} height={50} rx={10} fill={color.surface} stroke={color.ink} strokeWidth={3} />
      {/* handles */}
      <Path d="M 46 44 v -8 a 14 14 0 0 1 28 0 v 8" stroke={color.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* lozenge detail — ties into the brand motif */}
      <Path d="M 60 62 l 8 8 l -8 8 l -8 -8 Z" fill={color.accent} />
    </Svg>
  );
}
```

- [ ] **Step 1: Build all six illustrations** to the anchor's standard: heart (wishlist), magnifier (no results), receipt (orders), broken chain-link (invalid reset link), and the delivery motorbike (rider + box on the rack — the most complex one; keep it profile-view, geometric: two circle wheels, rounded-rect body, rounded-rect parcel, simple rider silhouette; it must not look like a car or bicycle).

- [ ] **Step 2: Extend EmptyState** with the `illustration` prop as specified in Interfaces.

- [ ] **Step 3: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add components/illustrations components/ui/EmptyState.tsx
git commit -m "Add duotone spot-illustration set and EmptyState support"
```

---

## Task 5: Wire illustrations into their sites

**Files:**
- Modify: `app/(tabs)/cart.tsx`, `app/(tabs)/account.tsx`, `app/(tabs)/shop.tsx`, `app/(auth)/new-password.tsx`, `app/confirmation.tsx`

**Interfaces:**
- Consumes: the six illustration components + `EmptyState`'s new `illustration` prop (Task 4).

- [ ] **Step 1: Pass illustrations at each site**

- `cart.tsx` empty state → `illustration={<EmptyBagIllustration />}`
- `account.tsx` WishlistTab empty → `illustration={<HeartIllustration />}`; OrdersTab empty → `illustration={<ReceiptIllustration />}`
- `shop.tsx` no-results → `illustration={<NoResultsIllustration />}`
- `new-password.tsx` invalid phase: replace the danger icon circle `View` with `<BrokenLinkIllustration />` (the danger message text below is unchanged)
- `confirmation.tsx`: render `<DeliveryBikeIllustration size={96} />` inside the "Estimated"/order-details area — place it right-aligned beside or above the order-ID card content, matching the reference screenshots' truck placement (a `View` row: card text left, bike right). Keep the checkmark badge exactly as is.

- [ ] **Step 2: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add app && git commit -m "Wire spot illustrations into empty states and confirmation"
```

---

## Task 6: Motion — tab circle spring + badge pop

**Files:**
- Modify: `components/navigation/TabBar.tsx`

**Interfaces:**
- Consumes: `react-native-reanimated` (`Animated`, `useAnimatedStyle`, `useSharedValue`, `withSpring`, `withSequence`, `ReduceMotion`, `useReducedMotion`). Public exports (`TAB_BAR_HEIGHT`, `useTabBarClearance`, `TabButton`, `CartTabButton`) unchanged.

- [ ] **Step 1: Spring the focused circle in**

In `TabButton`'s focused branch, wrap the raised-circle `View` in an `Animated.View` that springs on mount: prefer `entering={ZoomIn.springify().damping(14).stiffness(180).reduceMotion(ReduceMotion.System)}`. **Spec risk note applies:** if `entering` animations misbehave inside `expo-router/ui`'s TabList (blank or stuck circle), fall back to a `useAnimatedStyle` with a `useSharedValue` initialized 0.6 and sprung to 1 in a `useEffect` keyed on mount — same visual, no entering API. Label which path was needed in the report.

- [ ] **Step 2: Pop the badge on count change**

In `IconBadge` (or lifting state to `TabButton`), animate scale with `withSequence(withSpring(1.3, ...), withSpring(1, ...))` in a `useEffect` that runs when `count` changes (skip initial mount; pass `reduceMotion: ReduceMotion.System` in the spring configs). The badge itself becomes an `Animated.View`.

- [ ] **Step 3: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add components/navigation/TabBar.tsx && git commit -m "Animate tab-bar circle and cart badge"
```

---

## Task 7: Motion — product-detail parallax + add-to-cart bounce

**Files:**
- Modify: `app/product/[slug].tsx`

**Interfaces:**
- Consumes: reanimated scroll APIs. All handlers/queries untouched (Global Constraint).

- [ ] **Step 1: Parallax the hero gallery**

Convert the screen's `ScrollView` to `Animated.ScrollView` with `useAnimatedScrollHandler` writing `scrollY` (a shared value). Wrap the fixed-height gallery container (`<View style={{ height: IMAGE_HEIGHT }}>`) in an `Animated.View` whose style interpolates: `translateY: interpolate(scrollY.value, [0, IMAGE_HEIGHT], [0, IMAGE_HEIGHT * 0.5], Extrapolation.CLAMP)` and `scale: interpolate(scrollY.value, [-200, 0], [1.35, 1], Extrapolation.CLAMP)` with `transformOrigin` effect approximated by also translating `-scrollY.value * 0.175` when negative (or simpler: apply scale only, anchored by wrapping in a container with `overflow: 'hidden'` extended upward). Keep it simple and clamped; horizontal `FlatList` paging inside is untouched.

- [ ] **Step 2: Bounce the CTA on "Added!"**

The sticky CTA's inner content becomes an `Animated.View`; a `useEffect` on `addedToCart === true` runs `withSequence(withSpring(1.06), withSpring(1))` on its scale (springs configured with `reduceMotion: ReduceMotion.System`). The existing instant color/text/icon swap logic is unchanged.

- [ ] **Step 3: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add "app/product/[slug].tsx" && git commit -m "Add product-detail parallax and add-to-cart bounce"
```

---

## Task 8: Motion — Home entrance + Confirmation moment

**Files:**
- Modify: `app/(tabs)/index.tsx`, `app/confirmation.tsx`

**Interfaces:**
- Consumes: reanimated entering animations (`FadeInDown`, `ZoomIn`, `ReduceMotion`).

- [ ] **Step 1: Home staggered entrance**

Wrap Home's top-level sections (announce bar, hero, categories, deals, popular, new arrivals) each in `Animated.View entering={FadeInDown.duration(300).delay(i * 60).reduceMotion(ReduceMotion.System)}` with `i` = section index. Mount-only by nature of `entering`; don't wrap `FlashList` items individually (perf).

- [ ] **Step 2: Confirmation moment**

The checkmark badge container gets `entering={ZoomIn.springify().damping(12).reduceMotion(ReduceMotion.System)}`; add a radiating ring — an absolutely-positioned `Animated.View` circle behind the badge whose scale runs 1→1.6 and opacity 0.35→0 once on mount (`withTiming`, 700ms, in a `useEffect`, `ReduceMotion.System`). The content blocks below (order-ID card, `Card`s, buttons) each get `entering={FadeInDown.duration(280).delay(120 + i * 70).reduceMotion(ReduceMotion.System)}`.

- [ ] **Step 3: Typecheck, commit**

`npm run typecheck` → 0 errors.

```bash
git add "app/(tabs)/index.tsx" app/confirmation.tsx && git commit -m "Add Home entrance stagger and confirmation success moment"
```

---

## Task 9: Final verification

- [ ] **Step 1:** `npm run typecheck` → 0 errors project-wide.
- [ ] **Step 2:** Constraint sweeps:
  - `grep -rn "MotifOverlay\|MotifBand" app components` → exactly the three placement sites + the component file.
  - `grep -rn "font.display" app components | grep "fontWeight"` → empty.
  - `grep -rln "react-native-reanimated" app components` → confirm every file using new animations also references `ReduceMotion`.
- [ ] **Step 3:** Report honestly that the visual walkthrough (fonts rendering, motif subtlety, illustration quality, all five motion moments) requires the user's simulator — `npx expo start`. No commit unless fixes were needed.
