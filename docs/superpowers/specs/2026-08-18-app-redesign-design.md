# LitwaysPicks Mobile — Visual Redesign (Phase 1: Onboarding + Core Shopping Flow)

**Status:** Approved for implementation planning
**Author:** Claude (with DNLCodess)
**Date:** 2026-08-18

## 1. Goal

The client's brief: *"Make it look so modern, easy to use, and a great aesthetic."* This spec redesigns the app's visual and component system and applies it to onboarding plus the core shopping flow. Auth screens, dark mode, and a banners CMS are explicitly out of scope for this phase (see §7).

## 2. Reference material

The direction is grounded in 8 reference screenshots the client provided in `assets/design-inspo/` (2.png–9.png; gitignored, not committed) — a warm-grey-canvas ecommerce UI kit covering home, product detail, cart, checkout (shipping → payment → confirmation). All token values and component patterns below are read directly off those references, not invented.

Secondary influence (from earlier direction exploration, still valid where the reference screenshots are silent): Airbnb's 2025 redesign for the "warm, effortless, icon-led" interaction model on cards and search.

## 3. Design tokens

Replaces `theme/tokens.ts` as the **single source of truth**. `constants/Colors.ts` is deleted once every screen migrates (§6).

### Color

```
bg canvas         #ececec   — the app background everywhere. Never white.
surface            #ffffff   — cards, sheets, the header, floating icon buttons.
surfaceSunken       #e2e2e2   — image/skeleton placeholder fill, recessed chips.
ink (primary text)  #141414   — headlines, primary text, the dark pill button fill.
inkMuted            #8a8a8a   — secondary text, meta, placeholders.
inkFaint            #b8b8b8   — tertiary text, disabled states.
border              #e6e6e6   — hairlines, used sparingly (most separation is elevation, not borders).

accent 50–900       — keep the existing orange ramp unchanged (#fff7ed … #7c2d12),
                       base #ea580c. This is the one thing the client asked NOT to change —
                       it's already in app.json, the splash screen, and Android adaptive icon.
accentGradient      [primary.500 #f97316 → primary.600 #ea580c] — used on primary pill CTAs only.
onAccent            #ffffff
onInk               #ffffff  — text/icons on the black pill / black tab bar.

success   #16a34a   danger  #dc2626   star  #f59e0b   (unchanged from current tokens)
peachTint  #fdecd8   — soft accent-tinted card background (order-ID card, info callouts).
```

### Radius

```
sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · pill 999
```
Product-card images: `lg` (16). Enclosed cards (cart rows, info cards): `xl`–`2xl` (20–24). Every button, chip, tab bar, and quantity stepper: `pill`.

### Typography

Same 4-pt spacing scale and type-preset structure as the current `theme/tokens.ts`, with two changes: headline weight goes to 700–800 as before, but **letter-spacing flattens to ~0 / -0.2 max** (the reference screens use a friendly, un-tracked bold — the current app's tight negative tracking reads more "editorial," which isn't the direction the client picked). Price text is always `accent` + bold, everywhere (currently inconsistent — sometimes orange, sometimes black).

### Elevation

Cards floating on the grey canvas need slightly more presence than the current `shadow.card` (which was tuned for white-on-white): bump opacity to ~0.08 and keep the soft 12px blur. One shadow preset, used consistently — no per-screen ad hoc shadow objects (current codebase has several).

## 4. Component library

All new/rebuilt, replacing current ad hoc inline-styled equivalents:

- **Button** — `variant: 'primary' | 'dark' | 'outline' | 'ghost'`. All pill-shaped. `primary` = accent gradient fill + white text + soft accent-glow shadow. `dark` = ink fill + white text (hero-overlay CTAs, e.g. "Shop Now"). `outline` = white fill + ink border + ink text (tertiary actions like "Continue Shopping"). Keep existing `loading`/`fullWidth`/`size` API — it's already sound, just re-skin.
- **IconButton** (new) — floating white circle (~40–44px), soft shadow, ink icon. Replaces the various inline `TouchableOpacity` circle-icon patterns scattered across screens (back button, search, cart, wishlist toggle).
- **Input** — white pill/rounded-xl field, no visible border by default (border only appears on focus/error), label above in small `inkMuted` text. Replaces the current 2px-bordered field.
- **ProductCard** — becomes **borderless**: rounded image (no card box, no shadow, no border), name/rating/price sit directly on the grey canvas beneath it. This is the single biggest visual change in the component set — current `ProductCard` wraps everything in a white bordered+shadowed box.
- **Card** (new, generic) — the enclosed-white-card pattern for cart rows, order-summary, delivery-info, account sections. One shared component instead of each screen hand-rolling its own `View` with the same shadow/radius values.
- **QuantityStepper** (new) — pill-shaped `surfaceSunken` background, `–` / count / `+`, extracted from the inline version currently duplicated in `cart.tsx`.
- **ProgressStepper** (new) — dotted connector line between circular step icons; accent-filled = active, grey = upcoming, grey checkmark = done. Replaces checkout's current numbered-circle-and-bar stepper.
- **TabBar** (new, custom `tabBar` render on the `(tabs)` layout) — floating ink-black pill bar with margin from screen edges, four tabs, **Cart raised as a black circular FAB** above the bar line per the reference. This replaces the current stock Expo Router tab bar styling entirely — meaningfully more custom than what exists today.
- **Badge/Chip** — keep the existing status-color-mapping logic from `Badge.tsx`, re-skin to pill shape with the new palette.

