# The owner's guide to Litway Picks

**For:** the person who owns this app, not the person who wrote it.
**Assumes:** you have never built a mobile app and don't want to become a programmer.
**Promise:** by the end you will know what exists, why it exists, what was traded away to get it, and what still needs someone else's hands.

Last updated: 2026-08-20 (after the overnight hardening session).
Keep this file updated when big changes land — see [§8](#8-working-with-ai-on-this-codebase).

---

## 1. What you own

Litway Picks is a shopping app for iPhone and Android. Customers browse a catalog, add things to a cart, pay with MTN Mobile Money, and track the order. It is the phone version of litwaypicks.com and shares the same catalog, the same customer accounts, and the same orders.

### The screens

Everything a customer can reach:

| Screen | What happens there |
|---|---|
| **Onboarding** | A one-time intro shown on first install only. Never seen again. |
| **Home** | The shop window: an editorial hero with campaign photography, a scrolling brand marquee, categories, deals, popular products, new arrivals. |
| **Shop / Search** | The full catalog with live search, sorting, filters (brand, size, price), and infinite scroll. |
| **Category** | The same product grid narrowed to one category. |
| **Product detail** | Photo gallery, price, ratings and reviews, size/colour pickers, stock warnings, wishlist, share, add-to-cart. |
| **Cart** | Line items, quantity steppers, subtotal, checkout button. Works signed in or not. |
| **Checkout** | Two steps: delivery details, then payment. Ends in a MoMo prompt on the customer's own phone. |
| **Confirmation** | Order reference, what was bought, and an honest statement of where the payment actually stands. |
| **Account** | Four tabs — Profile, Orders, Wishlist, Settings — plus review submission and password change. |
| **Auth** | Sign in, sign up, biometric (Face ID / fingerprint) sign-in, forgot password, set new password. |
| **Info pages** | About, Contact, Shipping, Returns, Privacy, Terms. |

### How money flows

This is the part worth understanding precisely, because it's the part that can cost you real money if it's wrong.

1. The customer fills in delivery details and taps **Pay with MoMo**.
2. Before charging anything, the app re-checks every item's **live price and stock** against the catalog. If anything changed, it stops, updates the cart, and sends the customer back to review. Nobody pays a stale price and nobody buys a sold-out item.
3. The app sends the order to your own server at `litwaypicks.com/api/momo/pay`. That server talks to MTN. It replies with a **reference id** — the receipt number for this attempt.
4. MTN sends a prompt to the customer's phone. **That prompt, not the app, shows the authoritative amount** including any delivery fee. The app deliberately does not claim a final total it cannot know (see [§6, item 6](#6-what-still-needs-the-backend-team)).
5. The app then watches for the outcome three different ways at once: a live database subscription, a poll every 6 seconds, and an immediate re-check whenever the app comes back to the foreground. Whichever hears first wins; the rest shut down. After 5 minutes with no answer, the app stops guessing and says so.
6. The reference id is also written to the phone's storage the moment it exists. If the phone dies or the app is killed mid-payment, the next launch offers: *"You have a payment in progress — check its status?"* This is what stops a customer paying twice.
7. Only a **confirmed** success clears the cart. Never a hopeful one.

### Where things live

There are two servers behind the app, and it matters which is which.

**Supabase** is your database and your login system. It holds:
- `products` and the `products_with_categories` view the app actually reads from
- `categories`, `featured_products`
- `users` (customer profiles), `orders`, `reviews`, `carts`, `admin_notifications`
- Search and category lookups run as database functions: `search_products`, `get_products_by_category`, `get_product_by_slug`, `get_distinct_brands`

**litwaypicks.com** is your own API, and it owns money and mail:
- `POST /api/momo/pay` — start a payment
- `GET /api/momo/status/:reference` — is it done yet?
- `GET /api/momo/order/:reference` — the full order
- `POST /api/contact` — the contact form

The app never talks to MTN directly. It never holds a payment secret. That's correct and should stay that way.

**What is not in this repository:** the litwaypicks.com API source, and Supabase's security rules. Both matter enormously, and both are why [§6](#6-what-still-needs-the-backend-team) exists.

---

## 2. How the code is organized

A quick vocabulary, then the tour. (Full glossary in [§9](#9-glossary).)

- **A screen is a file.** `app/checkout.tsx` *is* the checkout screen. There is no separate list of routes to keep in sync — the folder structure *is* the navigation map. This is called file-based routing, and the library doing it is **expo-router**.
- Folders in brackets are organizational, not part of the address. `app/(tabs)/cart.tsx` is the Cart tab; the `(tabs)` doesn't appear in the URL.
- Square brackets mean "a slot". `app/product/[slug].tsx` handles *every* product — `[slug]` is filled in with whichever product was tapped.

### `app/` — the screens

| File | One line |
|---|---|
| `_layout.tsx` | The app's front door. Loads fonts, restores the session, decides whether to show onboarding, handles deep links and notification taps, offers payment recovery, and holds the splash until everything is ready. |
| `onboarding.tsx` | First-run intro. |
| `(tabs)/_layout.tsx` | Declares the four tabs and hands rendering to the custom tab bar. |
| `(tabs)/index.tsx` | Home. |
| `(tabs)/shop.tsx` | Search, sort, filter, infinite catalog. |
| `(tabs)/cart.tsx` | Cart, quantity edits, sync notices. |
| `(tabs)/account.tsx` | Profile / Orders / Wishlist / Settings, plus review writing. |
| `product/[slug].tsx` | Product detail. |
| `category/[slug].tsx` | One category's grid. |
| `checkout.tsx` | Delivery form, price re-validation, payment, outcome watching. |
| `confirmation.tsx` | Order outcome, honestly stated. |
| `order/[id].tsx` | A past order's detail from Order History. |
| `(auth)/login.tsx` | Sign in, sign up, biometrics. |
| `(auth)/reset-password.tsx` | Request a reset email. |
| `(auth)/new-password.tsx` | Land from the reset email and set a new password. |
| `about/contact/privacy/returns/shipping/terms.tsx` | Static info pages. |
| `+not-found.tsx` | Shown if a link points somewhere that doesn't exist. |

### `components/` — the LEGO bricks

A component is a reusable piece of interface. Build it once, use it everywhere, fix it in one place.

- `ui/` — the generic set: `Button`, `IconButton`, `Input`, `Card`, `Badge`, `List`, `EmptyState`, `ErrorState`, `SkeletonLoader`, `QuantityStepper`, `ProgressStepper`, `PressableScale`, `ErrorBoundary` (the safety net that shows a polite screen instead of a crash).
- `brand/` — `LogoMark` (the bag, rebuilt as vector art so it's sharp at any size), `Motif` (the Liberian country-cloth lozenge lattice), `Marquee` (the endlessly scrolling promise strip), `RotatingBadge` (the circular "shop the drop" seal).
- `motion/` — `BrandLoader` (the loading state built from the logo), `FlyToCart` (the bag that arcs into the cart tab), `DrawnCheckmark`, `IdleFloat`.
- `shop/` — `ProductCard` (every product tile in the app) and `FilterSheet`.
- `navigation/TabBar.tsx` — the floating black pill bar with the raised cart button.
- `auth/InkHeader.tsx` — the black header panel on auth screens.
- `illustrations/index.tsx` — six hand-drawn duotone spot illustrations for empty states and the confirmation.
- `BrandSplash.tsx` — the animated launch screen where the logo assembles itself.

### `store/` — the app's memory

A "store" is shared memory that any screen can read and write. Four of them:

- `auth.ts` — who is signed in, their profile, and the sign-out procedure (which is more careful than it sounds — see [§5](#5-tonights-overnight-session)).
- `cart.ts` — the cart, plus all the machinery to keep it in step with the server.
- `wishlist.ts` — saved items. **Device-only today**, because the database has no wishlist table yet.
- `reviewed.ts` — remembers which order/product pairs the customer already reviewed, so the "Write a review" chip stops asking.

Cart and wishlist survive app restarts because they're written to the phone's own storage.

### `lib/` — the phone lines

- `supabase.ts` — the database connection, plus the encrypted-storage adapter that keeps the login token in the phone's secure hardware store.
- `api.ts` — the four calls to litwaypicks.com.
- `storage.ts` — small on-device records: onboarding-seen, recent searches, the pending-payment recovery record.
- `notifications.ts` — push registration and tap handling.
- `phone.ts` — turns anything a Liberian customer types into `231XXXXXXXX` for MTN. One function; if MTN wants a different shape, one line changes.
- `currency.ts` — money formatting that can never print `$NaN`.

### `theme/tokens.ts` — the single source of design truth

Every colour, spacing value, corner radius, shadow and text style lives here. Screens ask for `color.accent`, not `#ea580c`. Change the token, and the whole app changes with it. This file is treated as law.

### Other folders

- `types/` — the shapes of your data, generated from the database. This is what lets the computer catch mistakes before customers do.
- `constants/` — `counties.ts` (the 15 Liberian counties) and `Colors.ts`, the *old* colour file. It's still used by the static info pages, `order/[id].tsx` and `ErrorBoundary`. Those screens were out of scope for the redesign; finishing that migration is a small, safe cleanup job.
- `assets/` — images, the logo PDFs, the campaign photography.

---

## 3. The design system

The app's look is a deliberate, written-down system, not a series of one-off decisions.

**The canvas is warm grey (`#ececec`), never white.** White is reserved for things that *float* — cards, sheets, the header, circular icon buttons. That single choice is what makes the app feel layered rather than flat.

**Ink, not black.** Text is `#141414`, a hair off pure black, which reads softer on a screen. Secondary text is `#8a8a8a`; faint text is `#9a9a9a` (darkened during the accessibility pass — the original `#b8b8b8` was effectively invisible on grey).

**One accent: orange `#ea580c`.** You asked for this to stay, and it did. It appears on prices, primary buttons, active states — and almost nowhere else. Primary buttons use a subtle two-stop gradient with a soft orange glow beneath.

**Everything tappable is a pill.** Buttons, chips, the tab bar, the quantity stepper, input fields. Product images use a 16pt radius; enclosed cards 20–24pt.

**Bricolage Grotesque** is the display face — headlines, screen titles, prices. Body text deliberately stays on the phone's own system font: it's more legible at small sizes and costs nothing to load. Two weights only (Bold 700, ExtraBold 800).

**The brand marks.** `LogoMark` is the dashing shopping bag from your official logo, rebuilt as vector geometry rather than a picture file. That means it's razor-sharp at any size, recolourable for light / orange / ink backgrounds, and it can *animate* — which is exactly what the splash screen does. The app icon, Android adaptive icon, monochrome icon, splash and favicon were all regenerated from that same source, so nothing drifts.

**The motif.** A country-cloth lozenge lattice appears in exactly three places: the ink panels on auth screens, a woven band on the confirmation, and the corner of Home's deals banner. Nowhere else, on purpose — a signature that appears everywhere stops being a signature.

**Why tokens exist.** Before the redesign, colours were hard-coded in dozens of files. Changing the accent orange meant hunting through the whole codebase and inevitably missing some. Now it's one line in one file. That is the entire argument, and it's a good one.

---

## 4. The story of the build

### Act 0 — the original app, and the audit that found the truth

The first version worked, mostly. Then a full engineering audit (`docs/MOBILE_APP_AUDIT.md`) read every file and found 23 issues. Four were serious enough to block a launch:

- **The project didn't compile.** 27 type errors. The root cause was structural: the generated database types were missing a field the Supabase library now requires, which made the *entire* typed connection collapse. Fixing it surfaced a real bug — review submissions were missing a required field and would have failed at runtime for every customer.
- **The cart never saved to the server.** The function existed. Nothing ever called it. The "your cart follows you across devices" promise was simply not true.
- **New signups had no profile row.** Email confirmation is on, so a new signup has no session yet; the app's attempt to create the profile was rejected by the database's own security rules.
- **Password reset had no ending.** The reset email pointed back at the "enter your email" screen. There was no way to actually set a new password.

All four were fixed. A `typecheck` script became the gate everything must pass.

> **Decision:** fix the money and data paths first, cosmetics later.
> **Alternative:** redesign first, since that's what was visibly wrong.
> **Tradeoff accepted:** the app looked dated for longer, but the redesign got built on a foundation that compiled and actually persisted data — instead of on top of bugs that would have had to be re-fixed through a new visual layer.

### Act 1 — the full redesign

Spec: `docs/superpowers/specs/2026-08-18-app-redesign-design.md`. Plan: 20 tasks, `docs/superpowers/plans/2026-08-18-app-redesign-implementation.md`.

The brief was *"modern, easy to use, great aesthetic."* Rather than invent a direction, the design was read directly off eight reference screens you provided — every token value and component pattern traces back to them.

The work ran in two halves. **First, build the component library** (Button, IconButton, Input, Card, QuantityStepper, ProgressStepper, TabBar, re-skinned ProductCard and Badge). **Then re-skin every screen onto it**, one commit per screen — onboarding, Home, Shop, Category, Product, Cart, Checkout, Confirmation, Account.

Notable decisions:

> **Decision:** ProductCard became *borderless* — a rounded image with the name and price sitting directly on the grey canvas, no white box.
> **Alternative:** keep the familiar bordered-and-shadowed card.
> **Tradeoff:** the biggest visual change in the set, and the one that most makes the app feel current. Cost: individual products have slightly less visual separation, which the grid spacing has to carry instead.

> **Decision:** a hand-built floating tab bar with the cart raised as a circular button above the bar line.
> **Alternative:** the stock tab bar the framework gives you free.
> **Tradeoff:** flagged in the spec as the riskiest piece — no library provides it, so it's custom code sitting on top of the navigation library's headless primitives. It fought nothing, and it's the single most distinctive piece of UI in the app. But it is code you now own and maintain.

> **Decision:** confirmation-screen illustrations approximated with icons and coloured badges rather than commissioned artwork.
> **Tradeoff:** cheap and fast, isolated to one screen, easy to swap later. (This decision was partially revisited in Act 3 — see below.)

> **Decision:** auth screens, dark mode, and a banners CMS were explicitly left out of this phase.
> **Tradeoff:** a smaller, shippable phase instead of a sprawling one. Auth came next anyway; dark mode remains a conscious "not yet", not an oversight.

### Act 2 — the elevation pass

Spec: `docs/superpowers/specs/2026-08-18-elevation-pass-design.md`.

Phase 1 made the app *consistent*. This pass made it *distinctive*, via four levers:

- **Typography** — Bricolage Grotesque on display roles only. Body stays system font: deliberate restraint, better legibility, zero cost on long screens.
- **Motion** — five moments and no more: the tab circle springing in, product-gallery parallax, Home's staggered entrance, the confirmation's checkmark landing, the add-to-cart bounce. All of it respects the phone's "reduce motion" accessibility setting automatically.
- **The motif** — the lozenge lattice, in its three places.
- **Illustrations** — six hand-authored SVG spot illustrations in one geometric duotone style.

> **Decision:** motion is limited to five named moments.
> **Alternative:** animate broadly.
> **Tradeoff:** less "wow" on a first scroll; far less chance of the app feeling busy, slow, or gimmicky on a mid-range Android phone. Motion that's everywhere reads as noise.

> **Decision:** custom fonts carry their weight *inside* the family name (`BricolageGrotesque_700Bold`), and styles must never also set `fontWeight`.
> **Why it matters:** setting both breaks font fallback on Android. This is now a written rule in `tokens.ts`, because it's the kind of thing that silently regresses.

### Act 3 — the brand becomes real

Then the actual logo arrived, and several things changed at once (`05aa611`):

- The mark was **rebuilt as vector geometry** from your logo PDFs, not embedded as an image. Recolourable, sharp at any size, animatable.
- Every native asset — app icon, all three Android adaptive layers, splash, favicon — was regenerated from that one source.
- The splash background became brand orange to match the native splash config, so the handoff from "the OS launching your app" to "your app running" has no visible seam.
- The name was corrected app-wide to **Litway Picks** (two words, matching the logo and the domain). Internal identifiers — the app's slug, deep-link scheme, and store bundle IDs — were deliberately left alone, because changing those breaks existing installs and store listings.

Then photography and an editorial home page (`cae5bb8` → `c1d707e` → `8b35a64`):

> **Decision:** the Home headline sits in ink *on the grey canvas*, with the campaign photo kept completely clean below it inside a full-width arch.
> **Alternative:** white text over the photo, the standard ecommerce hero.
> **Tradeoff:** "kills the white-text-on-busy-photo contrast fight entirely" — text is always legible regardless of what the photo does, and the photography gets to be photography instead of a background. Cost: a taller hero.

> **Decision:** photos are bundled into the app as compressed JPEGs (226KB and 340KB) rather than loaded from a URL.
> **Tradeoff:** instant, works offline, no third-party dependency — at the cost of app size and needing a release to change them.

> **Business decision, recorded here because it's easy to forget:** all free-delivery claims were removed everywhere — Home's announcement bar, the cart's free-shipping progress meter and its threshold logic, the checkout note, the product delivery card, and the shipping info page (which now says fees are calculated at checkout). If free delivery ever comes back, that's a deliberate re-add, not a revert.

### Act 4 — the motion pass

Two commits (`93c9a39`, `6c37fa1`) plus the splash choreography (`3ecfee9`, `554d5f1`):

- **The splash assembles itself.** The bag drops on a spring and squash-settles, speed lines streak in staggered, the "L" draws itself via stroke reveal, then the wordmark and tagline rise. ~1.4 seconds, built entirely in code from the logo's vector geometry — zero image assets, instant first frame, and it collapses to the finished frame instantly under reduced-motion. The app then deliberately *holds* the splash 1.7s so the choreography lands even when everything else loads instantly.
- **Fly-to-cart** — an orange bag chip arcs from the pressed button into the cart tab. Pure decoration; it never touches cart state, so it cannot cause a bug in the cart.
- **BrandLoader** — the logo bag bobbing while its speed lines streak past, replacing generic spinners at confirmation, reset-link verification, and infinite-scroll footers.
- **The daypart greeting** — Home's overline reads "Good morning · Monrovia".

> **Tradeoff of the splash hold:** every launch is at least 1.7 seconds. That is a real cost paid for a first impression. It's a one-line change if you ever decide it isn't worth it.

### Act 5 — the release build fights back

Two build-focused commits worth understanding because they'll recur:

- **`ea338fe`** removed three native modules that were installed but never used. Every installed native module gets compiled into every build whether you use it or not. Android release builds also got code-shrinking turned on.
- **`50c2705`** fixed a failure that only ever appeared in *release* builds — see [§7](#the-hermes-story).

### Act 6 — tonight

Which is the next section.

---

## 5. Tonight's overnight session

Ledger: `.superpowers/overnight/ledger.md`. Detailed reports: `.superpowers/overnight/wave*-report.md`, `round*-report.md`. Raw findings: `findings.json`.

### What was done

Six audit agents read the entire codebase in parallel across six domains — security, UX states, UX flows, performance, sync/correctness, accessibility — and every finding was independently verified before anyone touched code. **58 issues were confirmed: 8 critical, 15 high, 24 medium, 11 low. Zero were refuted.**

Those were fixed across six waves and three full UX rounds. Every wave was implemented, then reviewed by a separate agent that only looked for defects in the fix, then re-fixed if needed. Reviews caught real problems four separate times — including two criticals that would have shipped worse than the bugs they replaced.

Two gates ran after every single change, because there is no simulator here and no test suite: `npm run typecheck` (does it compile?) and `npx expo export --platform android` (does it survive the release compiler?).

### The fixes that matter most, in plain words

**Cross-account cart bleed (critical).** Signing out cleared your session but left your cart and wishlist sitting on the phone. The next person to sign in on that phone — a shared family phone, a shop's display phone — inherited them, and worse, the app would then *merge* those items into their account's cart on the server. Fixed: sign-out now cancels any pending sync, flushes what's outstanding, then clears both stores. The subtlety is that this had to distinguish "someone just signed out" from "nobody was ever signed in" — otherwise every guest's cart would be wiped on every app launch. A signed-in flag tracked across the app's lifetime makes that distinction.

**The payment recovery loop (critical).** The reference id for an in-flight payment only ever lived in memory. If the phone died, the app crashed, or the OS killed it while waiting for MoMo, that reference was gone forever — and the cart was still full, because the cart is only cleared on confirmed success. The customer's natural next move is to pay again. Now the reference is written to disk the instant it exists, and the next launch offers to check its status. If that check comes back successful, the cart is cleared right there — closing the loop. The record is only deleted on a *terminal* answer; a genuinely-still-pending payment keeps its lifeline. Tapping "Not now" doesn't delete it either; only a 30-minute expiry does.

**Tokens moved to secure storage (high).** The login token — which is enough to take over an account without knowing the password — was sitting in ordinary app storage, which is unencrypted on both platforms and readable from an unencrypted backup, a rooted device, or an MDM file export. It now lives in the phone's hardware-backed keychain (iOS Keychain / Android Keystore). That store caps values at ~2KB and a session is bigger, so the value is split into chunks and reassembled on read. Critically, existing signed-in users are migrated silently on their next read rather than being logged out. *The first attempt at this got the migration key wrong and would have logged out every existing user on update — the review caught it before it merged.*

**Success was being declared before it was known.** The confirmation screen used to say "Thank You! Your Order is Confirmed" the moment it opened, regardless of what the payment actually did. It now shows one of five honest states: checking, confirmed, still pending (with a real background poll, not just a promise of one), failed, or "we couldn't reach the server". A payment that failed no longer congratulates the customer for it.

**Screens that lied about being empty.** When a query failed — no signal, a server hiccup — the app showed "No products found" or, worse, "No orders yet" to a returning customer. Indistinguishable from a real empty result and with no way to retry. Every query in the app now has a real error state with a working Retry that shows in-flight feedback, and product detail no longer gets stuck in a permanent skeleton on failure.

**Silent failures that reported success.** Saving your profile closed the form as if it worked, no matter what the server said. Cart syncs failed into the void. Both now surface: profile save keeps the form open and tells you; cart sync retries once automatically, then shows a non-blocking notice — *"Cart changes are saved on this phone but not to your account yet"* — with a manual retry. Your local cart is never lost while this is true; only the server copy is behind.

**Screen readers had a silent app.** Not one icon-only button in the app exposed a label. A blind customer heard "button, button, button". Every one is now labelled, and the shared `IconButton` component makes the label a *required* property — the app now literally will not compile if someone adds an unlabelled icon button. Touch targets were enlarged to meet the 44pt minimum, and the faintest text colour was darkened.

**Speed.** The cart screen re-rendered every row on every quantity tap. Wishlist membership was a linear scan run once per visible product card on every wishlist change. Product lists rebuilt their arrays on every keystroke. All fixed with targeted subscriptions, memoization, and an O(1) lookup set — no architectural change, no new dependencies.

**Guest checkout was unreachable.** The cart forced every signed-out customer to a login wall, which made checkout's entire guest flow dead code. Guests now go straight to checkout, with an optional, non-blocking sign-in card.

### The judgment calls, recorded

- **Audit everything first, then fix in waves.** Parallel auditors on a clean, unchanging baseline beat interleaved fix-and-audit, where every fix invalidates the next auditor's reading.
- **Wishlist stays local-only.** There is no `wishlists` table in the database. Inventing a client-side schema for a shared backend is how you get two incompatible ideas of the same data. It's on the handoff list instead, and the app is written so wiring it up is small.
- **The push token stays where it is.** Same reasoning: the app writes it to auth metadata; whether the backend reads it there or wants a proper column is a backend decision, not a client guess.
- **No offline banner.** It needs a new native module and a full rebuild, which was outside what could be verified without a device tonight. It's a recommendation, not a fix.
- **Onboarding is treated as "seen" if storage fails.** A storage hiccup must never trap a returning customer on the intro screen.
- **Biometric cancel is silent; real failures alert.** Platform convention — cancelling Face ID shouldn't produce an error popup.
- **A seventh whole-system review was skipped.** Every wave already had its own review plus a scoped re-review, and round 3's audit *was* the whole-system pass. A seventh would have re-read the same diffs.

---

## 6. What still needs the backend team

These cannot be fixed from the app. Hand this section over verbatim.

### 1. IDOR on `getOrder` and `checkStatus` — the most important item here

`GET /api/momo/order/:referenceId` and `GET /api/momo/status/:referenceId` accept **no authentication whatsoever**. Anyone who has, guesses, or enumerates a reference id gets back the full order: customer first and last name, email, phone, delivery address and city, payment status, final total, and every line item.

Reference ids are not secret. They're returned to the client on payment initiation, they appear in deep links and push payloads, and the app polls `checkStatus` with one every 6 seconds. There is no visible rate limiting or ownership check.

In plain terms: **today, a stranger with a reference id can read a customer's name, phone number and home address.** In many jurisdictions that is a reportable data breach.

**Required fix:** require the caller to be either the authenticated owner (a Supabase JWT matched against `orders.user_id`) or to present a possession secret that is *not* the publicly-visible reference — for example a one-time signed token minted at payment initiation. Guest checkouts need the token path, since they have no account to match against.

The app has already been hardened as far as it can be: deep-linked reference ids are format-validated before use, and both endpoints carry explicit `SECURITY (backend handoff)` comments in `lib/api.ts` so nobody assumes it's handled.

### 2. Server-side re-pricing validation

The payload posted to `/api/momo/pay` still carries a client-held `price` for every line item. The app re-validates against the live catalog before submitting, but that only protects the honest app from showing a stale price — it does nothing against a modified client or a direct call to the endpoint. **The server must recompute every line item's price and the order total from its own catalog data and ignore whatever the client sent.** Marked in `app/checkout.tsx`.

### 3. RLS verification

Several reads and writes trust Supabase's Row Level Security to scope rows to the right customer, and those policies aren't in this repository so they couldn't be verified:

- `carts` — read and upsert filtered by `user_id`
- `users` — profile read filtered by `id`
- `orders` — `app/order/[id].tsx` selects by an id taken straight from the route, with no ownership predicate in the query

Note that `orders.user_id` is **nullable** (guest checkouts). If the `orders` policy isn't strict, that order-detail screen is a second data-exposure surface, independent of the API one above. **Please confirm every policy enforces `auth.uid() = user_id` (or the right owner check) for select and update, and that nothing permits anonymous or cross-user select on `orders`.**

### 4. Wishlists table + RLS

There is no `wishlists` table. The wishlist is therefore device-only: it doesn't appear on litwaypicks.com for the same account, and it's lost on reinstall or a new phone. **Add a `wishlists` table with RLS policies and tell us the shape.** The app is written to wire into it with a small change; a note in `store/wishlist.ts` explains exactly why nothing was invented client-side.

### 5. Push token — pick a side

The app writes the Expo push token to Supabase auth user metadata (`raw_user_meta_data.push_token`). The `users` table has no `push_token` column. **Either** confirm the backend reads it from auth metadata, **or** add a queryable column/table (e.g. `push_tokens`: user_id, token, device_id, platform) and we'll point the app at it. Until one of those is true, order-update pushes cannot be fanned out. Marked in `lib/notifications.ts`.

### 6. A pre-payment quote endpoint

The app cannot currently show a true order total, because it has no way to know the delivery fee before payment. The current honest workaround: the cart shows no shipping row, checkout labels its total **"Subtotal"**, and a note says the final amount appears in the MoMo prompt. **An endpoint that returns a quote (subtotal, delivery fee, total) for a given cart and delivery address would let the app show the real number before the customer commits.** This is the single best conversion improvement available.

### 7. `payment_status` string alignment

`getOrder` returns a `payment_status` field; `checkStatus` returns a `status` field. The app treats `SUCCESSFUL` and `COMPLETED` as success, and `FAILED` and `DISPUTED` as failure, in both places, using one shared predicate. **Please confirm both endpoints emit exactly the same vocabulary.** A status string one endpoint emits and the other doesn't means a customer can see a confirmed order on one screen and a pending one on another.

### 8. Offline banner — a decision for you, not a backend task

The app has no connectivity detection. A customer who loses signal sees error states rather than "you're offline". Adding it means a new native module (`@react-native-community/netinfo`) and a fresh build of the app. It was deliberately not added tonight because it couldn't be verified without a device. **Recommendation: do it, bundled with the next feature that requires a rebuild anyway.**

---

## 7. How to run and ship it

### Day-to-day development

```bash
npm install          # once, and after any dependency change
npm start            # starts the dev server
npm run typecheck    # the compile gate — must be 0 errors
```

`npm start` gives you a QR code. Scanning it opens the app on your phone with live reload. **But** this app uses native features that Expo Go can't provide — push notifications, biometrics, and the fast list renderer — so it needs a **development build**: a real installable app that connects to your dev server. The code already shims around Expo Go's limitations so it doesn't crash there, but you won't see the real thing.

### Building

Builds run on Expo's servers (EAS). Three profiles in `eas.json`:

| Profile | What it's for |
|---|---|
| `development` | A dev client — the app plus the live-reload connection. What you install once and keep. |
| `preview` | A real release-mode build, distributed internally. **Use this to test before you ship.** |
| `production` | Store submission. Auto-increments the build number. |

```bash
eas build --profile preview --platform android
eas build --profile production --platform all
```

### The Hermes story

Release builds are compiled differently from development builds, which means **a release build can fail on code that runs fine in development.** This app has already been bitten once.

Development ships JavaScript to your phone and runs it there. Release builds pre-compile it to bytecode with a compiler called **hermesc** — faster startup, smaller app. But hermesc is stricter. The Supabase library ships a line that loads an optional tracing package by variable name, and hermesc cannot parse that. The result: builds passed locally, then died on EAS with an unhelpful error.

The fix (`babel.config.js`) rewrites any such dynamic load to "resolve to nothing" during the build. Supabase's own null-check then simply runs with tracing off, which is correct on a phone anyway.

**The practical takeaway:** `npx expo export --platform android` runs hermesc locally. It is the only cheap way to catch release-only breakage. Every change in the overnight session was gated on it, and it should stay that way.

### App icons and splash

All generated from `assets/images/logo-1.pdf` / `logo-2.pdf` via the vector `LogoMark`: `icon.png`, the three Android adaptive layers (foreground, background, monochrome), `splash-icon.png`, `favicon.png`. The native splash background is brand orange in `app.json`, matching `BrandSplash`, so the handoff is seamless. **If the logo ever changes, regenerate all of them together** — a mismatched set is the classic way an app starts looking sloppy.

---

## 8. Working with AI on this codebase

Conventions future sessions are expected to keep:

1. **Tokens only.** No raw hex, no magic numbers. If a value doesn't exist in `theme/tokens.ts`, add it there. The design system is treated as law; fixes must not regress the visual language.
2. **Shared components over local copies.** If a screen needs a button, it uses `Button`. Rebuilding one inline is how a design system dies.
3. **Sentence case in copy.** "Payment failed", not "Payment Failed". A sweep enforced this; keep it.
4. **The gates are typecheck and export.** There is no test runner and no simulator here. `npm run typecheck` and `npx expo export --platform android` are the only automated proof anything works — run both before every commit. This is a real limitation, honestly stated: it proves the code compiles and bundles, not that it behaves.
5. **Explicit staging only.** Commit named files. Never `git add -A` — this repo has scratch directories and local config that must not be committed.
6. **Write it down.** Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`, session records in `.superpowers/overnight/`. Every judgment call gets a line in the ledger. This is why this guide could be written at all — nothing had to be reconstructed from memory.
7. **Review is separate from implementation.** Every wave tonight was implemented by one agent and reviewed by another whose only job was finding defects in the fix. It caught four real problems, two of them critical. Keep that separation.
8. **State the tradeoff.** A decision recorded without its alternatives is just an assertion. The pattern used throughout this document — decision, alternative, tradeoff accepted — is the format to keep.
9. **Update this guide when big changes land.** If a session changes what the app does, how it's organized, or what the backend owes you, it changes this file too, in the same commit.

---

## 9. Glossary

**Accessibility label** — invisible text attached to a button so a screen reader can announce what it does.

**AsyncStorage** — the phone's ordinary app storage. Survives restarts, but is not encrypted.

**Bundle** — all the app's JavaScript, packed into one file for shipping.

**Component** — a reusable piece of interface (a button, a card). Build once, use everywhere.

**Deep link** — a link that opens the app directly to a specific screen, e.g. `litwaypicks://product/red-dress`.

**EAS** — Expo Application Services. Expo's cloud that compiles the app and submits it to the stores.

**Expo / Expo Router** — the framework the app is built on, and its navigation system, where the folder structure *is* the map of screens.

**Hermes / hermesc** — the engine that runs JavaScript on the phone, and its compiler. Release builds are pre-compiled by hermesc, which is stricter than development.

**IDOR** — *Insecure Direct Object Reference*. A URL that hands you someone else's data just because you know its id. The order-lookup endpoint is one today.

**Infinite query** — loading a list one page at a time as the customer scrolls, instead of all at once.

**Memoization** — remembering a computed result so it isn't recalculated on every screen update. The main performance tool used here.

**Mutation** — a write to the server (place order, save profile, submit review). The opposite of a query.

**Native module** — a piece of a library written in the phone's own language. Adding one means a rebuild; it can't arrive over the air.

**Prop** — a value handed to a component to configure it (`<Button label="Pay" loading />`).

**Query** — a read from the server. Managed here by React Query, which handles caching, retries, loading and error states.

**React Native** — the technology that turns one codebase into real iOS and Android apps.

**Realtime subscription** — a live connection that pushes database changes to the app the instant they happen. Used to hear about payment outcomes.

**Reanimated** — the animation library. Runs animation on a separate thread so it stays smooth while the app is busy.

**RLS** — *Row Level Security*. Database rules that decide which rows each user may see or change. Your last line of defence; still unverified (see §6).

**SecureStore** — hardware-backed encrypted storage (iOS Keychain / Android Keystore). Where the login token now lives.

**Session / token** — proof that a customer is signed in. Whoever holds the token *is* that customer, which is why where it's stored matters.

**Skeleton** — the grey placeholder shapes shown while content loads.

**Store** — shared app memory any screen can read and write (cart, auth, wishlist, reviewed).

**Supabase** — the hosted database and login system behind both the app and the website.

**Token (design)** — a named design value like `color.accent`. Change it once, it changes everywhere.

**TypeScript** — JavaScript that checks data shapes before the app runs, so mistakes surface at compile time instead of on a customer's phone.

**Zustand** — the small library the stores are built with.

---

*Written by Claude, from the specs, plans, session ledger, audit reports and the code itself. Everything here is traceable to a file in this repository.*
