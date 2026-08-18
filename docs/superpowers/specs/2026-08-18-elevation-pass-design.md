# LitwaysPicks — Elevation Pass (Typography · Motion · Signature Motif · Illustrations)

**Status:** Approved (design presented and accepted in-session)
**Author:** Claude (with DNLCodess)
**Date:** 2026-08-18
**Builds on:** `2026-08-18-app-redesign-design.md` (phase 1, complete)

## 1. Goal

Phase 1 made the app consistent. This pass makes it distinctive — four levers the client approved: a characterful display typeface, an orchestrated motion pass, a Liberian country-cloth signature motif, and a custom spot-illustration set. Dark mode was offered and explicitly deferred.

## 2. Lever A — Typography

- **Display face: Bricolage Grotesque** (Google Fonts, free), loaded via `expo-font` + `@expo-google-fonts/bricolage-grotesque`. Two cuts: `BricolageGrotesque_700Bold` and `BricolageGrotesque_800ExtraBold`.
- **Body text stays on the platform system font** — deliberate restraint, legibility, zero cost on long screens. Button labels, tab labels, inputs, and body copy are *not* display-face.
- Fonts load in the root layout's startup path; `BrandSplash` already gates first paint on async startup work, so the splash also waits for fonts (no flash of fallback text).
- `theme/tokens.ts` gains a `font` export (`font.display`, `font.displayHeavy` — the two family names) and the `type` presets `display`/`h1`/`h2` switch to `fontFamily: font.display` (dropping `fontWeight`, since RN custom fonts bind weight to the family name; setting both breaks Android fallback).
- A targeted sweep applies the display face to inline headline/price sites the presets don't reach: screen titles, Home section headers, product name + price on detail, prices in ProductCard/cart/checkout totals, `InkHeader`'s headline, onboarding title, confirmation headings, `EmptyState` title. Heavy (800) cut for prices and the largest headlines; Bold (700) elsewhere.

## 3. Lever B — Motion

All Reanimated (already installed), all passing `ReduceMotion.System` so OS-level reduced-motion is respected automatically. Five moments, nothing else:

1. **Tab circle spring** — the active tab's raised circle animates in with a spring (scale + rise) when focus changes; the cart badge does a scale-pop whenever the item count changes (visible wherever the tab bar is on screen when the count changes — most prominently on the cart screen's quantity steppers; product-detail adds happen while the tab bar is covered).
2. **Product-detail parallax** — hero gallery drifts at half scroll speed; stretches on iOS overscroll.
3. **Home entrance** — main sections stagger in (fade + rise, ~60ms stagger) on first mount only.
4. **Confirmation moment** — checkmark badge springs in with a radiating ring; content below cascades.
5. **Add-to-cart morph** — product detail's CTA gets a scale-bounce when flipping to the "Added!" state.

## 4. Lever C — Signature motif

A refined country-cloth **lozenge lattice** (diamond weave), built once as SVG in `components/brand/Motif.tsx` (`MotifOverlay` for area fills, `MotifBand` for horizontal strips). Requires `react-native-svg` (Expo-bundled, `expo install`).

Used in **exactly three places**, tone-on-tone, low opacity:
1. Auth `InkHeader` panels — faint white lattice in the ink.
2. Order confirmation — a thin woven band under the success header (accent/peach tones).
3. Home's ink deals banner — corner texture.

Nowhere else. The motif's power is scarcity.

## 5. Lever D — Illustrations

Six hand-built SVG spot illustrations in `components/illustrations/`, one shared style: **geometric duotone** — ink linework (`color.ink`, consistent stroke width), flat fills limited to `color.accent` / `color.accentSoft` / `color.peachTint` / `color.surface`, no gradients, ~120×120 viewBox. Geometric composition (circles, rounded rects, simple paths) rather than organic drawing — keeps hand-authored SVG looking crafted.

| Illustration | Replaces | Site |
|---|---|---|
| Empty bag | Ionicons bag circle | Cart empty state |
| Heart | Ionicons heart circle | Account → Wishlist empty |
| Magnifier | Ionicons search circle | Shop no-results |
| Receipt | Ionicons receipt circle | Account → Orders empty |
| Broken link | Ionicons alert circle | New-password invalid state |
| **Delivery motorbike** | (checkmark badge stays; bike joins the confirmation) | Order confirmation |

`EmptyState` gains an optional `illustration?: React.ReactNode` prop; when provided it renders in place of the icon circle. Call sites pass the matching illustration.

## 6. Dependencies

- `react-native-svg` — added via `npx expo install` (SDK-56-pinned version; bundled in Expo Go).
- `@expo-google-fonts/bricolage-grotesque` — static font cuts.

## 7. Out of scope

- Dark mode (offered, deferred by client).
- Splash-screen/app-icon motif treatment (native asset pipeline — later).
- Any logic, navigation, data, or payment change. Purely presentational, same discipline as phase 1.
- Copy rewrite (lever discussed, not selected).

## 8. Risks

- Hand-authored SVG quality — mitigated by the geometric style constraint and a single style-anchor example built first.
- Custom fonts on Android require family-per-weight; mitigated by tokens carrying complete family names and banning `fontWeight` alongside them.
- Reanimated entering-animations on the headless tab primitives — if `entering` fights `expo-router/ui`'s render cycle, fall back to a plain `useAnimatedStyle` spring keyed on `isFocused`.