Illustrations (order-confirmation truck, checkmark "glow" badge): approximated with Ionicons + colored circle/badge compositions, not custom illustration assets. Flag to the client if they'd rather commission real illustration work later — cheap to swap in afterward since it's isolated to the confirmation screen.

## 5. Screens in this phase

For every screen: loading skeletons, empty states, and error handling already work well per the existing audit (`docs/MOBILE_APP_AUDIT.md` — "not problems: verified healthy") and are **not being rearchitected**, only re-skinned to the new tokens/components.

- **Onboarding** (`app/onboarding.tsx`) — currently a generic 2-slide icon+gradient-square intro. Redesign to the new system: grey canvas, ink headline, accent pill CTA, dot indicator in accent. Content/copy unchanged unless the client asks.
- **Home** (`app/(tabs)/index.tsx`) — floating search pill (icon-button style, not the current inline muted-bg bar), icon-led horizontal category row, borderless deal/featured product cards, dark-pill hero CTA.
- **Shop / Search** (`app/(tabs)/shop.tsx`) — same borderless `ProductCard` grid, filter sheet re-skinned to the new `Card`/pill-chip system, search field uses new `Input`.
- **Category grid** (`app/category/[slug].tsx`) — thin wrapper around the same `ProductCard` grid; header becomes an `IconButton` back + ink title, no white header bar.
- **Product Detail** (`app/product/[slug].tsx`) — full-bleed rounded hero image, floating `IconButton`s for back/wishlist (no header bar), pill size/color selectors, accent-gradient "Add to Cart" pill.
- **Cart** (`app/(tabs)/cart.tsx`) — enclosed `Card` rows with the new `QuantityStepper`, free-shipping progress bar re-skinned, accent-gradient checkout pill.
- **Checkout** (`app/checkout.tsx`) — new `ProgressStepper` for the 2-step flow, all fields through the new `Input`, payment-method row and order-summary as `Card`s, accent-gradient "Pay" pill. The underlying payment-confirmation logic (realtime + poll + foreground re-check, B-02/B-03 fixes) is untouched — this is a visual pass only.
- **Confirmation** (`app/confirmation.tsx`) — big accent checkmark badge with glow, peach-tinted order-ID card with copy chip, delivery-estimate `Card`, order-summary `Card`, dual CTA pills (primary "Track Your Order" + outline "Continue Shopping"). Currently uses a green gradient success header — replaced entirely per the reference (no gradient header, badge-centered layout instead).
- **Account** (`app/(tabs)/account.tsx`) — profile header, pill tab switcher, and the four sub-tabs (Profile/Orders/Wishlist/Settings) re-skinned to the new `Card`/`Input`/`Button` set. Structure unchanged.

## 6. Style-system migration

`constants/Colors.ts` is deleted. Every current `Colors.primary[...]`, `Colors.gray[...]`, inline hex, and NativeWind `className` color utility (`bg-primary-600`, `text-gray-900`, etc.) is migrated to the `theme/tokens.ts` semantic tokens above. `tailwind.config.js`'s color extension is updated to alias the new token values so NativeWind classes stay usable where they're genuinely convenient (e.g. layout utilities), but color decisions flow from one file.

## 7. Out of scope (this phase)

- `(auth)` screens (login, reset-password, new-password) — explicitly deferred per the client's instruction ("we will handle auth later on").
- Dark mode (D-06 in the audit — already a conscious "not yet" decision).
- Home banners CMS (D-05) — banners stay hardcoded, just re-skinned.
- Accessibility labels (D-03) — worth doing, but not blocking this visual pass; can follow as a fast pass once the new `IconButton`/`Button` components exist (good chokepoint to add `accessibilityLabel` once, centrally).
- Any change to payment/checkout *logic*, cart persistence, or backend calls — this spec is strictly presentational.

## 8. Risks / open questions

- The floating raised-FAB tab bar is the most custom/novel piece of UI here — no existing dependency provides it, so it's a hand-rolled `tabBar` render prop on top of `expo-router`'s `Tabs`. Worth a quick spike if it fights the library.
- Ionicons may not have a close match for every reference icon (e.g. the payment-method brand icons in the checkout screenshots). Where it doesn't, fall back to a labeled colored badge rather than sourcing new icon assets.
