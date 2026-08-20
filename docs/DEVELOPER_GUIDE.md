# The developer's guide to Litway Picks

**For:** you — the owner of this app, sitting down to actually read the code.
**Assumes:** you know that programming exists, you can open a file in VS Code, and you've typed `npx expo start` at least once.
**Assumes nothing else.** Not what a component is. Not what state means. Not what `async` does. Every one of those is taught here, the first time it shows up, using code that is actually in your app — never a made-up example.

**Promise:** by the end you will be able to open any file in this repository, read it top to bottom, and know what it does, why it's shaped that way, and what happens if you change it.

Last updated: 2026-08-20. Replaces `docs/OWNERS_GUIDE.md`, which covered the same app for the same person wearing their business hat.

Revised after four pieces of work that landed *after* the first version of this guide: the backend hardening session (real `wishlists` and `push_tokens` tables, view and function security), the move to **accounts required for checkout** with `Authorization: Bearer` auth on the payment API, the **three-way cart sync**, and the **branded loading overlays**. Where an old decision was superseded, [§7](#7-decisions-and-tradeoffs) says so out loud rather than quietly deleting it — and there's a short "What changed recently" list at the end of that chapter.

---

## Table of contents

1. [The 30-second mental model](#1-the-30-second-mental-model)
2. [The vocabulary, taught on your own code](#2-the-vocabulary-taught-on-your-own-code)
3. [A guided tour of the folders](#3-a-guided-tour-of-the-folders)
4. [Reading your first screen, line by line](#4-reading-your-first-screen-line-by-line)
5. [The five big systems](#5-the-five-big-systems)
   - [5a. The design system](#5a-the-design-system-themetokensts)
   - [5b. State: zustand stores vs local state](#5b-state-zustand-stores-vs-local-state)
   - [5c. Server data: Supabase + React Query](#5c-server-data-supabase--react-query)
   - [5d. Navigation: expo-router](#5d-navigation-expo-router)
   - [5e. Payments, end to end](#5e-payments-end-to-end)
6. [The animation layer](#6-the-animation-layer)
7. [Decisions and tradeoffs](#7-decisions-and-tradeoffs)
8. [What still needs the backend or the dashboard](#8-what-still-needs-the-backend-or-the-dashboard)
9. [How to do common things](#9-how-to-do-common-things)
10. [When things break](#10-when-things-break)
11. [House rules for this codebase](#11-house-rules-for-this-codebase)
12. [Glossary](#12-glossary)

---

## 1. The 30-second mental model

Three sentences, then the detail.

**Your phone runs JavaScript.** **React Native turns the things you write in JavaScript into real iOS and Android views.** **Expo is the toolkit wrapped around both, so you never have to open Xcode or Android Studio.**

### The longer version

There is a small JavaScript engine living inside your app called **Hermes**. When someone opens Litway Picks, Hermes starts up and runs your code — all the files in `app/`, `components/`, `lib/`, `store/`, `theme/`.

Your code does not draw pixels. It *describes* what should be on screen. It says, in effect: "a vertical container, warm grey; inside it a white bar with the word `My Cart`; below that a scrolling list of rows." React Native reads that description and asks the operating system for the genuine article — a real `UIView` on iOS, a real `android.view.View` on Android. That is why the app feels native rather than like a website in a box: because it *is* native views, just instructed from JavaScript.

**Expo** is everything around that. It gives you:
- a dev server (`npx expo start`) that pushes code changes to your phone instantly,
- pre-built native modules for camera, biometrics, secure storage, notifications, etc.,
- a cloud build service (**EAS**) that compiles the actual `.ipa` and `.aab` files so you never touch Xcode,
- **expo-router**, the navigation system where your folder structure *is* your list of screens.

### "A screen is a function that returns UI"

This is the single most important sentence in the guide. Open `app/(tabs)/cart.tsx` and look at line 28:

**`app/(tabs)/cart.tsx`**
```tsx
export default function CartScreen() {
  ...
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      ...
    </View>
  );
}
```

`CartScreen` is a plain JavaScript function. It takes no arguments. It **returns** a description of the cart screen. That's it. There is no "screen object" you configure, no template file, no XML layout. A screen is a function; the thing it returns is what the user sees.

React calls that function whenever it thinks the screen might need to look different — when the cart changes, when you tap a button, when a network request finishes. Each call produces a fresh description; React compares it to the last one and changes only the native views that actually differ. That loop — *call the function, diff, patch the real views* — is the whole engine.

Everything else in this guide is detail hung on that sentence.

---

## 2. The vocabulary, taught on your own code

Read this chapter once, slowly. Everything after it assumes these eight ideas.

### 2.1 A component

A **component** is a function that returns UI and has a capitalised name. That's the entire definition. `CartScreen` above is a component. So is this one, the smallest in the app:

**`components/ui/Card.tsx`**
```tsx
export function Card({ children, style, padded = true }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderRadius: radius['2xl'],
          padding: padded ? spacing.lg : 0,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

`Card` is a white, rounded, shadowed box. Anywhere in the app you want that box, you write `<Card>…</Card>` instead of re-writing those seven style lines. When you decide cards should have a 28pt radius instead of 24, you change it here, once, and every card in the app changes.

The capital letter is not style — it's syntax. React treats `<View>` (capital) as a component and `<view>` (lowercase) as a literal HTML-ish tag. Always capitalise your components.

### 2.2 JSX — the HTML-looking stuff

The `<View>…</View>` inside a `return` is **JSX**. It looks like HTML. It is not HTML: it's JavaScript in a costume. Before your code ever runs, a tool called Babel rewrites `<View style={…}>hello</View>` into a normal function call. You never see that rewritten form, but knowing it exists explains all of JSX's rules:

- **Curly braces mean "back to real JavaScript".** In `<Text>{item.name}</Text>`, the `{item.name}` is an expression, evaluated and dropped in.
- **`style={{ ... }}` has two braces for a reason.** The outer pair is "here comes JavaScript"; the inner pair is a JavaScript object. Same for any object prop.
- **You can only return one top-level element.** That's why almost every screen is wrapped in a single `<View>`. When you need two siblings and no wrapper, use the empty tag `<>…</>` — you'll see it in `app/_layout.tsx` line 302.
- **Conditionals are expressions, not statements.** You can't write `if` inside JSX. You write one of these two patterns, both of which are all over this app:

**`app/(tabs)/cart.tsx`** — "render this only if that is true":
```tsx
{mergeNotice && (
  <View style={{ ... }}>
    <Ionicons name="information-circle" size={18} color={color.accent} />
    ...
  </View>
)}
```
`false && anything` is `false`, and React renders nothing for `false`. So when `mergeNotice` is false, the banner simply isn't there.

**`app/checkout.tsx`** — "this or that":
```tsx
{!user ? (
  <View> ... the "Sign in to place your order" card ... </View>
) : (
  <View> ... "Signed in as {user.email}" ... </View>
)}
```
That's the ternary operator: `condition ? whenTrue : whenFalse`.

- **Lists are made with `.map()`.** Given an array, `.map()` produces a new array — here, an array of elements:

**`app/checkout.tsx`**
```tsx
{LIBERIAN_COUNTIES.map((county) => (
  <TouchableOpacity
    key={county}
    onPress={() => { setForm((s) => ({ ...s, county })); setShowCountyPicker(false); }}
    ...
  >
```
Note `key={county}`. React needs a stable identity for each item in a list so it can tell "the third row changed" from "a new row was inserted at position 3". Forgetting `key` produces warnings and, in lists that reorder, genuinely wrong UI.

### 2.3 Props — how you configure a component

A **prop** is an argument you pass to a component. Written like an HTML attribute, received as a plain object parameter.

Your `ProductCard` — the tile used for every product in the app — declares exactly which props it accepts:

**`components/shop/ProductCard.tsx`**
```tsx
interface Props {
  product: Product;
  width?: number;
  variant?: 'grid' | 'horizontal';
}

export const ProductCard = memo(function ProductCard({ product, width, variant = 'grid' }: Props) {
```

Read that as: "ProductCard must be given a `product`. It may also be given a `width` and a `variant`; the `?` means optional, and if `variant` isn't given it defaults to `'grid'`."

At the call site, Home passes them like attributes — this is the horizontal rail:

**`app/(tabs)/index.tsx`**
```tsx
renderItem={({ item }) => <ProductCard product={item} width={172} variant="horizontal" />}
```
and the grid sections below it pass only the required prop, letting both defaults apply:
```tsx
<ProductCard product={item} />
```

Three things worth internalising:

1. **`{ product, width, variant = 'grid' }` is destructuring.** The component actually receives one object; those braces pull named fields out of it into local variables. It's the same trick as `const { data, error } = await supabase...` that you'll see everywhere in this codebase.
2. **Props flow one way: down.** A parent can hand data to a child. A child cannot reach up and change its parent's data. If a child needs to cause a change, the parent hands it a *function* to call — which is exactly what `onUpdate` and `onRemove` are in `CartItemRow`.
3. **`children` is a special prop.** Whatever you put between the opening and closing tags arrives as `props.children`. That's how `Card` wraps arbitrary content.

### 2.4 State, and your first hook: `useState`

**State** is a value that (a) the component remembers between renders, and (b) causes a re-render when it changes. That second half is the whole point. A normal variable inside a function is forgotten the moment the function returns and changing it draws nothing.

The clearest example in your app is the Sign In / Sign Up toggle on the login screen.

**`app/(auth)/login.tsx`**
```tsx
type Mode = 'login' | 'signup';

export default function LoginScreen() {
  ...
  const [mode, setMode] = useState<Mode>('login');
```

Read that line as three facts:
- `useState('login')` creates one piece of state, starting at `'login'`.
- It hands back a pair: the current value, and a function to change it. `[mode, setMode]` destructures that pair. The names are yours; `x`/`setX` is the universal convention.
- `<Mode>` tells TypeScript this value is only ever `'login'` or `'signup'`. Typo `'signin'` anywhere and the app refuses to compile.

Now watch it drive the screen. The toggle pills:

**`app/(auth)/login.tsx`**
```tsx
{(['login', 'signup'] as Mode[]).map((m) => (
  <TouchableOpacity
    key={m}
    onPress={() => setMode(m)}
    style={{
      flex: 1,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: mode === m ? color.surface : 'transparent',
      ...(mode === m ? shadow.header : {}),
    }}
  >
```

And the headline, the subtitle, the button label, and whether the name fields exist at all:

```tsx
<Text style={{ ...t.display, fontSize: 28, lineHeight: 34 }}>
  {mode === 'login' ? 'Welcome back.' : 'Create account.'}
</Text>
```
```tsx
{mode === 'signup' && (
  <View style={{ flexDirection: 'row', gap: 12 }}>
    ... First Name / Last Name inputs ...
  </View>
)}
```

The full loop: you tap "Sign Up" → `setMode('signup')` runs → React calls `LoginScreen()` again → this time `mode` is `'signup'`, so the headline reads "Create account.", the name fields appear, and the button says "Create Account". You never wrote code to *change* the headline. You wrote code that *describes the headline as a function of `mode`*, and changed `mode`.

**The rule that follows from this:** never mutate state directly. `mode = 'signup'` does nothing — React has no idea it happened. Only the setter triggers a re-render. Same for arrays and objects: you build a *new* one rather than editing the old. That's why you see the spread operator constantly:

**`app/checkout.tsx`**
```tsx
onChangeText={(v) => setForm((s) => ({ ...s, firstName: v }))}
```
"Give me a new form object that is a copy of the old one (`...s`) with `firstName` replaced." The `(s) => …` form — passing a function to the setter instead of a value — is the safe way when the new value depends on the old one.

**Why they're called hooks.** `useState` is a *hook*: a function starting with `use` that hooks a plain function up to React's machinery. Hooks have one hard rule: **call them at the top level of your component, unconditionally, in the same order every render.** Never inside an `if`, a loop, or a nested function. React matches hooks to their stored values by call order; break the order and you get another component's state. This is why every screen in this app has its whole block of `useState`/`useEffect`/store selectors sitting at the very top of the function.

### 2.5 `useEffect` — doing things that aren't rendering

Rendering should be pure: take props and state, return UI, touch nothing else. But apps must also *do* things — subscribe to something, start a timer, fetch on mount. That's `useEffect`: "after this render lands on screen, run this."

The simplest one in the app holds the splash screen up for its animation:

**`app/_layout.tsx`**
```tsx
const [splashMinHoldDone, setSplashMinHoldDone] = useState(false);
useEffect(() => {
  const timer = setTimeout(() => setSplashMinHoldDone(true), 1700);
  return () => clearTimeout(timer);
}, []);
```

Three parts, and all three matter:
- **The function** is the effect. Here: start a 1.7-second timer that flips a piece of state.
- **The returned function is the cleanup.** React runs it when the component unmounts, or before re-running the effect. Here it cancels the timer so a timer can't fire into a screen that's gone. Skipping cleanup is the single most common source of leaks and "why did this fire twice" bugs.
- **The `[]` is the dependency array.** It says "re-run this effect only when something in this list changes." An empty list means *run once on mount, clean up on unmount.* A list with values in it, like checkout's `[referenceId]`, means "tear the old one down and set a new one up whenever `referenceId` changes."

You'll meet a much bigger effect in [§5e](#5e-payments-end-to-end) — the one that watches for a payment result three ways at once and cleans up all three.

### 2.6 `async` / `await` — code that has to wait

Talking to a server takes time — tens of milliseconds at best, forever if the phone is on bad signal. JavaScript refuses to block while waiting (blocking would freeze the UI), so anything slow returns a **Promise**: an object meaning "an answer, later."

`async`/`await` is the readable way to work with promises. Marking a function `async` lets you `await` a promise inside it; `await` pauses *that function* (not the app) until the answer arrives.

Here is a real one — signing in, from the login screen:

**`app/(auth)/login.tsx`**
```tsx
async function handleAuth() {
  if (!email || !password) {
    Alert.alert('Missing fields', 'Please fill in all required fields.');
    return;
  }
  setLoading(true);

  if (mode === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { Alert.alert('Sign in failed', error.message); return; }
    navigateAfterAuth();
  } else {
```

Walk it:
1. Guard first. Nothing hits the network if the fields are empty.
2. `setLoading(true)` — state again, and this is why the button shows a spinner. `Button` takes a `loading` prop; `loading={loading}` on line 311 wires them together.
3. `await supabase.auth.signInWithPassword(...)` — the function pauses here. The app doesn't. The user can still scroll.
4. When the answer arrives, `{ error }` is destructured out of it. **Supabase never throws for a failed request**; it hands back `{ data, error }` and it's on you to check `error`. That convention is used consistently through this codebase — every `await supabase...` call is followed by an error check.
5. `setLoading(false)` before anything else, so the spinner stops in both the success and failure paths.

The signup branch just below shows the same shape, plus a decision that's worth knowing about (commit `541ba23`):

```tsx
const { data, error } = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName || null,
    },
  },
});
if (error) { setLoading(false); Alert.alert('Sign up failed', error.message); return; }
setLoading(false);
// Setting-agnostic: with email confirmation OFF, signUp returns a live
// session — the user is signed in right now, so welcome them and move on.
// With confirmation ON there's no session yet, so route them to their inbox.
if (data.session) {
  Alert.alert('Welcome to Litway Picks!', 'Your account is ready.');
  navigateAfterAuth();
  return;
}
```

Two things you own here. First, the profile row: notice the name is passed as `options.data`, i.e. auth metadata. A database trigger on `auth.users` builds the `public.users` profile row from it. An earlier version tried to insert that row from the app, which failed silently because with email confirmation on there's no session yet, and the database's security rules correctly rejected an anonymous insert. Second, `data.session` — whether signup hands back a live session depends on a **checkbox in your Supabase dashboard**. The code now works correctly with that checkbox in either position, so flipping it can't break signup.

**That checkbox is now off in production.** "Confirm email" was switched off in the Supabase dashboard during the backend session, so today `signUp` returns a live session and the first branch above is the one that runs: a new customer taps once and is signed in. Why that's the right call for this market, and what it costs you, is written up in [§7](#7-decisions-and-tradeoffs). The code stays setting-agnostic anyway — if you ever turn it back on, signup still behaves correctly without a code change.

**Two `await` gotchas worth knowing now:**
- `await` only works inside an `async` function. That's why you'll see `void somePromise()` in places — it means "start this and deliberately don't wait", and the `void` keyword silences the linter warning about an ignored promise.
- An `await` that rejects throws. That's why network work is wrapped in `try { … } catch (err) { … }`, as in `handlePlaceOrder` in checkout.

### 2.7 TypeScript — why every file ends in `.tsx`

JavaScript will happily let you write `product.nmae` and only tell you about it when a customer's screen shows `undefined`. TypeScript is JavaScript plus a description of the *shapes* of your data, checked before the app ever runs.

Your data shapes live in `types/`:

**`types/index.ts`**
```ts
export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  size?: string;
  color?: string;
  quantity: number;
  stock: number;
  slug: string;
}
```

That is the contract for everything in the cart. `size?` and `color?` are optional (not every product has them); everything else must be present. Any code that builds a cart item without a `slug`, or with `price` as a string, fails to compile.

The bigger win is `types/database.types.ts` — generated from your actual Supabase schema. `types/index.ts` then derives from it:

```ts
export type Product = Database['public']['Views']['products_with_categories']['Row'];
```

Which means: **the app's idea of a product is your database's idea of a product, automatically.** Add a column in Supabase and regenerate, and every screen that needs updating lights up red in your editor. This is not decoration — during the original audit, a missing field in this file caused the entire typed Supabase connection to collapse and produced 27 errors, and fixing it exposed a real bug where review submissions were missing a required field and would have failed for every customer.

`npm run typecheck` is the command that runs this check over the whole project. **Zero errors is the standard.** See [§10](#10-when-things-break).

### 2.8 Imports, exports and the `@/` alias

Every file is a module. Things are private unless exported:

```ts
export function normalizeLiberianPhone(input: string): string { ... }
```

and imported by path elsewhere:

```ts
import { normalizeLiberianPhone, isValidLiberianMobile } from '@/lib/phone';
```

`@/` means "the project root", configured in `tsconfig.json`:

```json
"paths": { "@/*": ["./*"] }
```

So `@/lib/phone` is `lib/phone.ts` no matter how deep the importing file is. Prefer it over `../../../lib/phone` — always.

One more distinction you'll see: `export default function CartScreen()` (a **default** export, one per file, imported without braces) versus `export function Card()` (a **named** export, as many as you like, imported with braces). expo-router requires each screen file to have a default export — that's the screen.

---

## 3. A guided tour of the folders

```
app/          every screen, and the routing map (the folders ARE the map)
components/   reusable pieces of UI
lib/          connections to the outside world + small pure helpers
store/        shared app memory (cart, auth, wishlist, reviewed)
theme/        the design system — one file, tokens.ts
types/        the shapes of your data
constants/    counties list + the old pre-redesign colour file
assets/       images, logo source PDFs, campaign photography
```

Plus, at the root: `app.json` (app identity and native config), `eas.json` (build profiles), `package.json` (dependencies and scripts), `babel.config.js` (a build-time fix, see [§10](#10-when-things-break)), `metro.config.js` + `global.css` + `tailwind.config.js` (NativeWind wiring), `tsconfig.json`, and `ios/` (generated native project — you don't hand-edit it).

### `app/` — a file *is* a screen

This is expo-router, and it is the thing most worth understanding early. There is no route table anywhere in this project. The file path is the URL.

| File | Route | What it is |
|---|---|---|
| `app/_layout.tsx` | — | The root layout: wraps everything, runs startup |
| `app/(tabs)/_layout.tsx` | — | Declares the four tabs |
| `app/(tabs)/index.tsx` | `/` | Home |
| `app/(tabs)/shop.tsx` | `/shop` | Search, sort, filter, infinite catalog |
| `app/(tabs)/cart.tsx` | `/cart` | Cart |
| `app/(tabs)/account.tsx` | `/account` | Profile / Orders / Wishlist / Settings |
| `app/product/[slug].tsx` | `/product/red-dress` | Product detail — one file, every product |
| `app/category/[slug].tsx` | `/category/shoes` | One category's grid |
| `app/checkout.tsx` | `/checkout` | Delivery form + payment |
| `app/confirmation.tsx` | `/confirmation` | Order outcome |
| `app/order/[id].tsx` | `/order/abc123` | A past order |
| `app/(auth)/login.tsx` | `/login` | Sign in / sign up / biometrics |
| `app/(auth)/reset-password.tsx` | `/reset-password` | Request a reset email |
| `app/(auth)/new-password.tsx` | `/new-password` | Land from the email, set a new password |
| `app/onboarding.tsx` | `/onboarding` | One-time first-run intro |
| `app/about\|contact\|privacy\|returns\|shipping\|terms.tsx` | `/about` etc. | Static info pages |
| `app/+not-found.tsx` | anything unmatched | Polite "that doesn't exist" |
| `app/+html.tsx` | — | Web-only HTML wrapper (irrelevant on phones) |

Three naming rules do all the work:

**Parentheses = a group that doesn't appear in the URL.** `(tabs)` and `(auth)` exist so those screens can share a layout. `app/(tabs)/cart.tsx` is reachable at `/cart`, not `/(tabs)/cart`.

**Square brackets = a slot.** `app/product/[slug].tsx` handles *every* product. Inside it, you read the filled-in value:

**`app/product/[slug].tsx`**
```tsx
queryKey: ['product', slug],
queryFn: async () => {
  const { data, error } = await supabase.rpc('get_product_by_slug', { product_slug: slug });
```

**`_layout.tsx` = a wrapper for everything beside and beneath it.** It renders once and stays mounted while its child screens come and go. That's why startup logic lives in `app/_layout.tsx` and the tab bar lives in `app/(tabs)/_layout.tsx`.

**When you'd touch `app/`:** adding a screen, changing what a screen shows, changing a flow.

### `components/` — the reusable pieces

Six neighbourhoods:

- **`ui/`** — the generic kit, and the one you'll reach for most: `Button`, `IconButton`, `Input`, `Card`, `Badge`, `List` (a FlashList/FlatList shim), `EmptyState`, `ErrorState`, `SkeletonLoader`, `QuantityStepper`, `ProgressStepper`, `PressableScale`, `ErrorBoundary`.
- **`brand/`** — `LogoMark` (the bag, rebuilt as vector geometry), `Motif` (the country-cloth lozenge lattice), `Marquee` (the endlessly scrolling promise strip), `RotatingBadge` (the circular "shop the drop" seal).
- **`motion/`** — `BrandLoader`, `LoadingOverlay`, `FlyToCart`, `DrawnCheckmark`, `IdleFloat`. See [§6](#6-the-animation-layer).
- **`shop/`** — `ProductCard` and `FilterSheet`.
- **`navigation/TabBar.tsx`** — the floating ink pill bar.
- **`auth/InkHeader.tsx`**, **`illustrations/index.tsx`**, **`BrandSplash.tsx`** — the black auth panel, six hand-drawn duotone spot illustrations, and the animated launch screen.

**When you'd touch `components/`:** changing how something *looks or behaves everywhere* — a button's shape, every product tile, every empty state.

**`ErrorBoundary` deserves a mention now.** It's the only class-based component in the app, because React's crash-catching API only exists in class form:

**`components/ui/ErrorBoundary.tsx`**
```tsx
static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error };
}

componentDidCatch(error: Error, info: React.ErrorInfo) {
  console.error('[ErrorBoundary]', error, info);
}
```
It wraps the entire app in `app/_layout.tsx`. If any component throws, the customer gets a polite screen with a Try Again button instead of a white void.

### `lib/` — the outside world

| File | What it is |
|---|---|
| `supabase.ts` | The database + auth connection, plus the encrypted-storage adapter for the session |
| `api.ts` | The four calls to your own server at litwaypicks.com, each signed with the customer's access token as a `Bearer` header |
| `storage.ts` | Small on-device records: onboarding-seen, recent searches, the pending-payment record; and the zustand persist adapter |
| `notifications.ts` | Push registration, token save, tap handling |
| `phone.ts` | Turns anything a Liberian customer types into `231XXXXXXXX` |
| `currency.ts` | Money formatting that can never print `$NaN` |

The last two are worth reading right now because they're four lines each and they show the house style:

**`lib/currency.ts`**
```ts
export function formatCurrency(amount: number): string {
  const n = Number(amount);
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}
```
Every price in the app goes through this. If the server ever sends `null`, the customer sees `$0.00`, not `$NaN`.

**`lib/phone.ts`**
```ts
export function normalizeLiberianPhone(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '');
  if (digits.startsWith('231')) return digits;
  if (digits.startsWith('0')) return '231' + digits.slice(1);
  return '231' + digits;
}
```
`0888640502`, `+231 888 640 502`, `231-888-640-502` all become `231888640502`. Every caller goes through this one function, so if MTN ever wants a different wire format, exactly one function changes.

**When you'd touch `lib/`:** changing an endpoint, adding a new outside service, changing a formatting rule.

### `store/` — shared memory

Four stores. Full walkthrough in [§5b](#5b-state-zustand-stores-vs-local-state).

- `auth.ts` — who's signed in, their profile, and a sign-out procedure that's more careful than you'd guess.
- `cart.ts` — the cart plus all the machinery keeping it in step with the server, including the **three-way merge** ([§5b](#5b-state-zustand-stores-vs-local-state)).
- `wishlist.ts` — saved items. **Now synced** to a real `wishlists` table on the backend; it used to be device-only, and [§7](#7-decisions-and-tradeoffs) explains why that changed.
- `reviewed.ts` — which order/product pairs already got a review, so the "Write a review" chip stops asking.

### `theme/tokens.ts` — one file, all design decisions

Every colour, spacing value, radius, shadow and text style. Screens ask for `color.accent`, never `'#ea580c'`. See [§5a](#5a-the-design-system-themetokensts).

### `types/`, `constants/`, `assets/`

- `types/database.types.ts` is generated from Supabase; `types/index.ts` derives friendly names from it and adds app-only shapes (`CartItem`, `CheckoutForm`, `ProductFilters`).
- `constants/counties.ts` is the 15 Liberian counties, `as const` so TypeScript knows the exact list.
- `constants/Colors.ts` is the **old, pre-redesign** colour file. It's still imported by nine files: the six static info pages, `app/order/[id].tsx`, `app/+not-found.tsx`, and `ErrorBoundary`. Those screens were out of scope for the redesign. Finishing that migration is a small, safe cleanup job whenever you want it.
- `assets/images/` holds the icons, the two campaign photos (`home-hero.jpg`, `auth-hero.jpg`), the clay delivery render, and the two logo PDFs everything else was generated from. `assets/fonts/` is empty — Bricolage Grotesque comes from the `@expo-google-fonts` package, not a bundled file.

### One wrinkle: two styling systems

NativeWind (Tailwind classes for React Native) is installed and wired up in `metro.config.js`, `global.css` and `tailwind.config.js`. It's used via `className="flex-1 px-5 pt-4"` in the older screens — the static info pages, `order/[id].tsx`, and much of `account.tsx`.

Everything built or rebuilt during the redesign uses **token-based inline styles** instead. Both work. **The house rule is tokens** ([§11](#11-house-rules-for-this-codebase)) — new code uses `style={{ ... }}` with values from `theme/tokens.ts`. The `className` usages are a legacy pocket, not a pattern to copy.

---

## 4. Reading your first screen, line by line

Open `app/(tabs)/cart.tsx`. It's 346 lines, it uses nearly everything in the app, and nothing in it is exotic. We'll go through it in order.

### The imports (lines 1–27)

```tsx
import React from 'react';
import {
  View,
  Text,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@/components/ui/List';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { color, font, radius } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
...
import type { CartItem } from '@/types';
```

Four groups, and every screen in the app follows this order: **React → React Native primitives → third-party packages → your own code (`@/…`)**. The last line uses `import type`, which imports a TypeScript shape only — it vanishes entirely at build time and costs nothing at runtime.

The React Native primitives are worth naming, because they're the entire vocabulary of a screen:
- **`View`** — a box. The only layout element. It's `<div>`.
- **`Text`** — text. Unlike the web, text *must* live inside a `Text`; a bare string in a `View` is an error.
- **`TouchableOpacity`** — a tappable region that dims on press.
- **`Alert`** — a native modal dialog.
- **`StatusBar`** — the clock-and-battery strip at the top.

### The component function and its hooks (lines 28–45)

```tsx
export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const total = useCartStore((s) => s.subtotal());
  const itemQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const mergeNotice = useCartStore((s) => s.mergeNotice);
  const dismissMergeNotice = useCartStore((s) => s.dismissMergeNotice);
  const syncFailed = useCartStore((s) => s.syncFailed);
  const retrySync = useCartStore((s) => s.retrySync);
  const syncing = useCartStore((s) => s.syncing);
  const syncNotice = useCartStore((s) => s.syncNotice);
  const dismissSyncNotice = useCartStore((s) => s.dismissSyncNotice);
  const manualSync = useCartStore((s) => s.manualSync);
  const userId = useAuthStore((s) => s.user?.id);
```

Sixteen lines of hooks looks like a lot, and it's worth saying why it isn't a smell. Twelve of them are *selectors* into one store — each subscribes this screen to exactly one field, so a change to `syncing` doesn't re-render anything that only reads `items`. The four sync-related ones (`syncing`, `syncNotice`, `dismissSyncNotice`, `manualSync`) all arrived with the manual sync button, which is covered properly in [§5b](#5b-state-zustand-stores-vs-local-state).

Every hook, at the top, unconditionally — the rule from [§2.4](#24-state-and-your-first-hook-usestate).

- `useSafeAreaInsets()` gives the pixel sizes of the notch, the home indicator, and the rounded corners. You'll see `paddingTop: insets.top + 12` below: that's how content avoids the camera cutout on every phone shape without hard-coding anything.
- `useRouter()` gives you navigation. See [§5d](#5d-navigation-expo-router).
- `useCartStore((s) => s.items)` is a **selector**. It says "subscribe this screen to *just* the `items` field." That precision is a performance decision, explained in [§5b](#5b-state-zustand-stores-vs-local-state).
- `items.reduce((s, i) => s + i.quantity, 0)` is plain JavaScript: walk the array, add up `quantity`, start from 0. That's total *units*, not lines — 3 of one shirt is "3 items", matching the Order Summary below.
- `useAuthStore((s) => s.user?.id)` — the `?.` is optional chaining: if `user` is null, the whole expression is `undefined` rather than a crash. Guests have no user; this line must not explode for them.

### The handlers (lines 47–71)

```tsx
function handleRetrySync() {
  if (userId) void retrySync(userId);
}

function handleManualSync() {
  if (userId) void manualSync(userId);
}

function handleCheckout() {
  // Checkout itself offers an optional, non-blocking sign-in card — guests
  // can order without an account, so never force a login wall here.
  router.push('/checkout');
}

function handleClearAll() {
  Alert.alert('Clear cart?', 'Remove all items from your cart?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: clearCart },
  ]);
}
```

Ordinary functions declared inside the component, so they can see `userId`, `router` and `clearCart`. Four notes:

- **That comment on `handleCheckout` is now out of date, and it's a useful thing to catch.** It was written when guests could complete an order. They can't any more — an account is required to *place* an order, and the gate lives in checkout's own `validateDelivery()` ([§5e](#5e-payments-end-to-end)). What is still true is the part the comment was really protecting: **the cart screen must not be a login wall.** A guest still browses, still adds to the cart, still opens checkout and still fills the form; the sign-in ask happens once, at the step-1-to-step-2 transition, with everything they typed preserved. When you next touch this file, rewrite the comment to say that.
- `handleManualSync` is the sync button in the header, which only exists for signed-in shoppers. It runs the three-way merge in [§5b](#5b-state-zustand-stores-vs-local-state).
- `Alert.alert(title, message, buttons)` — the third argument is an array of buttons. `style: 'destructive'` renders red on iOS. This is the app's standard confirm-before-you-destroy pattern.
- `void retrySync(userId)` — `retrySync` is async; we start it and deliberately don't wait.

### The early return (lines 71–91)

```tsx
if (items.length === 0) {
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{
        backgroundColor: color.surface,
        paddingHorizontal: 20,
        paddingBottom: 14,
        paddingTop: insets.top + 12,
      }}>
        <Text style={{ fontSize: 20, fontFamily: font.display, color: color.ink }}>My Cart</Text>
      </View>
      <EmptyState
        illustration={<EmptyBagIllustration />}
        title="Your cart is empty"
        description="Looks like you haven't added anything yet. Start shopping!"
        actionLabel="Browse Shop"
        onAction={() => router.push('/shop')}
      />
    </View>
  );
}
```

A component can `return` early — this is just JavaScript. Note this is *after* all the hooks, never before, or the hook order would change between renders.

Note `illustration={<EmptyBagIllustration />}`: **components are values.** You can pass one as a prop just like a number.

`flex: 1` means "take all available space in the parent". It's the most-used style in React Native by a mile. Layout here is flexbox and only flexbox — no floats, no grid, and the default direction is **column** (top to bottom), unlike the web's row default. Whenever you see `flexDirection: 'row'`, someone is explicitly asking for side-by-side.

### The header and the three notice banners (lines 93–202)

```tsx
<View style={{
  backgroundColor: color.surface,
  paddingHorizontal: 20,
  paddingBottom: 14,
  paddingTop: insets.top + 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
}}>
```
White surface floating on the grey canvas, laid out as a row, with the title on the left and the controls pushed to the right by `space-between`.

There are two controls on that right side now, and the first one only exists when there's an account to sync with:

**`app/(tabs)/cart.tsx`**
```tsx
{userId && (
  <TouchableOpacity
    onPress={handleManualSync}
    disabled={syncing}
    hitSlop={8}
    accessibilityRole="button"
    accessibilityLabel="Sync cart"
    style={{ opacity: syncing ? 0.5 : 1 }}
  >
    {syncing ? (
      <ActivityIndicator size="small" color={color.inkMuted} />
    ) : (
      <Ionicons name="sync-outline" size={20} color={color.inkMuted} />
    )}
  </TouchableOpacity>
)}
```
Three habits worth copying from those eleven lines: the control is *absent* for guests rather than present-and-disabled (there is nothing for a guest to sync); `disabled={syncing}` plus the swapped-in spinner makes double-tapping impossible and visibly so; and the dimming is `opacity`, not a second colour token, so the disabled look costs nothing to maintain.

Then three conditional banners. The first two share one slot:

**`app/(tabs)/cart.tsx`**
```tsx
{/* syncNotice (manual sync outcome) takes this slot over mergeNotice
    when both would otherwise apply, so the two banners never stack. */}
{syncNotice ? (
  <View style={{ ... backgroundColor: color.accentSoft ... }}>
    <Ionicons name="information-circle" size={18} color={color.accent} />
    <Text style={{ flex: 1, fontSize: 12.5, color: color.accentPressed, fontWeight: '600' }}>
      {syncNotice}
    </Text>
    <TouchableOpacity onPress={dismissSyncNotice} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
      <Ionicons name="close" size={16} color={color.accentPressed} />
    </TouchableOpacity>
  </View>
) : mergeNotice && (
```
Note the shape: a **ternary** whose "else" branch is itself a `&&`. That reads as "show the sync notice if there is one; otherwise show the merge notice if there is one; otherwise nothing." Written as two separate `{a && …}{b && …}` blocks, a shopper who signed in *and then* pressed sync would get two stacked orange banners saying overlapping things. One slot, one message.

The merge notice — the "else" half above — fires when signing in combined a device cart with an account cart:
```tsx
{mergeNotice && (
  <View style={{ ... backgroundColor: color.accentSoft ... }}>
    <Ionicons name="information-circle" size={18} color={color.accent} />
    <Text style={{ flex: 1, fontSize: 12.5, color: color.accentPressed, fontWeight: '600' }}>
      We combined this cart with items saved to your account.
    </Text>
    <TouchableOpacity onPress={dismissMergeNotice} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
      <Ionicons name="close" size={16} color={color.accentPressed} />
    </TouchableOpacity>
  </View>
)}
```

The sync-failure notice fires when the server copy of the cart is behind:
```tsx
{/* Non-blocking: syncToDb + its one automatic retry both failed. Local
    cart state is intact — this only means the server copy is behind. */}
{syncFailed && userId && (
  <View style={{ ... }}>
    <Ionicons name="cloud-offline-outline" size={18} color={color.inkMuted} />
    <Text style={{ flex: 1, fontSize: 12.5, color: color.inkMuted, fontWeight: '600' }}>
      Cart changes are saved on this phone but not to your account yet.
    </Text>
    <TouchableOpacity onPress={handleRetrySync} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry sync">
      <Text style={{ fontSize: 12.5, color: color.accent, fontWeight: '800' }}>Retry</Text>
    </TouchableOpacity>
  </View>
)}
```

Two accessibility details, both mandatory in this codebase: `accessibilityLabel` (what a screen reader announces for an icon-only control) and `hitSlop` (invisible extra touch area — a 16pt × icon is far below the 44pt minimum target, and `hitSlop={8}` buys back the difference).

### The list (lines 204–259)

```tsx
<FlashList
  data={items}
  estimatedItemSize={108}
  keyExtractor={(item) => `${item.productId}::${item.size}::${item.color}`}
  contentContainerStyle={{ padding: 12, paddingBottom: tabBarClearance }}
  renderItem={({ item }) => (
    <CartItemRow item={item} onUpdate={updateQuantity} onRemove={removeItem} />
  )}
  ListFooterComponent={ ... the Order Summary card ... }
/>
```

You do **not** put a long list inside a `ScrollView` — that builds every row up front. A list component only builds the rows near the viewport and recycles them as you scroll. Its props:

- `data` — the array.
- `renderItem` — a function called per item, given `{ item }`, returning that row.
- `keyExtractor` — the stable identity per row. Here it's product + size + colour, because "medium red" and "large red" are genuinely two different lines.
- `estimatedItemSize` — a hint that lets FlashList reserve space before measuring.
- `ListFooterComponent` — content rendered after the last row, so the Order Summary scrolls with the list rather than sitting in a fixed block.
- `paddingBottom: tabBarClearance` — from `useTabBarClearance()`, which is `insets.bottom + 12 + TAB_BAR_HEIGHT`. The tab bar floats *over* content, so every scrolling screen must reserve room or the last row hides under it.

`FlashList` here is your own shim, not the library directly:

**`components/ui/List.tsx`**
```tsx
const IS_EXPO_GO = Constants.appOwnership === 'expo';

export function FlashList<T>({ estimatedItemSize, ...props }: Props<T>) {
  if (!IS_EXPO_GO) {
    const { FlashList: NativeFlashList } = require('@shopify/flash-list');
    return <NativeFlashList estimatedItemSize={estimatedItemSize} {...props} />;
  }
  return <FlatList {...props} />;
}
```
The real FlashList needs a native component that isn't in Expo Go, so in Expo Go this quietly falls back to the built-in `FlatList`. Same pattern appears in `lib/notifications.ts`. This is why the app *runs* in Expo Go even though it isn't the real thing.

### The row component (lines 264–346)

```tsx
const CartItemRow = React.memo(function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (id: string, qty: number, size?: string, color?: string) => void;
  onRemove: (id: string, size?: string, color?: string) => void;
}) {
```

Note the prop types are written inline here rather than as a separate `interface` — both styles exist in the codebase and both are fine.

**`React.memo` is a performance wrapper.** Normally, when `CartScreen` re-renders, every `CartItemRow` re-renders too. `memo` says: "if this row's props are identical to last time, reuse the previous result." Since `onUpdate`/`onRemove` are store actions (stable identities that never change) and `item` only changes for the row you actually touched, tapping "+" on row 4 now re-renders row 4 alone. Before this fix, every quantity tap re-rendered every row in the cart.

The quantity stepper carries a deliberate UX decision:

```tsx
<QuantityStepper
  quantity={item.quantity}
  max={item.stock}
  onDecrement={() => {
    if (item.quantity === 1) {
      Alert.alert('Remove item?', `Remove "${item.name}" from your cart?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onUpdate(item.productId, 0, item.size, item.color),
        },
      ]);
      return;
    }
    onUpdate(item.productId, item.quantity - 1, item.size, item.color);
  }}
  onIncrement={() => onUpdate(item.productId, item.quantity + 1, item.size, item.color)}
/>
```
Decrementing from 1 would silently delete the line, so it asks first. `max={item.stock}` is why the "+" greys out at the stock ceiling.

And the image:
```tsx
<Image
  source={{ uri: item.imageUrl }}
  style={{ width: '100%', height: '100%' }}
  contentFit="cover"
  transition={200}
  recyclingKey={`${item.productId}::${item.size ?? ''}::${item.color ?? ''}`}
/>
```
This is `expo-image`, not React Native's built-in `Image` — it caches to disk, decodes off the main thread, and cross-fades in (`transition={200}`). `recyclingKey` matters in a recycling list: without it, a reused row can flash the *previous* item's photo for a frame before the new one decodes.

**That's the whole screen.** Every other screen in the app is this shape, bigger: hooks at the top, handlers next, a returned tree of `View`/`Text`/lists, styles from tokens.

---

## 5. The five big systems

### 5a. The design system (`theme/tokens.ts`)

**The problem it solves.** Before the redesign, colours were hard-coded across dozens of files. Changing the accent orange meant grepping the entire codebase and inevitably missing some. Now it's one line, one file.

A **token** is a named design value. Instead of `'#ea580c'` you write `color.accent`. Instead of `16` you write `spacing.lg`.

The file is organised in five blocks.

**Spacing — a 4-point grid:**
```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

/* Standard screen gutter — every horizontal edge aligns to this. */
export const gutter = spacing.lg;
```
`as const` tells TypeScript these are exact literal values, not just "some numbers" — so `spacing.lg` is typed as `16`, and typos like `spacing.xxl` fail to compile.

**Radius:** `sm: 8` through `'2xl': 24`, plus `full: 999` — the pill. Everything tappable in this app is a pill.

**The palette** holds raw ramps (`primary.50` … `primary.900`, `neutral.0` … `neutral.900`). **You almost never use these directly.** They exist so the semantic layer has something to point at.

**The semantic layer is what screens actually use**, and the comments in it are the design system's written constitution:

```ts
export const color = {
  /** App canvas — warm neutral grey, never white. */
  bg: '#ececec',
  /** Card / sheet / header surface that floats on the canvas. */
  surface: palette.neutral[0],
  /** Slightly recessed surface (search field, chips, icon buttons). */
  surfaceMuted: palette.neutral[100],
  /** Placeholder / skeleton fill, recessed steppers. */
  surfaceSunken: '#e2e2e2',
  /** Hairline separators & card outlines — used sparingly now that most separation is elevation. */
  border: '#e6e6e6',

  /** Primary text (canonical name). */
  ink: '#141414',
  /** Secondary text (subtitles, meta). */
  inkMuted: '#8a8a8a',
  /** Tertiary text (placeholders, faint labels). Darkened from #b8b8b8 — still
   *  decorative-tier contrast, not a substitute for inkMuted on real content. */
  inkFaint: '#9a9a9a',
```

Read the names as *intent*, not appearance. `color.surface` means "a thing that floats", which today is white. `color.ink` means "primary text", which today is near-black. If the brand ever went dark-mode, those meanings survive and only the values change.

The three rules encoded here:
1. **The canvas is warm grey, never white.** White is reserved for things that float. That single choice is what makes the app read as layered rather than flat.
2. **Ink, not black.** `#141414` reads softer on a screen than pure `#000`.
3. **One accent.** Orange `#ea580c`, on prices, primary buttons and active states — and almost nowhere else.

**Shadows** are three named presets, `shadow.card`, `shadow.header` and `shadow.accentGlow` (the soft orange glow under primary buttons). One preset per purpose; never hand-roll shadow values.

**Typography** carries a rule you must not break:
```ts
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
The weight lives *inside the family name*. Writing `{ fontFamily: font.display, fontWeight: '700' }` breaks font fallback on Android. Pick one or the other. Custom face for display roles (headlines, screen titles, prices); system font for body, deliberately — better legibility at small sizes, zero load cost.

Finally, `type` gives ready-made text presets you spread into a style:
```tsx
<Text style={{ ...t.display, fontSize: 28, lineHeight: 34 }}>
```
(In `login.tsx` the import is aliased: `import { type as t } from '@/theme/tokens'` — because `type` is a reserved word in TypeScript.)

**To change the brand colour everywhere:** edit `palette.primary[600]` in `theme/tokens.ts`. That single value feeds `color.accent`, which feeds every price, every primary button, every active tab. Then update the three places outside the token system that also carry orange: `app.json`'s `adaptiveIcon.backgroundColor`, the `expo-splash-screen` plugin's `backgroundColor`, and the `expo-notifications` plugin's `color`. Those are native config and need a rebuild.

### 5b. State: zustand stores vs local state

**A store is shared memory that any screen can read and write, and that survives navigation.**

`useState` is local — it belongs to one component and dies when that component unmounts. Perfect for "is this dropdown open", "which tab is selected", "what's typed in this field". Useless for the cart, which must be identical on the product screen, the tab-bar badge, the cart screen and checkout, and must survive the app being closed.

That's what **zustand** is for. Your cart store is the best example in the app; we'll read it in pieces.

**The shape first.** A zustand store holds both data and the functions that change it, in one object:

**`store/cart.ts`**
```ts
interface CartState {
  items: CartItem[];
  /** The three-way merge BASE: the item set this device and the server last
   * agreed on, captured after every successful loadFromDb/manualSync merge.
   * Persisted so it survives an app restart. */
  lastSyncedItems: CartItem[];
  /** Whose cart lastSyncedItems describes. A base captured for one account
   * must never be applied as the base for another — checked before every
   * merge (see manualSync/loadFromDb) and reset to null on clearCart. */
  lastSyncedUserId: string | null;
  ...
  mergeNotice: boolean;
  dismissMergeNotice: () => void;
  syncFailed: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  reconcile: (fresh: { productId: string; price: number; stock: number }[]) => void;
  clearCart: () => void;
  ...
  itemCount: () => number;
  subtotal: () => number;
}
```
`Omit<CartItem, 'quantity'>` reads as "a CartItem minus its quantity field" — because `addItem` always starts at quantity 1 and supplying it would be meaningless.

The two fields at the top with the long comments — `lastSyncedItems` and `lastSyncedUserId` — are the newest thing in this store and the subject of "[The three-way merge](#the-three-way-merge-the-hardest-thing-in-this-store)" below. Skip past them for now.

**The identity problem, solved once.** A cart line isn't a product — it's a product *in a size and colour*:
```ts
function cartKey(item: Pick<CartItem, 'productId' | 'size' | 'color'>): string {
  return `${item.productId}::${item.size ?? ''}::${item.color ?? ''}`;
}
```
One helper, used by every operation, so "medium red" and "large red" can never be confused.

**Creating the store:**
```ts
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      ...
      return {
      items: [],
      lastSyncedItems: [],
      lastSyncedUserId: null,
      mergeNotice: false,
      syncFailed: false,
      syncing: false,
      syncNotice: null,
      ...
```
`create` builds the store. `set` writes state; `get` reads it. Every action is just a function that calls `set`:

```ts
addItem: (newItem) => {
  set((state) => {
    const key = cartKey(newItem);
    const existing = state.items.find((i) => cartKey(i) === key);
    if (existing) {
      return {
        items: state.items.map((i) =>
          cartKey(i) === key
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
            : i
        ),
      };
    }
    return { items: [...state.items, { ...newItem, quantity: 1 }] };
  });
},
```
Same immutability rule as `useState`: `.map()` and `[...spread]` build *new* arrays rather than editing in place. And `Math.min(i.quantity + 1, i.stock)` means the cart cannot exceed available stock, ever, at the store level — not merely in the UI.

**`persist` — surviving a restart:**
```ts
{
  name: 'litways-cart',
  storage: createJSONStorage(() => storageAdapter()),
  // Only persist serializable cart state — methods are excluded. The
  // merge base (lastSyncedItems/lastSyncedUserId) must survive an app
  // restart too, or the very next sync after a relaunch would fall back
  // to an empty base and risk re-summing quantities already agreed on.
  partialize: (state) => ({
    items: state.items,
    lastSyncedItems: state.lastSyncedItems,
    lastSyncedUserId: state.lastSyncedUserId,
  }),
}
```
`persist` is middleware — a wrapper that adds behaviour. It writes the store to the phone's `AsyncStorage` after every change and reloads it on launch. `partialize` picks *what* to save: three fields. Functions can't be turned into JSON, and `mergeNotice`/`syncFailed`/`syncing`/`syncNotice` are session-scoped flags that would be wrong to restore — a "couldn't sync" banner from last Tuesday means nothing today. The two `lastSynced*` fields *must* be saved, for the reason the comment gives; that becomes obvious once you've read the merge below.

**Why selectors matter.** Two ways to read a store:

```tsx
const items = useCartStore((s) => s.items);        // subscribe to items only
const store = useCartStore();                       // subscribe to EVERYTHING
```

The second one re-renders the component on *any* change to the store. In the tab bar, that would mean the whole bar re-rendering when `syncFailed` flips. The first re-renders only when `items` actually changes. Every screen in this app uses the selector form — that was a deliberate performance pass, and it's a house rule.

You'll also see `useCartStore.getState()` (no hook, no subscription) inside effects and non-React code, e.g. `app/_layout.tsx`:
```tsx
const userId = useAuthStore.getState().user?.id;
if (userId) void useCartStore.getState().flushSync(userId);
```
Use that form when you need a value *right now* without wanting re-renders.

**Server sync, and every hard-won detail in it.** The store also owns keeping the server copy fresh. Read the comments — they're the record of what went wrong before:

```ts
// Keyed per userId so one user's cancel/schedule can never clear or collide
// with another user's pending write (e.g. across a fast sign-out/sign-in).
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
```

```ts
syncToDb: async (userId) => {
  const existing = debounceTimers.get(userId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    debounceTimers.delete(userId);
    void performSync(userId);
  }, 800);
  debounceTimers.set(userId, timer);
},
```
**Debouncing:** tapping "+" five times fast schedules five writes, each cancelling the last, so only one lands 800ms after you stop. Without this, a quantity stepper is a network flood.

`performSync` upserts to Supabase and, on failure, schedules exactly one retry five seconds later; if that also fails it sets `syncFailed: true` — which is precisely the flag the Cart screen banner reads. It never throws:
```ts
if (isRetry) {
  // The one automatic retry also failed — surface it, but keep the
  // local cart exactly as-is.
  console.warn('Cart syncToDb retry also failed');
  set({ syncFailed: true });
  return false;
}
```
**A sync failure must never lose local cart state.** The local cart is the truth the shopper is looking at; only the server copy is behind.

(`performSync` returns a boolean now — whether *this* attempt actually wrote — because `manualSync` needs to know whether to claim success. The raw upsert itself was also lifted out into a shared `writeCartRow(userId, items)` so the debounced path and the manual path can't drift apart with two slightly different versions of the same write.)

There are three flush variants and the difference between them is subtle enough to be worth reading in the source comments: `flushSync` writes now *only if something is pending* (called when the app backgrounds, where iOS can fire `inactive` then `background` back to back and would otherwise write twice); `retrySync` **always** writes now (the manual Retry button, where both timers have already fired and cleared); `cancelSync` cancels everything for everyone without writing (sign-out).

And the rule that a network error must never wipe a cart:
```ts
// PGRST116 = "no rows" from .single() — a brand-new user with no
// cart row yet, which is a genuinely empty cart, not a fetch error.
// Any other error (network, RLS, transient 5xx) must never clobber
// local state: log it and leave the local cart untouched, skipping
// the merge entirely rather than writing back an empty result.
if (error && error.code !== 'PGRST116') {
  console.warn('Cart loadFromDb failed:', error.message);
  return;
}
```

**Who calls `syncToDb`?** A subscription set up once at the app root:

**`app/_layout.tsx`**
```tsx
useEffect(() => {
  const unsubscribe = useCartStore.subscribe((state, prev) => {
    if (state.items === prev.items) return;
    const userId = useAuthStore.getState().user?.id;
    if (userId) state.syncToDb(userId);
  });
  return unsubscribe;
}, []);
```
Any change to `items`, while signed in, schedules a debounced write. Historically this was the bug that made "your cart follows you across devices" untrue: `syncToDb` existed and nothing ever called it.

#### The three-way merge — the hardest thing in this store

Everything above keeps the *server* in step with the *phone*. This section is about the harder direction: what to do when **both** have changed since they last agreed. It's the single most subtle piece of code in the app, so read it slowly — the ideas here apply to any two copies of anything that both get edited (which is most of software).

**Why the old sync felt broken.** Before this work, two things were true:

1. The device cart and the account cart were only ever combined at **sign-in**. After that, the account cart was never read again for the rest of the session.
2. Every edit on the phone wrote the *whole* cart row to the server, overwriting whatever was there. That's called **last-writer-wins**.

Put those together and here's the customer's experience. She adds a jacket on litwaypicks.com at her desk. Then she opens the app on her phone — which has been running since this morning, so no sign-in happens, so the jacket is never read — and taps "+" on a pair of shoes. Her phone writes its entire cart to the server. The jacket is gone. Nobody deleted it; it was simply not in the array the phone sent. She was never told.

**The obvious fix, and why it's wrong.** "Just add the quantities together." Watch it fail:

- Her cart has **2** shirts. Both sides agree: local 2, remote 2.
- She changes nothing at all, and the app syncs. `local + remote` = **4 shirts**.
- She syncs again. `4 + 4` = **8**.

This is the **double-count trap**, and it's the reason naive sync code silently inflates people's carts. The two copies of "2" aren't two facts. They're *the same fact*, seen twice.

**The fix is to stop merging values and start merging changes.** To do that you need a third snapshot: the **base** — what the two sides last agreed on. Then each side's *delta* (how far it has moved from the base) is a real, independent piece of information, and deltas can be added safely.

Here is the whole function, comment included, because the comment is half the teaching:

**`store/cart.ts`**
```ts
/**
 * Three-way merges a cart across three snapshots: the last-synced BASE (what
 * this device and the server agreed on after the previous sync), the current
 * LOCAL cart, and the current REMOTE (server) cart. Per cartKey, the merged
 * quantity is:
 *
 *   qty = max(0, baseQty + (localQty - baseQty) + (remoteQty - baseQty))
 *
 * i.e. base plus the SUM OF EACH SIDE'S INDEPENDENT DELTA from base — not a
 * straight `local + remote`. The double-count trap that guards against: if
 * base already has 2 of an item and neither side touched it, `local + remote`
 * would report 4 (both copies of the same 2 counted again), while the
 * base+deltas form correctly reports 2 (delta 0 + delta 0). An independent
 * add on one side (local 2→3, remote unchanged at 2) still lands at 3 (delta
 * +1 + delta 0). Because every quantity is expressed as a delta from a
 * shared base, re-running the merge with nothing new on either side is a
 * no-op (both deltas are 0), and a removal on either side (delta walks down
 * to -baseQty) sticks instead of being resurrected by the other side's
 * untouched copy.
 *
 * The base MUST be scoped per-user (see lastSyncedUserId below) — a base
 * captured for a different account could reuse the same cartKeys to
 * describe an entirely different cart, corrupting the delta math here.
 *
 * Metadata (name/brand/price/imageUrl/slug/stock/size/color) prefers the
 * local entry, then remote, then base — local is whatever the shopper has
 * actually been looking at this session.
 */
export function threeWayMergeCarts(base: CartItem[], local: CartItem[], remote: CartItem[]): CartItem[] {
  const byKey = (list: CartItem[]) => {
    const map = new Map<string, CartItem>();
    for (const item of list) map.set(cartKey(item), item);
    return map;
  };
  const baseMap = byKey(base);
  const localMap = byKey(local);
  const remoteMap = byKey(remote);

  const keys = new Set<string>([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const result: CartItem[] = [];

  for (const key of keys) {
    const b = baseMap.get(key);
    const l = localMap.get(key);
    const r = remoteMap.get(key);
    const baseQty = b?.quantity ?? 0;
    const localQty = l?.quantity ?? 0;
    const remoteQty = r?.quantity ?? 0;
    const qty = Math.max(0, baseQty + (localQty - baseQty) + (remoteQty - baseQty));
    if (qty <= 0) continue;
    const meta = l ?? r ?? b!;
    result.push({ ...meta, quantity: qty });
  }

  return result;
}
```

Read the mechanics off the code:

- **`Map` and `Set` do the bookkeeping.** A `Map` is a lookup table keyed by anything (here, the `cartKey` string); a `Set` is a collection with no duplicates. Building the union of all three sides' keys in a `Set` is what guarantees the loop visits every line that exists *anywhere* — including one that's only on the server, or only in the base because both sides deleted it.
- **`?? 0` turns "absent" into a number.** A line missing from a side has quantity 0 there. That one substitution is what lets addition express *removal*: base 2, local 0 → delta −2.
- **`Math.max(0, …)` clamps.** Both sides removing the same line gives 2 + (−2) + (−2) = −2; the clamp makes it 0, and `if (qty <= 0) continue` drops it.
- **`const meta = l ?? r ?? b!`** picks which side's *name, price, photo* survive: local first, because that's what the shopper has been looking at. Only the quantity comes from the arithmetic. (The `!` on `b` is TypeScript's non-null assertion — "trust me, this exists" — and it's safe here only because the key came from the union of the three maps, so at least one of the three must have it.)
- **The whole thing is idempotent.** Run it twice with nothing new and you get the same answer, because both deltas are zero. **Idempotent** means "doing it again changes nothing" — the property you want in every sync routine, because syncs get retried, double-fired and raced constantly.

**Where the base comes from, and the trap in it.** The base is `lastSyncedItems`, saved after every successful merge. But a base is only meaningful *for the account it was captured under* — `productId::size::color` keys are not account-specific, so one person's base would happily "explain" another person's cart and produce nonsense. Hence `lastSyncedUserId`, and this check in both places that merge:

**`store/cart.ts`**
```ts
const { items: local, lastSyncedItems, lastSyncedUserId } = get();
// A base captured under a different account must never be used
// here — its deltas would describe a different cart entirely.
const base = lastSyncedUserId === userId ? lastSyncedItems : [];
```
A mismatch falls back to an empty base, which degrades the merge to "union everything" — imperfect, but safe. And `clearCart()` resets both fields, for the same reason.

**Checking the catalog while we're here.** A merged cart can contain things that are no longer buyable, so `manualSync` follows the merge with one catalog query:

**`store/cart.ts`**
```ts
/**
 * Revalidates surviving cart items against live catalog stock/price in a
 * single query. Used by manualSync only — NOT by loadFromDb, which needs to
 * stay fast and tolerant of the device being offline at sign-in; checkout
 * revalidates independently anyway before charging anyone.
 *
 * Missing product id or stock <= 0 drops the item (counted in `dropped`).
 * qty > live stock clamps to live stock (counted in `adjusted`). Surviving
 * items get their price refreshed to (sale_price ?? price) and stock to the
 * live value. Throws on a query error — the caller decides how to surface
 * that rather than this silently reporting an empty result.
 */
export async function refreshAvailability(
  items: CartItem[]
): Promise<{ items: CartItem[]; dropped: number; adjusted: number }> {
  if (items.length === 0) return { items: [], dropped: 0, adjusted: 0 };

  const ids = [...new Set(items.map((i) => i.productId))];
  const { data, error } = await supabase
    .from('products')
    .select('id, stock, price, sale_price')
    .in('id', ids);

  if (error) throw error;
```
**One query for the whole cart, not one per item.** `[...new Set(ids)]` de-duplicates (the same product in two sizes is two lines but one product), and `.in('id', ids)` fetches them all at once. `sale_price ?? price` is the app's standard "the sale price if there is one, otherwise the list price".

Note what the comment rules *out*: `loadFromDb` — the sign-in path — deliberately does **not** call this. Sign-in has to work on a bad connection and must not stall behind a second query, and checkout re-validates everything against the live catalog before charging anybody anyway ([§5e](#5e-payments-end-to-end)). Two checks in the place that matters beats a slow check in the place that doesn't.

**The ordering inside `manualSync`, which is the part a reviewer caught.** Five steps, and their order is the whole point:

**`store/cart.ts`**
```ts
const merged = threeWayMergeCarts(base, local, remote);
const { items: finalItems, dropped, adjusted } = await refreshAvailability(merged);

// Write BEFORE applying anything locally. Availability-driven
// drops/clamps must never land on the shopper's local cart unless
// the server write actually succeeds — applying them first (the
// old ordering) meant an offline shopper could watch items vanish
// or shrink while the failure notice claimed nothing had happened.
// On failure, items/lastSyncedItems/lastSyncedUserId are left
// completely untouched below.
const wrote = await writeCartRow(userId, finalItems);

if (!wrote) {
  set({ syncNotice: "Couldn't sync your cart — check your connection and try again." });
  return;
}

set({ items: finalItems, lastSyncedItems: finalItems, lastSyncedUserId: userId });
```
The first version applied the merge locally and *then* wrote. On a failed write, the shopper had already watched two items disappear from her cart while a banner told her the sync hadn't worked. Both statements were true and together they were a lie.

**Write-then-apply** is now a house rule ([§11](#11-house-rules-for-this-codebase)): when a change has to land in two places, write the one that can fail *first*, and only change what the user is looking at once it has succeeded. The failure path then genuinely changes nothing, which is what "it didn't work" is supposed to mean.

The step before all of this matters too:
```ts
// A queued debounced write must not race the merge below — it
// would read a half-merged `items` or clobber the merge result
// right after this function sets it.
get().cancelSync();
```
The 800ms debounced writer from earlier in this section is still armed while `manualSync` runs. Cancel it first, or it fires mid-merge with a stale array.

**Then the notice tells the truth about what moved.** The store counts the lines whose quantity actually differs from the pre-sync local cart, and says so:
```ts
let notice = updatedCount > 0
  ? `Cart synced — ${updatedCount} item${updatedCount === 1 ? '' : 's'} updated from your other devices`
  : 'Cart synced';
const extras: string[] = [];
if (adjusted > 0) extras.push(`${adjusted} adjusted to available stock`);
if (dropped > 0) extras.push(`${dropped} no longer available`);
if (extras.length > 0) notice += ' · ' + extras.join(' · ');
```
"Cart synced" when nothing changed. "Cart synced — 2 items updated from your other devices · 1 no longer available" when things did. Never a generic success message papering over a silently rewritten cart. That string is what the banner in [§4](#4-reading-your-first-screen-line-by-line) renders.

**And sign-in uses the same engine.** `loadFromDb` — which runs when someone signs in — is now the merge function plus the "did anything visibly change?" test that drives `mergeNotice`:
```ts
const base = state.lastSyncedUserId === userId ? state.lastSyncedItems : [];
const merged = threeWayMergeCarts(base, local, remote);

// Only surface the banner when the merge actually changed
// something visible vs. the pre-merge local cart — a different
// item count, or a bumped quantity on an existing line.
const localByKey = new Map(local.map((i) => [cartKey(i), i]));
const changed =
  merged.length !== local.length ||
  merged.some((i) => (localByKey.get(cartKey(i))?.quantity ?? 0) !== i.quantity);
```
One merge engine, two callers, and the base is updated by both — so whichever path ran last leaves a correct starting point for the next one.

**What this buys the shopper, in one sentence:** edits made on the website and edits made on the phone both survive, removals stay removed, quantities never inflate, and pressing sync twice is harmless.

**The auth store is smaller but its `signOut` is the most careful function in the app:**

**`store/auth.ts`**
```ts
signOut: async () => {
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    const cart = useCartStore.getState();
    const write = cart.syncFailed ? cart.retrySync(userId) : cart.flushSync(userId);
    write.catch(() => {});
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
    try {
      await Promise.race([write, timeout]);
    } catch {
      // Best-effort only — proceed with sign-out regardless.
    }
  }
  useCartStore.getState().cancelSync();
  await supabase.auth.signOut();
  set({ session: null, user: null, profile: null });
  useCartStore.getState().clearCart();
  useWishlistStore.getState().clear();
},
```
In order: flush anything unsaved (because `clearCart()` below destroys it), but cap the wait at 3 seconds via `Promise.race` so a hung network can't stall sign-out; cancel any pending write so a stale one can't land on the *next* user's row; sign out; clear the stores.

That last step is the fix for a genuine critical bug: signing out used to leave the cart and wishlist on the device, so the next person to sign in on a shared phone inherited them — and worse, the app then merged them into *their* account on the server.

The same purge also has to happen when a session ends without anyone tapping Sign Out (token expiry, forced sign-out). That lives in `app/_layout.tsx`, and it needed a subtle guard:

```tsx
// Tracks whether we've observed a signed-in session, so we only purge local
// cart/wishlist on a genuine sign-out transition — not on every guest launch
// where session is null from the start.
const hadSessionRef = useRef(false);
```
Without that flag, every guest's cart would be wiped on every launch. `useRef` is the third memory hook: like `useState`, it survives re-renders; unlike `useState`, changing it does **not** trigger one. Use it for bookkeeping the UI doesn't display.

One line at the end of `signOut` is deliberately *not* there, and the comment explains the absence — worth reading because "why isn't there code here" is the hardest thing to reconstruct later:

**`store/auth.ts`**
```ts
// Deliberately NOT deleting this device's push_tokens row here: the next
// sign-in on this device reassigns it (upsert onConflict: 'token' in
// lib/notifications.ts), and an orphaned row in the meantime is harmless
// — it's own-row RLS-protected and simply unreachable until reassigned.
```

#### The wishlist store, now that it has somewhere to sync to

The wishlist used to be device-only because there was no table for it. There is now — `public.wishlists`, with `user_id` + `product_id` as its primary key and own-row security — so the store writes to it. Its sync is deliberately *much* simpler than the cart's, and the header comment says why:

**`store/wishlist.ts`**
```ts
// `public.wishlists` landed on the backend (user_id, product_id, created_at —
// PK (user_id, product_id), own-row RLS). Sync design (v1, kept deliberately
// simple next to store/cart.ts's debounced/retry machinery):
//  - loadFromDb unions remote + local, never clobbers local on a fetch error.
//  - addItem/removeItem write straight through while signed in (no
//    debounce — one row per (user, product), so there's nothing to coalesce).
//  - KNOWN v1 TRADEOFF: an offline/failed REMOVAL write can resurrect on the
//    next loadFromDb union, since the remote row is still there and the union
//    only ever grows local state back in. Accepted for v1 — see design notes.
```

Three things to take from that:

**The data shape decides the sync design.** A cart line is a *quantity* — a number two sides can both move, which is exactly what needs delta arithmetic and a base. A wishlist entry is *membership* — a row that either exists or doesn't. There's nothing to coalesce and nothing to add up, so a **union** (keep everything either side has) is enough, and the debounce/retry/base machinery would be pure cost.

**Write-through** means each change goes to the server immediately as its own tiny write, rather than being batched:
```ts
function syncAdd(productId: string) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  supabase
    .from('wishlists')
    .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
    .then(({ error }) => {
      if (error) console.warn('Wishlist add sync failed:', error.message);
    });
}
```
`onConflict: 'user_id,product_id'` with `ignoreDuplicates` makes tapping the heart twice, or two devices adding the same item at once, a harmless no-op instead of an error — idempotent again. And note `if (!userId) return`: a guest's wishlist still works perfectly, it just stays on the phone.

**The known hole is written down rather than hidden.** If a removal fails while the phone is offline, the row survives on the server, and the next union pulls it back — the item reappears. That is a real (if minor) bug, it is documented in the file, and the fix when you want it is the same idea the cart uses: remember what you removed (a tombstone, or a base snapshot) instead of only ever adding.

`loadFromDb` runs at sign-in, alongside the cart's. Remote ids the phone doesn't recognise need a `products` lookup to become renderable rows, and a failure there skips just those ids for this pass rather than failing the whole load — the same "degrade, don't collapse" instinct as everywhere else in this codebase.

**When to use which:**

| Use | For |
|---|---|
| `useState` | Anything one screen owns: form fields, open/closed, which tab, in-flight flags |
| `useRef` | Values you remember but don't display: timers, "have I done this already" flags, refs to inputs |
| A zustand store | Anything two or more screens share, or that must survive navigation: cart, auth, wishlist |
| React Query | Anything that lives on a server — see next section |

### 5c. Server data: Supabase + React Query

**Never put server data in a zustand store.** That's the rule, and here's the reasoning: server data isn't yours. It's a *cached copy* of something that can change without telling you. It has states a store has no vocabulary for — loading, stale, refetching, failed — and every one of those needs to reach the screen. A store would force you to hand-write all of that, four times, slightly differently.

**Supabase** is your database and your login system, reached through one configured client:

**`lib/supabase.ts`**
```ts
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```
`createClient<Database>` is where your generated types plug in — that generic parameter is why `supabase.from('products_with_categories').select('*')` comes back typed, and why a typo in a table name is a compile error.

`SecureStoreAdapter` is worth understanding because it protects the most sensitive thing on the device. A session token *is* the account — whoever holds it is that customer, no password needed. It used to live in ordinary `AsyncStorage`, which is unencrypted and readable from a backup, a rooted device, or an MDM file export. It now lives in the phone's hardware keychain. That store caps values at ~2KB and a session is bigger, so:

```ts
// expo-secure-store caps each value at ~2048 bytes, but a Supabase session
// (access token + refresh token + user object, JSON-stringified) can exceed
// that comfortably. We chunk the serialized value across `key.0`, `key.1`, …
// entries plus a `key.count` entry recording how many chunks were written,
// and reassemble on read.
const CHUNK_SIZE = 2000;
```

And crucially, existing signed-in users are migrated silently rather than logged out:
```ts
// One-time migration: fall back to the old AsyncStorage value (unencrypted),
// then copy it into SecureStore and delete the AsyncStorage copy so future
// reads go through the encrypted path only.
const legacyValue = await AsyncStorage.getItem(key).catch(() => null);
```

**React Query** manages every read from that database. A **query** is a named, cached read. Here's the smallest one in the app:

**`app/(tabs)/index.tsx`**
```tsx
const {
  data: featured,
  isLoading: loadingFeatured,
  isError: errorFeatured,
  isFetching: fetchingFeatured,
  refetch: refetchFeatured,
} = useQuery({
  queryKey: ['featured-products'],
  queryFn: async () => {
    const { data, error } = await supabase.from('featured_products').select('*').limit(10);
    if (error) throw error;
    return data as Product[];
  },
});
```

Two inputs:
- **`queryFn`** — how to fetch. Note `if (error) throw error;`: React Query decides "failed" by whether the function *throws*, and Supabase returns errors rather than throwing, so you must convert. Every query in this app has that line.
- **`queryKey`** — the cache address. Two components asking for `['featured-products']` share one request and one cached result. Put every input the fetch depends on into the key, and the cache handles the rest automatically:

**`app/(tabs)/shop.tsx`**
```tsx
queryKey: ['products', query, sort, filters],
```
Change the sort, and that's a different key, so it's a different cache entry — and switching back is instant because the old one is still cached.

Four outputs, and screens must handle all of them:
- **`isLoading`** — first fetch, nothing cached yet. Show a skeleton.
- **`isError`** — it failed. Show a real error state with a retry.
- **`data`** — the result. Might be empty, which is different from failed.
- **`isFetching`** — a request is in flight *including* background refetches. Used to show in-flight feedback on the Retry button.

The full four-state pattern, from the Orders tab:

**`app/(tabs)/account.tsx`**
```tsx
if (isLoading) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

if (isError) {
  return (
    <ErrorState
      message="Couldn't load your orders. Check your connection and try again."
      onRetry={() => refetch()}
      loading={isFetching}
    />
  );
}

if (!orders?.length) {
  return (
    <EmptyState
      illustration={<ReceiptIllustration />}
      title="No orders yet"
      description="Your order history will appear here."
      actionLabel="Start Shopping"
      onAction={() => router.push('/(tabs)/shop')}
    />
  );
}
```

**Read those in order and notice the third one.** Before the UX audit, a failed query fell straight through to "No orders yet" — a returning customer on bad signal was told, with total confidence, that they had never ordered anything, and given no way to retry. `isError` and "empty" are different states and the app must never conflate them. That distinction is now enforced everywhere, via the shared `ErrorState` component.

`refetch` on the retry button is React Query's "try that again", and because `loading={isFetching}` is wired through, the button shows a spinner while it works instead of feeling dead.

**Two more query features you'll meet:**

`enabled` — don't run until you have what you need:
```tsx
queryKey: ['reviews', product?.id],
queryFn: async () => { ... },
enabled: !!product?.id,
```
Reviews can't be fetched before the product exists. `!!` coerces to a real boolean.

**Infinite queries** — pagination:
```tsx
} = useInfiniteQuery({
  queryKey: ['products', query, sort, filters],
  initialPageParam: 0,
  queryFn: async ({ pageParam }) => { ... },
  getNextPageParam: (lastPage, allPages) =>
    lastPage.rawLen === PAGE_SIZE ? allPages.length : undefined,
  staleTime: 30_000,
});
```
`getNextPageParam` returning `undefined` means "no more pages" — here, a page shorter than `PAGE_SIZE` is the last one. Note `rawLen` rather than the filtered length:
```tsx
// rawLen tracks the *server* page size so pagination doesn't stop early
// when client-side filters shrink the visible list.
```
And the flatten is memoised, so a keystroke doesn't rebuild the array:
```tsx
const products = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
```
`useMemo` is the fourth hook: "recompute this only when the dependencies change."

**Global defaults** live at the app root:

**`app/_layout.tsx`**
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});
```
Data is considered fresh for 60 seconds (no refetch on remount within that window) and failed requests retry twice before surfacing as `isError`. `QueryClientProvider` wraps the whole app so every `useQuery` anywhere shares this one cache.

**Writes** don't go through React Query here — they're plain `async` functions plus a manual cache invalidation where needed:

**`app/(tabs)/account.tsx`**
```tsx
async function handleSave() {
  if (!user) return;
  setSaving(true);
  try {
    const { error } = await supabase.from('users').update(form).eq('id', user.id);
    if (error) {
      Alert.alert("Couldn't save changes", error.message);
      return;
    }
    await fetchProfile(user.id);
    setEditing(false);
  } finally {
    setSaving(false);
  }
}
```
Two details that were bugs before: on error the form **stays open** and says so (it used to close as if it had worked, no matter what the server said), and `finally` guarantees the spinner stops on every path including the early `return`.

After submitting a review, the relevant cache entry is thrown away so the list refetches:
```tsx
queryClient.invalidateQueries({ queryKey: ['reviews', state!.item.id] });
```

#### What the database itself enforces (and why that matters more than any of the above)

Everything in this chapter is *the app asking politely*. A modified app, or anyone with your public anon key and a terminal, can ask differently. The only thing standing between a stranger and your customers' data is the database's own rules. Those rules live in Supabase, not in this repository, and they were hardened in a dedicated session after the first version of this guide. You should know what changed, because it's the layer you can't see from here.

**RLS — Row Level Security — is the mechanism.** A policy is a rule attached to a table saying which rows a given caller may read, insert, update or delete. `wishlists` and `push_tokens`, both added in that session, each carry own-row policies: you can only touch rows whose `user_id` is your own id. That's why `store/wishlist.ts` can write straight to the table from the phone without any server code in between — the table refuses to be misused.

Four more changes, each of which is a lesson:

- **`security_invoker=on` on the `products_with_categories` and `featured_products` views.** A Postgres view normally runs with the *view author's* permissions, which means a view can quietly hand out rows the caller's own policies would have denied. `security_invoker=on` flips that: the view runs as **whoever is calling it**, so RLS on the underlying tables still applies. Both views had been flagged as errors by Supabase's own security advisor; both are clean now.
- **The `orders` owner-read policy was widened**, from matching on email alone to `(customer_email = auth.email() OR user_id = auth.uid())`. The app queries orders by `user_id`; the old policy only recognised the email. Widening it made order history work for accounts whose older rows predate the `user_id` column. Note the shape: it's a widening that *adds a second way to prove ownership*, not a loosening that lets anyone in.
- **`search_path` was pinned on every database function.** Without a pinned search path, a function resolves table names using whatever schema list the caller happens to have — which is a genuine privilege-escalation route in Postgres. Eleven functions were flagged; all eleven are pinned.
- **Execute permissions were revoked from `PUBLIC`, not just from `anon`.** This one is a trap worth remembering: Postgres grants `EXECUTE` on new functions to the pseudo-role `PUBLIC` by default, and `PUBLIC` includes everyone. Revoking from `anon` alone therefore changes nothing at all — the grant is still there, one level up. You must revoke from `PUBLIC`.

And one deliberate non-change, which is the interesting case. `get_order_stats` is called from a browser — the website's admin dashboard uses it in a `"use client"` hook — so it can't simply be locked away from the `authenticated` role. Instead the check moved *inside* the function: it now calls `is_admin()` itself and refuses anyone who isn't. **When a function must stay callable, gate it internally rather than pretending nobody will call it.** Meanwhile `is_admin()` and `get_my_role()` stay callable by everyone on purpose — RLS policies themselves call them while evaluating, so making them privileged would break every policy that depends on them.

### 5d. Navigation: expo-router

Routes come from the file tree ([§3](#3-a-guided-tour-of-the-folders)). Navigation itself is four calls.

**`router.push(...)`** — go forward, keeping the current screen underneath. A back gesture returns to it.
```tsx
router.push('/checkout');
router.push(`/product/${product.slug}`);
```

**`router.replace(...)`** — go forward, *replacing* the current screen. There's nothing to go back to.
```tsx
router.replace({ pathname: '/confirmation', params: { referenceId } });
```
This is right for the payment path: after paying, back-swiping into a checkout form that's already been charged would be terrible.

**`router.back()`** — pop one screen.

**`router.setParams(...)`** — change the current screen's params without navigating.

**Choosing between push and replace is a real decision, not a style preference.** The login screen contains the clearest example in the app:

**`app/(auth)/login.tsx`**
```tsx
function navigateAfterAuth() {
  if (next === '/checkout') {
    // checkout.tsx's own sign-in card pushed this screen (see next=/checkout
    // there), so the in-progress checkout instance — with whatever the
    // shopper had already typed — is directly beneath us. A replace() would
    // mount a brand-new checkout and lose all of that; going back to the
    // existing one re-triggers its [user, profile] backfill effect instead.
    router.back();
  } else if (isAllowedNext(next)) {
    router.replace(next as any);
  } else {
    router.back();
  }
}
```
And note the security posture above it:
```tsx
// Security: `next` is a caller-supplied route param — validate it against an
// allowlist rather than navigating to it blindly.
const NEXT_ALLOWLIST = ['/checkout'];
const CONFIRMATION_NEXT = /^\/confirmation\?referenceId=[A-Za-z0-9_-]{6,64}$/;

function isAllowedNext(next: string | undefined): next is string {
  return !!next && (NEXT_ALLOWLIST.includes(next) || CONFIRMATION_NEXT.test(next));
}
```
Any value that arrives from outside the app — a route param, a deep link, a push payload — is untrusted until checked. The regex arrived with the confirmation screen's sign-in route ([§5e](#5e-payments-end-to-end)) and is still an allowlist — it just describes a permitted *shape* instead of listing exact strings, because a fixed list can't express a query parameter.

**Params** are how screens receive values.

Sending, as an object:
```tsx
router.push({ pathname: '/(auth)/login', params: { next: '/checkout' } })
```
Receiving, with `useLocalSearchParams`:
```tsx
const { next } = useLocalSearchParams<{ next?: string }>();
const { referenceId } = useLocalSearchParams<{ referenceId: string }>();
const { slug } = useLocalSearchParams<{ slug: string }>();   // from [slug].tsx
```

One trap, documented in shop.tsx, that bites everyone once:
```tsx
// Lets callers (e.g. the Home "Deals on now" banner) deep-link straight
// into a sorted view. Shop stays mounted for the session as a tab screen,
// so a plain useState initializer would miss a param that arrives on an
// already-mounted instance — react to param changes explicitly instead,
// mirroring the account.tsx tab-param pattern.
```
Tab screens don't unmount. A param arriving at an already-mounted tab won't re-run a `useState` initialiser, so it has to be handled in a `useEffect` keyed on the param — and then consumed:
```tsx
useEffect(() => {
  const valid = SORT_OPTIONS.map((o) => o.value);
  if (sortParam && valid.includes(sortParam as SortOption)) {
    setSort(sortParam as SortOption);
    // Consume the param immediately so it doesn't re-apply after the
    // shopper has since picked a different sort manually.
    router.setParams({ sort: undefined });
  }
}, [sortParam]);
```

**Layouts and screen options.** `app/_layout.tsx` declares the stack and how each screen animates in:
```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
  <Stack.Screen name="(auth)" />
  <Stack.Screen
    name="checkout"
    options={{ headerShown: false, animation: 'slide_from_bottom' }}
  />
```
`headerShown: false` everywhere because every screen draws its own header — that's how the header can be a white floating surface with a custom `IconButton` in it.

The tab layout uses expo-router's *headless* tab primitives so the bar can be entirely custom:
```tsx
<Tabs>
  <TabSlot />
  <TabList style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 12, ... }}>
    <TabTrigger name="index" href="/" asChild>
      <TabButton iconOn="home" iconOff="home-outline" label="Home" />
    </TabTrigger>
```
`<TabSlot />` is where the active tab's screen renders. `asChild` means "don't render your own button, use mine." That's what buys the floating ink pill with a raised active circle — and it's custom code you now own.

**Deep links.** Your scheme is `litwaypicks`, set in `app.json`. A link like `litwaypicks://product/red-dress` opens the app directly to that product. Handling is in `app/_layout.tsx` and it is deliberately strict:

```tsx
// Defense in depth: only forward well-formed reference ids to the
// confirmation screen. This does not fix the underlying unauthenticated
// order-lookup endpoint (see wave1-security.md) but rejects obviously
// crafted/malformed values before they trigger a fetch.
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

function parseDeepLink(url: string): { pathname: string; params?: Record<string, string> } | null {
  const { path, queryParams } = Linking.parse(url);
  if (!path) return null;
  if (path.startsWith('product/')) return { pathname: `/${path}` };
  if (
    path === 'confirmation' &&
    typeof queryParams?.referenceId === 'string' &&
    REFERENCE_ID_PATTERN.test(queryParams.referenceId)
  ) {
    return { pathname: '/confirmation', params: { referenceId: queryParams.referenceId } };
  }
  if (path.startsWith('category/')) return { pathname: `/${path}` };
  return null;
}
```
An **allowlist**: three shapes are accepted, everything else returns `null` and is ignored. Push-notification destinations get the same treatment:
```tsx
// Prefixes a notification's `data.screen` must match before we'll navigate —
// a push payload is server/attacker-influenced, so route it like any other
// untrusted deep link rather than pushing it blindly.
const NOTIFICATION_SCREEN_ALLOWLIST = ['/product/', '/category/', '/confirmation', '/(tabs)'];
```

**Cold start ordering.** On launch, several things all want to navigate first. That race is resolved explicitly:
```tsx
Promise.all([
  supabase.auth.getSession(),
  onboarding.hasSeen(),
  Linking.getInitialURL(),
  getLastNotificationResponse(),
])
  .then(([{ data: { session } }, seenOnboarding, initialUrl, notifResponse]) => {
    hydrate(session);
    const initialDeepLink = initialUrl ? parseDeepLink(initialUrl) : null;
    if (initialDeepLink) {
      router.push(initialDeepLink as any);
    } else if (!seenOnboarding && !session) {
      router.replace('/onboarding' as any);
    }
    SplashScreen.hideAsync();
```
`Promise.all` waits for all four in parallel, then decides once. **Ruling: a deep link wins over onboarding.** Previously whichever promise happened to resolve first won, which is not a decision — it's a coin flip.

And the failure path matters just as much:
```tsx
.catch((err) => {
  // A storage or network hiccup here used to leave BrandSplash up
  // forever (Promise.all had no catch). Fail open instead: treat the
  // shopper as signed-out with onboarding already seen so a transient
  // error never traps a returning user on the intro screen.
  console.warn('Startup hydration failed, continuing as signed-out:', err);
  hydrate(null);
  SplashScreen.hideAsync();
```
**Fail open.** A storage hiccup must never leave a customer staring at a splash screen forever.

### 5e. Payments, end to end

This is the part where mistakes cost real money. Follow it all the way through.

**Read this first: an account is now required to place an order.** Browsing, adding to the cart and filling in the whole delivery form all still work signed out. But the moment a shopper tries to move to the payment step, the app asks them to sign in. This is a reversal of an earlier decision, it has a name in the session records — "Option A" — and [§7](#7-decisions-and-tradeoffs) argues both sides of it. The short version: your payment API now requires the authenticated order owner on every call, so a signed-out order can't succeed. Letting someone type an address, press Pay, and *then* fail with a 401 would be the worst possible version of this.

#### Step 1 — Cart to checkout

`router.push('/checkout')` from the cart. Still no login wall here — the wall would make the whole form unreachable for guests, and the form is where the sign-in ask is placed so nothing typed gets lost.

#### Step 2 — Delivery details, and the sign-in gate

`checkout.tsx` is a two-step form driven by one piece of state, `const [step, setStep] = useState<Step>(1)`. Step 1 collects contact and address. Signed-out shoppers see a card at the top of it, and the copy is chosen with some care:

**`app/checkout.tsx`**
```tsx
{/* The payment API requires the authenticated order owner, so an
    account is required to place an order. Framed as what it buys
    the customer (tracking), not as a registration demand — and
    with email confirmation off, signup is one tap. Delivery
    fields stay editable signed-out so nothing typed is lost;
    only the step-2 transition is gated (see validateDelivery). */}
{!user ? (
```
```tsx
<Text style={{ fontSize: 13, fontWeight: '800', color: color.ink }}>Sign in to place your order</Text>
<Text style={{ fontSize: 12, color: color.inkMuted, marginTop: 1 }}>Takes seconds — and lets you track this order</Text>
```
"Lets you track this order" is the whole argument for the requirement, made to the person who has to comply with it. Compare it to "You must create an account to continue", which says the same thing and sells nothing.

The gate itself is the first check in `validateDelivery`, which runs on the Continue button:

**`app/checkout.tsx`**
```tsx
function validateDelivery(): boolean {
  // The payment API rejects unauthenticated calls (401), so don't let a
  // signed-out user reach the payment step and fail there. Everything
  // they've typed survives the round-trip (next=/checkout returns here).
  if (!user) {
    Alert.alert(
      'Sign in to continue',
      'Create your account or sign in to place this order — it takes seconds, and your details here are saved.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Sign in',
          onPress: () => router.push({ pathname: '/(auth)/login', params: { next: '/checkout' } }),
        },
      ]
    );
    return false;
  }
  if (!form.firstName || !form.email || !form.phone || !form.address || !form.county) {
    Alert.alert('Missing fields', 'Please fill in all required delivery information.');
    return false;
  }
  if (!/\S+@\S+\.\S+/.test(form.email)) {
    Alert.alert('Invalid email', 'Please enter a valid email address.');
    return false;
  }
  if (!isValidLiberianMobile(form.phone)) {
    Alert.alert('Invalid phone number', 'Enter a valid Liberian mobile number, e.g. 0888 640 502.');
    return false;
  }
  return true;
}
```

If the shopper signs in mid-checkout, their saved details are backfilled — without overwriting anything they've already typed:
```tsx
useEffect(() => {
  if (!user && !profile) return;
  setForm((s) => ({
    ...s,
    firstName: s.firstName || profile?.first_name || '',
    ...
  }));
}, [user, profile]);
```
`s.firstName || profile?.first_name || ''` reads as "what they typed, else their saved value, else empty."

That effect is why `next: '/checkout'` and `router.back()` matter so much ([§5d](#5d-navigation-expo-router)). The shopper types half a form, taps Sign In, signs in, and comes *back to the same screen instance* — with everything still typed, and their saved address now filled into the fields they left blank. If login had used `replace` instead, they'd land on a brand-new empty checkout and have to start over. That's the difference between a gate and a wall.

There's a second check, and the reason it exists is worth internalising:

**`app/checkout.tsx`**
```tsx
// Session may have expired since step 1 — the API would 401. Re-check
// fresh state (not the render-time snapshot) before charging anyone.
if (!useAuthStore.getState().user) {
  Alert.alert('Signed out', 'Your session ended. Please sign in again to place the order.', [
    { text: 'Cancel', style: 'cancel', onPress: () => setStep(1) },
    {
      text: 'Sign in',
      onPress: () => router.push({ pathname: '/(auth)/login', params: { next: '/checkout' } }),
    },
  ]);
  return;
}
```
Note `useAuthStore.getState().user` rather than the `user` variable from the top of the component. The component's `user` is a snapshot from whenever it last rendered; a token can expire between filling in the form and pressing Pay. `getState()` reads the store *right now*. **Before anything irreversible, re-read the state you're betting on rather than trusting a render-time copy.**

#### Step 3 — Re-validate prices and stock, *before* charging

The most important 40 lines in the app:

**`app/checkout.tsx`**
```tsx
// Re-validate price & stock against the live catalog before charging —
// the cart persists locally and may hold stale prices or sold-out items.
const ids = [...new Set(items.map((i) => i.productId))];
const { data: fresh, error: freshError } = await supabase
  .from('products_with_categories')
  .select('id, price, sale_price, stock')
  .in('id', ids);
if (freshError) throw freshError;
```
The cart survives on the device for days. A price could have moved; an item could be sold out. So every line is re-checked against the live catalog, and if anything changed, **nothing is charged**:
```tsx
if (stockIssues.length > 0 || priceChanges.length > 0) {
  reconcile(updates);
  const parts: string[] = [];
  if (stockIssues.length) parts.push('Availability changed:\n• ' + stockIssues.join('\n• '));
  if (priceChanges.length) parts.push('Prices were updated for:\n• ' + priceChanges.join('\n• '));
  setPaymentStatus('idle');
  setStep(1);
  Alert.alert(
    'Please review your cart',
    parts.join('\n\n') + '\n\nYour cart has been updated to current prices and stock. Please review, then try again.'
  );
  return;
}
```
Nobody pays a stale price and nobody buys a sold-out item.

#### Step 4 — Send the order

```tsx
// SECURITY (backend handoff): `price` here is client-held and only
// reconciled against the catalog for UI purposes above — the server
// must re-price every line item (and the total) from its own product
// data rather than trusting this payload. Not fixable client-side.
items: items.map((i) => ({
  id: i.productId,
  name: i.name,
  price: i.price,
  quantity: i.quantity,
  size: i.size,
  color: i.color,
  slug: i.slug,
  imageUrl: i.imageUrl,
})),
```

**Why the backend must be authoritative on price.** The re-validation above protects an *honest* app from showing a stale price. It does nothing against a modified client or someone calling the endpoint directly with `price: 0.01`. The only defence that works is the server recomputing every line from its own catalog and ignoring the client's numbers entirely.

**That defence now exists.** `/api/momo/pay` on litwaypicks.com re-prices every line from its own `products` rows — `sale_price ?? price`, its own stock check, its own total — and charges *that* number, not the one in this payload. So the comment above is now describing a handoff that was completed rather than one that's outstanding; leave the comment where it is (the client-held price is still not to be trusted, and the next person to read this file should know that), but see [§8](#8-what-still-needs-the-backend-or-the-dashboard) for what's actually still open. There's also a server-side guard that marks an order `DISPUTED` if the amount MTN reports doesn't match the amount the server computed — belt and braces on the one number that matters.

Then the call itself:
```tsx
const { referenceId: ref } = await momoAPI.initiatePayment(payload);
// Persist the moment we have a referenceId — see lib/storage.ts
// pendingPayment for why (recoverable if the app is killed mid-poll).
void pendingPayment.save({ referenceId: ref, createdAt: Date.now() });
setReferenceId(ref);
setPaymentStatus('polling');
```

`momoAPI` is thin on purpose:

**`lib/api.ts`**
```ts
// www is canonical — the naked domain 307-redirects there; going direct
// avoids a redirect round-trip on every payment call.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.litwaypicks.com';

/**
 * All /api/momo/* endpoints require the authenticated order owner (verified
 * server-side against user_id / legacy customer_email, or admin). The mobile
 * app has no cookies, so it authenticates with the Supabase access token as
 * a Bearer header — see the web repo's lib/session.js getServerUser().
 */
/** Error carrying the HTTP status so callers can distinguish auth failures
 *  (401/403 — sign in / wrong account) from transient network trouble. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const momoAPI = {
  async initiatePayment(payload: object) {
    const res = await fetch(`${BASE_URL}/api/momo/pay`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? (err as any).message ?? 'Payment initiation failed');
    }
    return res.json() as Promise<{ referenceId: string; externalId: string }>;
  },
```
**The app never talks to MTN and never holds a payment secret.** Your server does that. Keep it that way. (`EXPO_PUBLIC_` is the prefix Expo requires for env vars that are baked into the JavaScript bundle. That also means anything with that prefix is *public* — it ships inside the app and can be read out of it. Never put a secret behind it.)

Three newer things in that file are worth pulling out.

**`www` in the base URL is not cosmetic.** The naked `litwaypicks.com` answers with a 307 redirect to `www`. A redirect on every payment call is a wasted round-trip on a phone that may be on 3G, and redirects are exactly where headers get dropped by intermediaries. Point at the canonical host.

**`authHeaders()` is how the app proves who it is.** A **Bearer token** is simply a credential you present by putting it in a request header: `Authorization: Bearer <the token>`. Whoever bears it is treated as its owner — which is why it's the same thing as the session, and why [§5c](#5c-server-data-supabase--react-query) makes such a fuss about where that session is stored. The website authenticates with cookies, which a browser attaches automatically. This app has no cookies, so it attaches the Supabase **access token** by hand, on every call. Note `?? {}` — if there's no session, no header is sent at all, and the server answers 401 rather than the app pretending.

The matching half lives in the web repository (`lib/session.js`, read-only from here):

**`lib/session.js` (the web repo — do not edit it from this project)**
```js
/**
 * Returns the authenticated user's full profile from the `users` table,
 * or null if the request is not authenticated.
 *
 * Two transports, checked in order:
 * 1. `Authorization: Bearer <jwt>` — used by the mobile app, which has no
 *    cookies. The token is validated against Supabase's auth server via
 *    getUser(token), and the same token is attached to the PostgREST client
 *    so RLS evaluates as that user.
 * 2. @supabase/ssr cookies — the web app's normal session.
 *
 * Both paths use getUser() (never getSession()) so the JWT is always
 * validated server-side — prevents privilege escalation via tampered
 * cookies or forged tokens.
 */
```
Two details in there are the difference between a real check and a decorative one. `getUser(token)` asks Supabase's auth server whether the token is genuine, rather than just decoding it and believing what it says. And the same token is then handed to the database client, so the customer's own RLS policies apply to everything that request reads — the server doesn't get to see more than the customer would. An invalid or expired Bearer deliberately *falls through* to the cookie path instead of failing the request outright, so a browser that happens to carry a stray `Authorization` header still works.

**`ApiError` carries the HTTP status.** A plain `Error` only carries a message, and by the time it reaches a screen, "Order fetch failed" can't be distinguished from "you're not signed in". Attaching `status` lets the confirmation screen treat 401/403 completely differently from a flaky connection — see Step 8.

> **One live dependency you need to know about.** The Bearer support on the website is written and reviewed, on the branch `mobile-bearer-auth` (commits `2bc834c` and `427afa5`, [web PR #27](https://github.com/LitwaysPicks/litwaypickss-eccomerce/pull/27)) — but **it has not been merged and deployed**. Until it is, production still only understands cookies, and every payment call from the app comes back **401**. That's not a bug in this repository and no amount of mobile work will fix it. Deploy the web change.

#### Step 5 — Watch for the outcome, three ways at once

Setting `referenceId` triggers this effect, and it's the most intricate one in the app:

```tsx
useEffect(() => {
  if (!referenceId) return;

  let resolved = false;
  ...
  // Single settle path shared by the realtime subscription, the polling
  // fallback, and the app-foreground re-check — runs at most once.
  function finalize(rawStatus: string) {
    if (resolved) return;
    const status = (rawStatus ?? '').toUpperCase();
    if (status === 'SUCCESSFUL' || status === 'COMPLETED') {
      resolved = true;
      cleanup();
      clearCart();
      void pendingPayment.clear();
      setPaymentStatus('success');
      router.replace({ pathname: '/confirmation', params: { referenceId } });
    } else if (status === 'FAILED' || status === 'DISPUTED') {
      resolved = true;
      cleanup();
      void pendingPayment.clear();
      setPaymentStatus('failed');
      showPaymentAlert('Payment failed', 'Your payment was declined.');
    }
  }
```
The `resolved` flag is the point: three independent listeners can all report, and only the first one is allowed to act.

**Listener 1 — realtime.** A live socket to the database, listening for both INSERT and UPDATE:
```tsx
const channel = supabase
  .channel(`checkout-order-${referenceId}`)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders', filter: `external_id=eq.${referenceId}` },
    (payload) => finalize((payload.new as any).payment_status ?? '')
  )
  .on(
    // The backend's payment webhook could resolve fast enough to INSERT
    // the order row already in a terminal payment_status rather than
    // INSERT-then-later-UPDATE — listen for both so realtime confirmation
    // doesn't silently depend on the 6s poll fallback for that ordering.
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders', filter: `external_id=eq.${referenceId}` },
    (payload) => finalize((payload.new as any).payment_status ?? '')
  )
  .subscribe();
```

**Listener 2 — a poll every 6 seconds**, in case the socket drops:
```tsx
const pollId = setInterval(() => {
  momoAPI.checkStatus(referenceId).then((r) => finalize(r.status)).catch(() => {});
}, 6000);
```

**Listener 3 — a re-check whenever the app returns to the foreground**, because approving a MoMo prompt means leaving your app:
```tsx
const appStateSub = AppState.addEventListener('change', (s) => {
  if (s === 'active') {
    momoAPI.checkStatus(referenceId).then((r) => finalize(r.status)).catch(() => {});
  }
});
```

All three are torn down together, and there's a hard stop:
```tsx
function cleanup() {
  channel.unsubscribe();
  clearInterval(pollId);
  appStateSub.remove();
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
}

timeoutRef.current = setTimeout(() => {
  if (resolved) return;
  cleanup();
  setPaymentStatus('failed');
  showPaymentAlert('Payment timeout', 'Payment confirmation timed out.');
}, PAYMENT_TIMEOUT_MS);

return () => cleanup();
```
After 5 minutes the app stops guessing and says so — with a "Check status" action rather than a dead end:
```tsx
// Placing an order requires a session (handlePlaceOrder gates on it), so
// by the time a referenceId exists the shopper always has an account and
// an order history to point at. The "Check status" action goes straight
// to confirmation.tsx, which knows how to poll/refresh a still-pending
// order (see its "Check again" affordance).
function showPaymentAlert(title: string, base: string) {
  Alert.alert(
    title,
    `${base} Check your order history for the latest status.`,
```
**This used to be a ternary with a second branch for guests** — "your reference is …, keep it and check your email" — because a guest had no order history to be pointed at. Accounts-required made that branch unreachable, and unreachable branches rot: nobody tests them, and eventually someone reads one and believes it. It was deleted, and the comment explaining *why* one branch is now enough took its place. **When a decision removes a case, remove the code for that case and leave a note saying the case is gone.**

#### Step 6 — Don't let the shopper wander off mid-payment

```tsx
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    if (!isProcessing) return;
    e.preventDefault();
    Alert.alert(
      'Payment in progress',
      'Leaving now can abandon it. Are you sure you want to leave?',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave anyway', style: 'destructive', onPress: () => { navigation.dispatch(e.data.action); } },
      ]
    );
  });
  return unsubscribe;
}, [navigation, isProcessing]);
```
Disabling the header's own back button isn't enough — Android's hardware back and iOS's swipe-back bypass it entirely. `beforeRemove` intercepts navigation at the router level, whatever triggered it.

#### Step 7 — Pending-payment recovery: the double-charge fix

If the OS kills the app mid-poll, the reference id lived only in memory and would be gone — while the cart is still full, because the cart is only cleared on *confirmed* success. The customer's natural next move is to pay again.

So it's written to disk the instant it exists:

**`lib/storage.ts`**
```ts
// Tracks a MoMo payment from the moment initiatePayment() returns a
// referenceId until a terminal outcome is known. checkout.tsx's realtime
// subscription + polling only track this in memory, so if the OS kills the
// app mid-poll the reference would otherwise be lost — the cart is never
// cleared until a terminal state is reached, so the shopper could end up
// re-attempting (and being double-charged for) a payment that already went
// through.
export const pendingPayment = { save, get, clear };
```

And offered back on the next cold start:

**`app/_layout.tsx`**
```tsx
Alert.alert(
  'Payment in progress',
  "You have a payment in progress — check its status?",
  [
    // Not a decline — the record stays. TTL (PENDING_PAYMENT_MAX_AGE_MS,
    // checked above) is what eventually stops re-prompting, not this tap;
    // clearing it here would drop the one payment still worth recovering.
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Check status',
      onPress: () => {
        router.push({ pathname: '/confirmation', params: { referenceId: record.referenceId } } as any);
      },
    },
  ]
);
```
Only a 30-minute expiry deletes the record, and the prompt is deliberately deferred until the splash has actually faded so a native alert never fires underneath it.

#### Step 8 — Confirmation, honestly

`app/confirmation.tsx` used to say "Thank You! Your Order is Confirmed" the moment it opened, regardless of what the payment did. Now the hero is a function of what's actually known:

```tsx
type Outcome = 'checking' | 'confirmed' | 'pending' | 'failed' | 'unreachable' | 'signin';
```
```tsx
// Gates the hero on what we actually know — never declares success before
// it's known. "checking" while the fetch is in flight, "unreachable" if it
// never resolved after retries, otherwise one of the three payment_status
// outcomes checkout.tsx's finalize() would also recognize.
const outcome: Outcome = loading
  ? 'checking'
  : authRequired
  ? 'signin'
  : !order
  ? 'unreachable'
  : isTerminalSuccess(order.payment_status)
  ? 'confirmed'
  : isTerminalFailure(order.payment_status)
  ? 'failed'
  : 'pending';
```

**The sixth outcome, `'signin'`, is new**, and it exists because the order endpoint now requires the owning account. Getting there is worth reading in full, because it's a small masterclass in handling an error you *can't* retry your way out of:

**`app/confirmation.tsx`**
```tsx
// 401/403: the order endpoint requires the owning account — retrying
// won't help; route the user to sign in instead (the pending-payment
// record deliberately stays so it can be reconciled after sign-in).
if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
  authFailedUserRef.current = useAuthStore.getState().user?.id ?? null;
  setAuthRequired(true);
  setLoading(false);
  return;
}
if (attempt < ORDER_FETCH_MAX_ATTEMPTS) {
  setTimeout(() => {
    if (!cancelled) fetchOrder(attempt + 1);
  }, ORDER_FETCH_RETRY_DELAY_MS);
} else {
  setLoading(false);
}
```
**Two error families, two behaviours.** A network wobble deserves three tries a second and a half apart. A 401 or 403 deserves *none* — the server has already told you the answer, and asking again with the same credentials gets the same answer, forever. That's what `ApiError.status` bought.

The hero it produces is a locked one, and it offers the only action that can actually help:
```tsx
<Ionicons name="lock-closed-outline" size={40} color={color.accent} />
```
```tsx
<Text style={{ fontSize: 20, fontFamily: font.displayHeavy, color: color.ink, textAlign: 'center' }}>
  Sign in to see this order
</Text>
<Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
  Sign in with the account that placed this order and we'll pull up its status.
</Text>
<Button
  title="Sign In"
  size="sm"
  onPress={() =>
    router.push({
      pathname: '/(auth)/login',
      params: { next: `/confirmation?referenceId=${referenceId}` },
    })
  }
```
Note the copy: "**the account that placed this order**", not "your account". A 403 usually means *signed in as the wrong person*, and telling someone to sign in when they already are is maddening.

That `next` value carries a query string, which the login screen's plain allowlist couldn't express — so it grew a second, pattern-based rule beside it:

**`app/(auth)/login.tsx`**
```tsx
const NEXT_ALLOWLIST = ['/checkout'];
const CONFIRMATION_NEXT = /^\/confirmation\?referenceId=[A-Za-z0-9_-]{6,64}$/;

function isAllowedNext(next: string | undefined): next is string {
  return !!next && (NEXT_ALLOWLIST.includes(next) || CONFIRMATION_NEXT.test(next));
}
```
The regex is anchored at both ends (`^` … `$`) and permits only the characters a reference id can contain. It is still an allowlist — it just describes a *shape* rather than listing exact strings. House rule 9 ([§11](#11-house-rules-for-this-codebase)) survives intact. (`next is string` is a TypeScript **type predicate**: a function that, when it returns true, also tells the compiler the argument definitely isn't `undefined`.)

**Now the subtle part, and it was found in review.** After signing in, the screen should retry by itself rather than making the customer press a button. The naive version — "if there's a user and auth was required, refetch" — loops forever when the answer is 403: refetch → 403 → still a user → refetch → 403 …, hammering the server and spinning the UI. The fix is to remember *which identity* the failure happened under, and only retry when that identity has actually changed:

**`app/confirmation.tsx`**
```tsx
// Which identity (user id, or null for signed-out) the 401/403 happened
// under. The auto-refetch below only fires when the identity has actually
// CHANGED since then — a 403 means "wrong account", and auto-retrying as
// the same account would loop 403→refetch→403 forever.
const authFailedUserRef = useRef<string | null | undefined>(undefined);

// After the user signs in (next=/confirmation returns here) or switches
// accounts, re-run the fetch instead of leaving the sign-in hero up until
// a manual retry.
useEffect(() => {
  if (user && authRequired && user.id !== authFailedUserRef.current) {
    setRetryToken((t) => t + 1);
  }
}, [user, authRequired]);
```
**Never auto-retry a 403 without an identity change** is now a house rule. The general form: an automatic retry needs a reason to believe the *inputs* have changed. Retrying the identical request with the identical credentials isn't resilience, it's a loop with extra steps.

(`retryToken` is a counter in a dependency array — bumping it re-runs the fetch effect. It's the standard way to say "run that again" to an effect keyed on something that hasn't otherwise changed.)

And the success/failure vocabulary is defined once and shared with checkout, so the two screens can never disagree:
```tsx
// Same terminal-status predicate checkout.tsx's finalize() uses to decide the
// payment succeeded — reused here so this screen never calls a payment
// "confirmed" (or clears the cart) on a status checkout.tsx wouldn't also
// treat as success.
function isTerminalSuccess(rawStatus: string | undefined | null): boolean {
  const status = (rawStatus ?? '').toUpperCase();
  return status === 'SUCCESSFUL' || status === 'COMPLETED';
}
```

The recovery loop closes here — and the guard on it is subtle:
```tsx
async function reconcilePendingPayment(referenceId: string, data: any) {
  const stored = await pendingPayment.get();
  if (stored?.referenceId !== referenceId) return;
  const terminalSuccess = isTerminalSuccess(data?.payment_status);
  const terminalFailure = isTerminalFailure(data?.payment_status);
  if (terminalSuccess) {
    useCartStore.getState().clearCart();
  }
  if (terminalSuccess || terminalFailure) {
    await pendingPayment.clear();
  }
}
```
A **pending** result must leave the record alone. Clearing it there would drop the lifeline of a payment that's genuinely still in flight, re-opening the exact double-charge loop the mechanism exists to close. And the record is only touched when the reference *matches* — checking someone else's reference can't clear yours.

The pending state also keeps its promise. It says "we'll keep checking automatically", so it does — a bounded poll, roughly two minutes, that swaps the hero only on a changed result:
```tsx
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 24; // ~2 minutes
```

#### Why the app doesn't show a final total

The app cannot know the delivery fee, so it refuses to invent one:
```tsx
{/* We can't compute delivery fees client-side — the MoMo USSD
    prompt on the shopper's phone is the authoritative total.
    (Backend handoff: a pre-payment quote endpoint would let us
    show the true total here instead.) */}
<Text style={{ ... }}>
  Your final total, including any delivery fee, is shown in the MoMo prompt on your phone.
</Text>
```
The cart shows no shipping row, checkout labels its figure **Subtotal**, and the MoMo prompt on the customer's own phone is stated as authoritative. This is honest but it costs conversions, which is why a quote endpoint is the single best backend improvement available ([§8](#8-what-still-needs-the-backend-or-the-dashboard), item 6).

---

## 6. The animation layer

### What Reanimated is, and why it isn't just `setState` in a loop

Your app has two threads. The **JavaScript thread** runs your code — components, handlers, network. The **UI thread** draws frames, 60 or 120 times a second.

If you animated by calling `setState` sixty times a second, every frame would need a round trip to the JS thread. The moment that thread is busy — parsing a network response, rendering a list — frames get skipped and the animation stutters. On a mid-range Android phone, that's most of the time.

**Reanimated moves animations onto the UI thread.** You define the animation once; it then runs natively, at full frame rate, even while the JS thread is completely blocked.

Its three concepts, all visible in `PressableScale` — the wrapper behind nearly every tappable thing in the app:

**`components/ui/PressableScale.tsx`**
```tsx
export function PressableScale({ scale = 0.96, haptic = false, onPress, children, style, ...rest }: Props) {
  const pressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? scale : 1, { damping: 15, stiffness: 200, reduceMotion: ReduceMotion.System }) }],
  }));

  function handleHaptic() {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressed.value = true;
        if (haptic) runOnJS(handleHaptic)();
      }}
      onPressOut={() => {
        pressed.value = false;
      }}
      onPress={onPress}
      style={[animatedStyle, style as any]}
      {...rest}
    >
```

1. **`useSharedValue`** — a value both threads can see. Not state: changing it does **not** re-render.
2. **`useAnimatedStyle`** — a function that turns shared values into a style. It runs *on the UI thread*, every frame.
3. **`withSpring` / `withTiming`** — how to get from here to there. Springs have physics (damping, stiffness) and feel organic; timings have a duration and an easing curve.

Plus `runOnJS`, which you need whenever UI-thread code has to call something on the JS side (haptics, `setState`).

And `Animated.createAnimatedComponent(Pressable)` — you can only animate an *animated* component. That's why you see this line in several files:
```tsx
const AnimatedPath = Animated.createAnimatedComponent(Path);
```

### Reduced motion is not optional here

Every animation in the app passes `reduceMotion: ReduceMotion.System`. That reads the phone's accessibility setting and, when "reduce motion" is on, jumps straight to the finished state instead of animating. Fourteen files carry it. **New animations must too** — it's a house rule, not a nicety.

### The motion inventory

Motion is deliberately limited to a small set of named moments:

- **`PressableScale`** — press feedback on essentially every tappable surface, with optional light haptic.
- **`components/motion/BrandLoader.tsx`** — the loading state. The logo bag bobs gently while its speed lines streak past: "your stuff is moving." Replaces generic spinners at confirmation, reset-link verification, and infinite-scroll footers.
- **`components/motion/LoadingOverlay.tsx`** — `BrandLoader` promoted to a full-screen, interaction-blocking moment with a title and subtitle. Used at exactly two points in the app; see "[Full-screen loading, and why only twice](#full-screen-loading-and-why-only-twice)" below.
- **`components/motion/FlyToCart.tsx`** — an orange bag chip arcs from the pressed Add-to-Cart button into the Cart tab.
- **`components/motion/DrawnCheckmark.tsx`** — a checkmark that draws itself via stroke-dash reveal, on the confirmation.
- **`components/motion/IdleFloat.tsx`** — a slow ambient bob for illustrations and empty states.
- **`components/brand/Marquee.tsx`** — the endlessly scrolling promise strip; renders content twice and translates one copy-width per loop so the wrap is seamless.
- **`components/brand/RotatingBadge.tsx`** — circular text orbiting a centre arrow.
- **`components/navigation/TabBar.tsx`** — the active tab's ink circle rising out of the bar with a slight overshoot, and the cart badge popping on count change.
- Product-gallery parallax and Home's staggered entrance, in their respective screens.

**`FlyToCart` is worth reading as a pattern.** It's a module-level trigger plus a single overlay mounted once at the app root:
```tsx
type Listener = (x: number, y: number) => void;
let listener: Listener | null = null;

export function flyToCart(startX: number, startY: number) {
  listener?.(startX, startY);
}
```
Any screen can call `flyToCart(x, y)`. Product detail does it with the actual touch coordinates:
```tsx
if (e?.nativeEvent) {
  flyToCart(e.nativeEvent.pageX, e.nativeEvent.pageY);
}
```
The flight path is a quadratic bezier computed each frame on the UI thread:
```tsx
// Quadratic bezier: control point above the straight midpoint for an arc.
const cx = (sx + target.x) / 2;
const cy = Math.min(sy, target.y) - 130;
const p = progress.value;
const inv = 1 - p;
const x = inv * inv * sx + 2 * inv * p * cx + p * p * target.x;
const y = inv * inv * sy + 2 * inv * p * cy + p * p * target.y;
```
And the landing point is *computed from the tab bar's known geometry*, not measured:
```tsx
function cartTabCenter(insetsBottom: number) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const cellW = (SW - 32 - 12) / 4;
  return {
    x: 16 + 6 + cellW * 2.5,
    y: SH - (insetsBottom + 12) - TAB_BAR_HEIGHT / 2,
  };
}
```
**Note the coupling.** Those constants mirror `app/(tabs)/_layout.tsx` (`left: 16, right: 16, paddingHorizontal: 6`, four cells, Cart third). Change the tab bar's geometry and this must change with it. It's the price of not measuring; the comment in the file says so explicitly.

Also note: the chip is *pure decoration*. It never touches cart state, so it cannot cause a cart bug.

### Full-screen loading, and why only twice

There is a tempting mistake here that's worth naming, because it looks like polish and behaves like damage: **putting a beautiful full-screen loader on everything.**

A full-screen loader has one real cost — it *removes the app*. While it's up, the customer can't scroll, can't read, can't go back, can't do anything but wait and watch. That's fine when there's genuinely nothing else to do. It's actively worse than nothing when there was: a takeover on the Home screen makes the app feel **slower**, because content that would have appeared piecemeal now appears all at once, later, after a wait the customer was forced to watch.

So the rule in this codebase is:

> **Skeletons for browsing. Full-screen loaders only for blocking moments.** A blocking moment is one where the customer genuinely cannot proceed, and where guessing what's happening would be worse than being told.

That gives exactly two moments in the whole app. Everything else — Home, Shop, product detail, orders — uses `SkeletonLoader` and keeps the app on screen.

The component itself is deliberately plain:

**`components/motion/LoadingOverlay.tsx`**
```tsx
/**
 * Full-screen branded loading moment — a solid-color overlay with the
 * BrandLoader centered above a title/subtitle. For meaningful waits where
 * inline feedback isn't enough (e.g. post-sign-in hydration, payment
 * processing): blocks interaction while visible, disappears entirely
 * (unmounts) once hidden. Fades honor reduced motion via ReduceMotion.System,
 * same as BrandLoader itself.
 */
export function LoadingOverlay({
  visible,
  title,
  subtitle,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
}) {
  if (!visible) return null;
```
`if (!visible) return null` is the important line. The overlay doesn't hide itself with an opacity of 0 — it stops existing, so it can't swallow taps it isn't entitled to. And it carries two accessibility props that a decorative view wouldn't: `accessibilityViewIsModal` (tells a screen reader that everything behind this is unavailable, matching what sighted users see) and `accessibilityLiveRegion="polite"` (announces the title when it appears, so a blind customer learns a wait has started).

**Moment 1 — the sign-in hydration.** Signing in kicks off four fetches at once: profile, cart, wishlist, push token. Until they land, the app would show a stale, empty-looking version of itself. The overlay covers it — but only for a *genuine* sign-in:

**`app/_layout.tsx`**
```tsx
// A genuine sign-in: the known user id actually changed (not a
// token refresh for the same user), and it's happening after the
// splash has already resolved (the cold-start session restore is
// covered by BrandSplash, not this overlay).
const isGenuineSignIn = previousUserIdRef.current !== userId && !showSplashRef.current;
previousUserIdRef.current = userId;
```
Two guards, two different false positives they prevent. Supabase fires the same auth-change event when it silently refreshes an expiring token — several times a day, in the background — and without `previousUserIdRef` the customer would get a mystery takeover mid-scroll. And on a cold start with a saved session, `BrandSplash` is already covering the screen; without `showSplashRef` the customer would watch one full-screen loader hand off to another.

(`showSplashRef` exists for a mechanical reason worth knowing: `hydrate()` lives inside a mount-once `useEffect`, so the `showSplash` *variable* it captured is frozen at its first value forever. A ref is a stable box whose contents can be updated from outside — mirroring live state into it is the standard way for long-lived closures to read fresh values.)

Then the overlay is raised, capped, and lowered:
```tsx
if (isGenuineSignIn) {
  setPostAuthHydrating(true);
  if (hydrationCapTimerRef.current) clearTimeout(hydrationCapTimerRef.current);
  hydrationCapTimerRef.current = setTimeout(() => {
    hydrationCapTimerRef.current = null;
    setPostAuthHydrating(false);
  }, POST_AUTH_HYDRATION_MAX_MS);
  Promise.allSettled([profilePromise, cartPromise, wishlistPromise, pushTokenPromise]).then(() => {
    if (hydrationCapTimerRef.current) {
      clearTimeout(hydrationCapTimerRef.current);
      hydrationCapTimerRef.current = null;
    }
    setPostAuthHydrating(false);
  });
}
```
Two safety devices in eleven lines.

**`Promise.allSettled`, not `Promise.all`.** `Promise.all` rejects the instant *any* of its promises rejects. Here that would mean a failed wishlist fetch leaving the overlay up permanently, since the `.then` would never run. `allSettled` waits for all four to finish *however* they finish — resolved or rejected — and always continues. When you're waiting on things only so you can stop waiting, `allSettled` is almost always the one you want.

**And a hard cap regardless:**
```tsx
// Hard cap on the post-sign-in hydration overlay (Moment 1 below) — clears
// even if fetchProfile/loadFromDb/loadWishlistFromDb/syncPushTokenForUser
// hang, so a slow network never traps the shopper behind the overlay.
const POST_AUTH_HYDRATION_MAX_MS = 2500;
```
A promise that neither resolves nor rejects — a request hanging on a dead connection — defeats even `allSettled`. Two and a half seconds later the overlay comes down anyway and the customer gets an app that's slightly behind rather than an app that's gone. This is the same **fail open** instinct as the startup path in [§5d](#5d-navigation-expo-router), and it belongs on every blocking UI you ever write: *what raises this must have something that lowers it unconditionally.*

**Moment 2 — the payment.** Two overlays, because the two halves of a MoMo payment need to say completely different things:

**`app/checkout.tsx`**
```tsx
<LoadingOverlay
  visible={paymentStatus === 'processing'}
  title="Contacting MTN MoMo…"
  subtitle="Setting up your payment — this takes a moment."
/>
<LoadingOverlay
  visible={paymentStatus === 'polling'}
  title="Check your phone"
  subtitle={`Approve the MoMo prompt sent to ${form.phone || 'your phone'}. We'll confirm automatically.`}
/>
```
`processing` is "we're talking to MTN, sit tight". `polling` is an **instruction**: a USSD prompt has been sent to that handset and nothing further happens until the customer approves it. Echoing back the actual number is what turns a spinner into a piece of information. A generic "Loading…" here would be the difference between a completed sale and a customer waiting for the app to do something the app cannot do.

Note what *isn't* covered: `paymentStatus === 'failed'` has no overlay. A failure needs the failure message, the retry button and the cart all visible and reachable — the exact opposite of a takeover. And the `beforeRemove` guard from [§5e](#5e-payments-end-to-end) is unchanged and still necessary: the overlay blocks taps, but not Android's hardware back button or iOS's back-swipe.

### The splash choreography

`components/BrandSplash.tsx` is the most elaborate piece of motion in the app, and it contains zero image assets. The header comment is the storyboard:

```tsx
/**
 * Choreographed brand splash — the logo assembles itself:
 *   1. the bag drops in and lands with a squash-and-settle
 *   2. its speed lines streak in one after another
 *   3. the "L" draws itself on via stroke reveal
 *   4. the wordmark and tagline rise in
 * Then it holds until the app is ready and fades out. Mirrors the native
 * splash (orange ground, white mark) so the handoff reads as one screen.
 * All motion collapses to the finished frame under reduced motion.
 */
```

The timing is all in one effect:
```tsx
useEffect(() => {
  bagDrop.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 150, reduceMotion: RM }));
  squash.value = withDelay(
    300,
    withSequence(
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: RM }),
      withSpring(0, { damping: 9, stiffness: 210, reduceMotion: RM })
    )
  );
  lOffset.value = withDelay(
    680,
    withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: RM })
  );
}, [bagDrop, squash, lOffset]);
```
`withDelay` staggers; `withSequence` chains. The squash is faked, and the comment says how, because React Native scales from the centre:
```tsx
// squash-and-settle on landing; slight downward shift fakes a
// bottom-anchored squash (RN scales from center)
```
The "L" draws itself with the dash trick — set a dash the length of the whole stroke, then animate the offset to zero:
```tsx
const lProps = useAnimatedProps(() => ({ strokeDashoffset: lOffset.value }));
```
(`useAnimatedProps` is `useAnimatedStyle`'s sibling for animating non-style props like SVG attributes.)

There is one cost, and it's deliberate:

**`app/_layout.tsx`**
```tsx
// Hold the splash long enough for its assembly choreography (~1.4s) to
// land, even when fonts/session resolve instantly (dev, warm caches).
const [splashMinHoldDone, setSplashMinHoldDone] = useState(false);
useEffect(() => {
  const timer = setTimeout(() => setSplashMinHoldDone(true), 1700);
  return () => clearTimeout(timer);
}, []);
const appReady = startupDone && fontsLoaded && splashMinHoldDone;
```
**Every launch is at least 1.7 seconds.** That's a real price paid for a first impression. It's one number in one file if you ever decide it isn't worth it.

### The brand marks are code, not pictures

`LogoMark`, `BrandLoader` and `BrandSplash` all draw the same bag from the same path data:
```tsx
<Path
  d="M 53 42 L 81 42 Q 87 42 88.2 47.5 L 95 81.5 Q 96.6 90 87.5 90 L 46.5 90 Q 37.4 90 39 81.5 L 45.8 47.5 Q 47 42 53 42 Z"
  fill={color.accent}
/>
```
Because it's geometry rather than a PNG, it's sharp at any size, recolourable per surface (`onLight` / `onOrange` / `onInk`), and — the reason it matters here — *animatable*. You cannot make a picture file draw itself on.

---

## 7. Decisions and tradeoffs

Each entry: what was chosen, what the alternative was, what it cost. A decision recorded without its alternative is just an assertion.

### Expo managed, not bare React Native

> **Decision:** build on Expo's managed workflow with EAS Build.
> **Alternative:** bare React Native, with the iOS and Android projects hand-managed.
> **Tradeoff:** you never open Xcode or Android Studio; native config is declared in `app.json` and native code is generated. The cost is that native libraries must be Expo-compatible (nearly all are now), and adding one means a fresh build rather than an over-the-air update. For a two-platform shop app with one owner, this trade is not close.

Note there *is* an `ios/` directory, from a prebuild. It's generated output. Don't hand-edit it — changes belong in `app.json` or a config plugin.

### Zustand, not Redux or Context

> **Decision:** zustand for shared state.
> **Alternative:** Redux Toolkit, or plain React Context.
> **Tradeoff:** zustand's whole API is `create`, `set`, `get` and a selector — the cart store is 268 lines including extensive comments and every line is readable without knowing a framework. Redux would bring actions, reducers, slices and dispatch for no benefit at this size. Context would re-render every consumer on every change, which is exactly the performance problem selectors solve here. The cost is less structure and no time-travel debugging.

### React Query for server data, stores for device data

> **Decision:** a hard split. Anything from a server goes through React Query; anything the device owns goes in a zustand store.
> **Alternative:** load server data into zustand and manage the loading/error flags yourself.
> **Tradeoff:** caching, deduplication, retries, background refetch, and the loading/error/empty triad come for free and behave the same way in every screen. The cost is a second state library to understand — which is why [§5c](#5c-server-data-supabase--react-query) exists.

### ~~Guest checkout, always~~ — SUPERSEDED by "accounts required to order"

> **The original decision (kept here on purpose):** signed-out shoppers go straight to checkout, with an optional non-blocking sign-in card. The alternative was requiring an account, which is what the cart screen used to enforce. The bug it fixed is still instructive: the login wall on the cart made checkout's entire guest path unreachable dead code — it had been *written* and could never *run*.
>
> **Why it no longer holds:** the payment API on litwaypicks.com now requires the authenticated order owner on every call. A guest order can't succeed — it comes back 401 — so "guest checkout" wasn't a choice the app could still make. That fact was discovered the hard way, by watching production payments fail.

### Accounts required to place an order ("Option A")

> **Decision:** an account is required to **place an order**. Browsing, the cart, and the entire delivery form stay open to guests; the sign-in ask happens once, at the step-1-to-step-2 transition, and everything typed survives the round-trip.
> **Alternative:** keep guest checkout and build a possession-token scheme on the backend so an anonymous order could still be looked up safely — or drop the ownership checks, which was never on the table.
> **Tradeoff, argued honestly, because this one is genuinely close:**
>
> *Against.* Friction at the exact moment of purchase is the most expensive friction there is, and this is a low-trust market where being asked to register before you've received anything is a real reason to close the app. First-time buyers are precisely the customers you can least afford to lose.
>
> *For.* Four things tipped it. **(1)** The thing that actually builds trust in this market is *post-payment visibility* — being able to open the app and see where your order is. That requires an account; a guest gets a reference id and an email and nothing else. The account isn't the tax on the sale, it's the feature. **(2)** With email confirmation now off, signup is genuinely one tap: email, password, first name, and you're in — no inbox round-trip. **(3)** MoMo already demands identity. Anyone paying is entering their phone number and approving a prompt on their own handset; the account requirement doesn't introduce identity to a flow that had none. **(4)** The backend hardening had already resolved on the assumption of an authenticated owner, and reversing that would mean giving up ownership checks on order lookup — trading a data-exposure bug back for a conversion rate.
>
> *The cost is real and you should watch for it.* If completion rates drop after this ships, the fallback is **not** to restore guest checkout — the API can't support it. The fallback is **phone-number sign-in with an OTP**, which fits this market far better than email-and-password anyway and keeps every ownership guarantee intact. Treat that as the pre-planned next move rather than a new project.
>
> *What it touched:* `checkout.tsx` (the sign-in card, the `validateDelivery` gate, the fresh-state re-check in `handlePlaceOrder`), `confirmation.tsx` (the `'signin'` outcome), `lib/api.ts` (Bearer headers, `ApiError`), and the removal of every guest-specific string in the payment path.

### `Authorization: Bearer` instead of cookies

> **Decision:** the app authenticates to litwaypicks.com by attaching the Supabase access token as a `Bearer` header; the website's `getServerUser()` accepts either that or its normal cookies.
> **Alternative:** teach the app to hold cookies, or build a second, mobile-only API surface.
> **Tradeoff:** one server-side function learned a second transport, and every existing route — ownership checks, admin checks, re-pricing, all of it — works unchanged for both clients. A separate mobile API would have doubled the surface that has to stay secure, which is the surface you least want doubled. The cost is a hard deployment dependency: **the app's payments do not work until the web change is deployed**, and that is not visible from this repository ([§8](#8-what-still-needs-the-backend-or-the-dashboard)).

### Three-way cart merge with a persisted base

> **Decision:** merge carts by summing each side's **delta from a shared base snapshot**, keep that base per-user, persist it across restarts, and offer a manual sync button in the cart header.
> **Alternative:** last-writer-wins (what it was), or "sum the two quantities", or a full CRDT/operation-log sync.
> **Tradeoff:** removals stick, quantities never double-count, the merge is idempotent so re-running it is free, and mid-session changes made on the website now actually arrive. The costs: one more piece of persisted state (`lastSyncedItems` + `lastSyncedUserId`) that must be reset on sign-out and scoped per account, and a sync the shopper has to *press* rather than one that happens continuously. A proper operation log would remove the button, at several times the complexity — the wrong trade at this size.
> **The review fix inside it is the reusable lesson:** `manualSync` writes to the server *before* applying anything locally. The first version applied first, so a failed write left the shopper looking at a silently-changed cart under a banner saying nothing had happened.

### Email confirmation OFF in Supabase

> **Decision:** turn off "Confirm email" in the Supabase dashboard, so signup returns a live session immediately.
> **Alternative:** leave it on, as it was.
> **Tradeoff:** signup becomes one tap, which is exactly what the accounts-required decision above needs to be survivable. What you give up is proof that the email address is real at the moment of signup — but note what actually guards what here: **the MoMo phone number is the identity rail in this market**, not the email; the payment itself is approved on a handset the customer controls; and the password-reset flow still proves ownership of the email whenever it matters. Cost: more junk or mistyped addresses in the `users` table, and order-confirmation emails that bounce for those accounts. The long-term answer is the same one as above — **phone OTP** — after which the email is optional metadata rather than the account key.
> The app code is agnostic either way ([§2.6](#26-async--await--code-that-has-to-wait)), so flipping the toggle back is safe.

### Email-confirmation-agnostic signup (`541ba23`)

> **Decision:** check whether `signUp` returned a live session and branch on it. Session present → welcome and continue. No session → "check your email".
> **Alternative:** assume one dashboard setting, as the code previously did (it assumed confirmation was ON and always said "check your email").
> **Tradeoff:** correct under either Supabase setting, so flipping that checkbox in your dashboard can never break signup. The cost is one extra branch. Cheap insurance against a config change nobody remembers making.

### Ink and orange, one accent, tokens only

> **Decision:** a warm grey canvas, near-black ink, exactly one accent, everything from `theme/tokens.ts`.
> **Alternative:** per-screen colour choices, or a multi-colour badge system.
> **Tradeoff:** the app reads as one designed product and the accent still means something because it's rare. The cost is discipline: adding a colour means adding a token, and "just this once" is how design systems die.

> **Decision:** ProductCard is *borderless* — a rounded image with name and price sitting directly on the grey canvas.
> **Alternative:** the familiar bordered-and-shadowed card.
> **Tradeoff:** the biggest visual change in the redesign and the one that most makes the app feel current. Cost: less separation between products, which the grid spacing has to carry instead.

> **Decision:** a hand-built floating tab bar with a raised active circle, on expo-router's headless tab primitives.
> **Alternative:** the stock tab bar, free.
> **Tradeoff:** flagged in the spec as the riskiest piece — no library provides it. It's the most distinctive UI in the app, and it's code you now own and maintain (including `FlyToCart`'s geometry coupling to it).

> **Decision:** Bricolage Grotesque for display roles only; body text stays on the system font.
> **Alternative:** the custom face everywhere.
> **Tradeoff:** better legibility at small sizes and zero load cost on long screens. Cost: two typefaces to keep straight — plus the never-set-`fontWeight` rule from [§5a](#5a-the-design-system-themetokensts).

### A hand-built SVG logo animation, not Lottie or a video

> **Decision:** build the splash choreography from the logo's own vector paths in Reanimated.
> **Alternative:** a Lottie JSON exported from After Effects, or an MP4.
> **Tradeoff:** zero image assets, an instant first frame, perfect colour match with the native splash, and it collapses correctly under reduced motion. It also needs no extra dependency — Lottie is another native module in every build. The cost is that changing the choreography means editing timing code rather than re-exporting from a design tool, and the geometry is duplicated across `LogoMark`, `BrandLoader` and `BrandSplash`.

### Motion limited to a handful of named moments

> **Decision:** a fixed inventory of animated moments; everything else is static.
> **Alternative:** animate broadly.
> **Tradeoff:** less "wow" on a first scroll, far less chance of feeling busy or slow on a mid-range Android phone. Motion that's everywhere reads as noise.

### Bundled campaign photography

> **Decision:** ship the hero photos as compressed JPEGs inside the app (226KB and 340KB).
> **Alternative:** load them from a URL or a CMS.
> **Tradeoff:** instant, works offline, no third-party dependency. Cost: app size, and changing them needs a release.

### The Home hero puts text on the canvas, not on the photo

> **Decision:** ink headline on the grey canvas, with the campaign photo kept clean below it in a full-width arch.
> **Alternative:** white text over the photo — the standard ecommerce hero.
> **Tradeoff:** kills the white-text-on-busy-photo contrast fight entirely; text is legible regardless of what the photo does, and the photography gets to be photography. Cost: a taller hero.

### ~~Wishlist is device-only, on purpose~~ — SUPERSEDED, and the reasoning is the point

> **Decision:** no server sync for the wishlist.
> **Alternative:** invent a table shape client-side and write to it.
> **Tradeoff:** the file said it plainly (this comment is no longer in `store/wishlist.ts` — it's quoted here as the record of the original decision):
> ```ts
> // BACKEND HANDOFF: this store is local-only by design for now — verified
> // types/database.types.ts has no `wishlists` table (or equivalent), so there
> // is nowhere on the shared backend to read/write a wishlist from.
> ```
> Inventing a client-side schema for a shared backend is how you end up with two incompatible ideas of the same data. The cost is real and known: wishlists don't appear on litwaypicks.com for the same account and are lost on reinstall. The store is written so wiring it up later is small.

The push token sat on the same principle — the app wrote it to auth metadata and let the backend decide whether that's where it wanted it.

### …and then the tables were created, so both were wired up

> **Decision (superseding both of the above):** `public.wishlists` and `public.push_tokens` were created on the production database with own-row RLS, and the app now reads and writes them.
> **Alternative:** carry on device-only.
> **Tradeoff:** this is what "the store is written so wiring it up later is small" was for, and it was — one commit, no restructuring. The wishlist now follows the customer across devices and survives a reinstall; the push token is queryable, so order-update notifications can actually be fanned out to the right handset. **The lesson worth keeping is the sequencing, not the outcome:** refusing to invent a schema meant that when the real one arrived, there was nothing to unpick. Had the app guessed at a shape, the app and the website would now hold two incompatible ideas of the same wishlist and someone would be writing a migration.
>
> The wishlist sync is deliberately a simpler v1 than the cart's, with one known hole written down in the file rather than papered over ([§5b](#5b-state-zustand-stores-vs-local-state)): an offline *removal* can be resurrected by the next union. Shipping a known, documented, minor flaw beats delaying the feature for it — as long as it's genuinely written down.
>
> Sign-out deliberately leaves this device's `push_tokens` row in place. The next sign-in reassigns it by token, and an orphan row is unreachable in the meantime because RLS scopes it to a user who isn't there.

### The database was hardened separately, and mostly not by changing app code

> **Decision:** a dedicated backend session applied five migrations to production Supabase — the two new tables, `security_invoker=on` on both product views, a widened `orders` owner-read policy, `search_path` pinned on all eleven flagged functions, and `EXECUTE` revoked from `PUBLIC` where appropriate — then regenerated `types/database.types.ts`.
> **Alternative:** keep treating "the backend is out of scope" as permanent.
> **Tradeoff:** most of the app's remaining security posture was never fixable from this repository, and hardening it changed almost no app code — which is the point. **The security that matters is the security the database enforces**, because that's the layer a modified client can't route around. Two details from that work are general lessons and are written up in [§5c](#5c-server-data-supabase--react-query): revoke from `PUBLIC` rather than `anon` (the default grant is one level up from where you're looking), and when a function has to stay callable by a browser, put the privilege check **inside** it rather than trying to hide it.

### Full-screen loaders at blocking moments only

> **Decision:** two `LoadingOverlay` moments in the entire app — post-sign-in hydration and payment — with skeletons everywhere else.
> **Alternative:** the branded overlay wherever anything loads.
> **Tradeoff:** the two waits that genuinely block a customer get an explanation ("Check your phone" is an instruction, not a spinner), and browsing keeps the app on screen so it stays fast to *use* as well as fast to load. Costs: two guard conditions on the sign-in one (`previousUserIdRef`, `showSplashRef`) so a token refresh or a cold start can't trigger it, plus a hard 2.5-second cap so a hung request can't trap anyone behind it. Full reasoning in [§6](#6-the-animation-layer).

### Fix the money and data paths before the cosmetics

> **Decision:** the original audit's four blockers (a project that didn't compile, a cart that never synced, signups with no profile row, a password reset with no ending) were fixed before any redesign work.
> **Alternative:** redesign first, since that's what was visibly wrong.
> **Tradeoff:** the app looked dated for longer, but the redesign got built on a foundation that compiled and persisted data — rather than on top of bugs that would then have had to be re-fixed through a new visual layer.

### The Hermes / OTEL_PKG build story

This one is worth understanding in full because it will happen again in some form.

Development and release builds run your JavaScript differently. In development, the JS is shipped to your phone and interpreted. In release, it's pre-compiled ahead of time into bytecode by **hermesc** — faster startup, smaller app. But hermesc is a stricter parser than the dev pipeline.

`@supabase/supabase-js` ships a line that loads an optional OpenTelemetry tracing package *by variable name* — `import(OTEL_PKG)` rather than `import('some-literal-string')`. hermesc cannot statically resolve that, so it fails. The result: builds passed locally all day, then died on EAS with an unhelpful error.

The fix is a small Babel plugin that rewrites any such call at build time:

**`babel.config.js`**
```js
// Hermes's AOT compiler (hermesc) cannot parse dynamic import() of a
// non-literal — @supabase/supabase-js ships `import(OTEL_PKG)` for optional
// OpenTelemetry tracing, which breaks Android/iOS release bundling. This
// plugin rewrites any such call to Promise.resolve(null); supabase's own
// null-guard then simply runs with tracing disabled (correct for RN).
const stripNonLiteralDynamicImports = ({ types: t }) => ({
  name: 'strip-non-literal-dynamic-imports',
  visitor: {
    CallExpression(path) {
      if (
        path.node.callee.type === 'Import' &&
        path.node.arguments[0]?.type !== 'StringLiteral'
      ) {
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
            [t.nullLiteral()]
          )
        );
      }
    },
  },
});
```
Supabase's own null-check then runs with tracing off, which is what you want on a phone anyway.

> **The permanent lesson: dev-mode success does not mean release success.** `npx expo export --platform android` runs hermesc locally and is the only cheap way to catch this class of failure. It is a required gate. See [§10](#10-when-things-break).

### The binary was slimmed

`ea338fe` removed three installed-but-unused native modules — every installed native module is compiled into every build whether you import it or not — and turned on Android release code shrinking (`enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`, both visible in `app.json`).

### Process decisions from the hardening session

- **Audit everything on a clean baseline, then fix in waves.** Six auditors read the whole codebase in parallel across security, UX states, UX flows, performance, sync/correctness and accessibility. 58 issues confirmed (8 critical, 15 high, 24 medium, 11 low); zero refuted. Interleaving fixes with audits invalidates each subsequent auditor's reading.
- **Implementation and review are separate agents.** Every wave was reviewed by someone whose only job was finding defects in the fix. It caught four real problems, two of them critical — including a SecureStore migration that would have logged out every existing user on update.
- **Both gates run after every change:** `npm run typecheck` and `npx expo export --platform android`. There is no simulator here and no test suite, so those two are the only automated proof — and they prove the code compiles and bundles, not that it behaves.
- **Onboarding counts as "seen" if storage fails.** A storage hiccup must never trap a returning customer on the intro screen.
- **Biometric cancel is silent; real failures alert.** Platform convention — cancelling Face ID shouldn't produce an error popup.
- **No offline banner.** Connectivity detection needs a new native module and a full rebuild, which couldn't be verified without a device. It's a recommendation, not a fix.
- **A seventh whole-system review was skipped.** Every wave already had its own review plus a scoped re-review, and round 3's audit *was* the whole-system pass.

### What changed recently

Everything in this list landed *after* the first version of this guide, and the body of the guide has been rewritten to match — this is a map, not a changelog to read instead of the chapters.

| Commit | What | Where it's explained |
|---|---|---|
| `541ba23` | Signup handles email confirmation on **or** off; the dashboard toggle is now off | [§2.6](#26-async--await--code-that-has-to-wait), §7 |
| `5298add` | `types/database.types.ts` regenerated from the live schema (adds `wishlists`, `push_tokens`) | [§5c](#5c-server-data-supabase--react-query) |
| `1f87040` | Wishlist and push token wired to the new tables | [§5b](#5b-state-zustand-stores-vs-local-state), §7 |
| `a6fb744` | Bearer auth on the payment API; an account is required to place an order | [§5e](#5e-payments-end-to-end), §7 |
| `812e180` | Review fixes: typed `ApiError`, the confirmation `'signin'` outcome, guest copy removed, `www` share links | [§5e](#5e-payments-end-to-end) |
| `57e7736` | Confirmation stops auto-refetching on a wrong-account 403 | [§5e](#5e-payments-end-to-end) |
| `1818cdc` | Branded loading overlays for sign-in hydration and payment | [§6](#6-the-animation-layer) |
| `bcdf9b6` | Three-way cart merge, availability refresh, manual sync button | [§5b](#5b-state-zustand-stores-vs-local-state) |
| `4a977fe` | Cart sync writes to the server *before* applying locally | [§5b](#5b-state-zustand-stores-vs-local-state), [§11](#11-house-rules-for-this-codebase) |
| (no commit — Supabase) | Five production migrations: new tables, `security_invoker` views, widened `orders` policy, pinned `search_path`, `EXECUTE` revoked from `PUBLIC` | [§5c](#5c-server-data-supabase--react-query), §7 |
| (no commit — web repo) | `/api/momo/*` hardened; `getServerUser` accepts Bearer (**deployed? not yet**) | [§5e](#5e-payments-end-to-end), [§8](#8-what-still-needs-the-backend-or-the-dashboard) |

And one piece of housekeeping with no code in it: **this repository now lives on GitHub**, at [github.com/DNLCodess/litwaypicks-mobile](https://github.com/DNLCodess/litwaypicks-mobile), private. It's under a personal account rather than the LitwaysPicks organisation only because the org account lacked repository-creation permission at the time; it can be transferred whenever that's sorted, and transferring preserves history, issues and stars. The website's repository stays where it is, and changes to it go through branches and pull requests — which is why the Bearer work sits on `mobile-bearer-auth` waiting for a merge rather than having been pushed straight to `main`.

---

## 8. What still needs the backend or the dashboard

None of these can be fixed from this repository. Hand this section over verbatim.

**Most of the original list is now done**, and the resolved items are kept below rather than deleted — partly so you can see what "handed off" actually looked like when it came back, and partly because a list that only ever grows teaches nobody anything. Read the two open items first.

### OPEN — 1. Deploy the web repository's Bearer-auth change

**This is the only thing standing between the app and working payments.** `/api/momo/*` requires an authenticated caller, and until `getServerUser()` understands `Authorization: Bearer`, every call from the phone is a **401** — initiating a payment, checking a status, opening a confirmation, all of it.

The change is written, reviewed and sitting on the branch `mobile-bearer-auth` in the web repository: commit `2bc834c` (accept Bearer, validated via `getUser(jwt)`, same token on the PostgREST client so RLS evaluates as that user) and `427afa5` (an invalid Bearer falls through to the cookie path instead of failing the request). It's [PR #27](https://github.com/LitwaysPicks/litwaypickss-eccomerce/pull/27).

**Required action: merge it and deploy.** Nothing in the mobile app can substitute for this.

### OPEN — 2. A pre-payment quote endpoint

The app cannot show a true order total, because it has no way to know the delivery fee before payment. The current honest workaround: no shipping row in the cart, checkout labels its figure **Subtotal**, and a note says the final amount appears in the MoMo prompt. **An endpoint returning a quote (subtotal, delivery fee, total) for a given cart and delivery address would let the app show the real number before the customer commits.** This is the single best conversion improvement available, and it is the last substantive item on the original handoff list.

### OPEN — 3. Two Supabase dashboard settings only you can change

Neither is code; both are toggles in the Supabase dashboard, and both were flagged by Supabase's own advisors:

- **Apply the Postgres patch upgrade.** Security patches for the database engine. Dashboard → Settings → Infrastructure.
- **Turn on leaked-password protection.** Supabase checks new passwords against the HaveIBeenPwned breach corpus and rejects known-compromised ones. Dashboard → Authentication → Policies.

### OPEN — 4. Offline banner — a decision for you, not a backend task

The app has no connectivity detection. A customer who loses signal sees error states rather than "you're offline". Adding it means a new native module (`@react-native-community/netinfo`) and a fresh build. **Recommendation: do it, bundled with the next change that requires a rebuild anyway.**

### RESOLVED — 5. IDOR on `getOrder` and `checkStatus`

*Was:* `GET /api/momo/order/:referenceId` and `GET /api/momo/status/:referenceId` accepted **no authentication whatsoever**, so anyone with a reference id could read a customer's name, phone number and home address. Reference ids are not secret — they're returned to the client, they appear in deep links, and the app polls with one every six seconds.

*Now:* both routes call `requireUserApi()` and then check ownership explicitly. From the web repo's order route:

```js
const isOwner =
  (order.user_id && order.user_id === user.id) ||
  (!order.user_id &&
    order.customer_email &&
    order.customer_email.toLowerCase() === (user.email || "").toLowerCase());
const isAdmin = user.role === "admin";

if (!isOwner && !isAdmin) {
```
Owner by `user_id`, or owner by email for older rows that predate the column, or admin. Everyone else gets a 403 — which is exactly the 403 the confirmation screen's `'signin'` outcome exists to handle ([§5e](#5e-payments-end-to-end)).

*The consequence you must not forget:* this is precisely why guest checkout could not survive. A guest has no identity to match against, so there is no honest way to let one look up an order.

### RESOLVED — 6. Server-side re-pricing validation

*Was:* the payload carried a client-held `price` per line item and the server trusted it.

*Now:* `/api/momo/pay` recomputes everything from its own `products` rows — `sale_price ?? price` per unit, its own stock check, its own total — and charges the computed figure. The client's numbers are ignored. There's also an amount-mismatch guard that flags an order `DISPUTED` when what MTN reports doesn't match what the server computed.

### RESOLVED — 7. `payment_status` string alignment

*Was:* `getOrder` returned `payment_status` and `checkStatus` returned `status`, with no guarantee the two used the same vocabulary — so a customer could see "confirmed" on one screen and "pending" on another.

*Now:* status is normalized server-side, and the app's one shared predicate (`SUCCESSFUL`/`COMPLETED` = success, `FAILED`/`DISPUTED` = failure) matches both.

### RESOLVED — 8. Wishlists table, push tokens, RLS verification

*Was:* three separate asks — a `wishlists` table, somewhere queryable for the push token, and confirmation that the RLS policies actually said what the app assumed.

*Now:* `public.wishlists` (`user_id` + `product_id` primary key) and `public.push_tokens` (`token` primary key, `user_id`, `platform`) both exist with own-row RLS, `types/database.types.ts` is regenerated from the live schema, and the app reads and writes both ([§5b](#5b-state-zustand-stores-vs-local-state)). The policy audit that came with them also fixed the `products_with_categories` / `featured_products` views (`security_invoker=on`), widened the `orders` owner-read policy to `(customer_email = auth.email() OR user_id = auth.uid())`, pinned `search_path` on all eleven flagged functions, and revoked `EXECUTE` from `PUBLIC` where it wasn't wanted — see [§5c](#5c-server-data-supabase--react-query) for what each of those means.

### Supabase dashboard settings to be aware of

- **Email confirmation is now OFF.** Signup handles both settings correctly since `541ba23`, but the toggle changes what your customers experience, and off is a deliberate decision with reasoning in [§7](#7-decisions-and-tradeoffs) — not an accident to be tidied up.
- **Realtime must be enabled on the `orders` table** or the checkout screen's live subscription silently does nothing and everything falls back to the 6-second poll.
- **The `auth.users` trigger that creates the `public.users` profile row** must stay in place. Without it, new signups have no profile.
- **Redirect URLs** must include the app's scheme for the password-reset email to land on `app/(auth)/new-password.tsx`.
- **`get_order_stats` is admin-gated inside the function.** The website's admin dashboard calls it from the browser, so it can't be locked away from the `authenticated` role; it checks `is_admin()` itself instead. Don't "simplify" that check away.

---

## 9. How to do common things

Each recipe is exact files and steps.

### Change the brand colour

1. Open `theme/tokens.ts`. Change `palette.primary[600]` (and the neighbouring ramp values if you want the gradient and pressed states to stay coherent — `500` feeds `accentGradient`, `700` feeds `accentPressed`, `50` feeds `accentSoft`).
2. Open `app.json` and change the three native occurrences: `android.adaptiveIcon.backgroundColor`, the `expo-splash-screen` plugin's `backgroundColor`, and the `expo-notifications` plugin's `color`.
3. `npm run typecheck`, then reload the app.
4. The `app.json` changes are **native config** — they need a new build to take effect, not just a reload.

Note the nine legacy files still importing `constants/Colors.ts` won't follow. Migrating them is a good first real task.

### Change copy

Text lives inline in the screen that shows it. Find the phrase with a search across `app/` and `components/`, and edit the string. Two rules: **sentence case** ("Payment failed", not "Payment Failed"), and don't promise something the app can't verify — the honest-money-path work in [§5e](#5e-payments-end-to-end) exists precisely because copy had over-promised.

### Add a new static screen

1. Create `app/faq.tsx`.
2. Give it a default-exported component. Copy the shape of `app/about.tsx` for the header and back button, or use tokens directly:
   ```tsx
   export default function FaqScreen() {
     const insets = useSafeAreaInsets();
     const router = useRouter();
     return (
       <View style={{ flex: 1, backgroundColor: color.bg }}>
         ...
       </View>
     );
   }
   ```
3. That's it — the route `/faq` now exists. No registration anywhere.
4. Link to it: `router.push('/faq')`.
5. If it needs a non-default transition, add a `<Stack.Screen name="faq" options={{ animation: 'slide_from_right' }} />` line in `app/_layout.tsx`. Otherwise the default applies.
6. `npm run typecheck`. Typed routes are generated, so a brand-new route may need one dev-server restart before TypeScript knows about it (that's what the `as any` casts on some `router.replace` calls are working around).

### Add a field to checkout

Say you want a delivery note.

1. **`types/index.ts`** — add it to the shape:
   ```ts
   export interface CheckoutForm {
     ...
     county: string;
     deliveryNote: string;
   }
   ```
   Typecheck now fails everywhere the form is built. That's the feature.
2. **`app/checkout.tsx`** — add it to the initial state:
   ```tsx
   const [form, setForm] = useState<CheckoutForm>({
     ...
     county: '',
     deliveryNote: '',
   });
   ```
3. Add the input inside the Delivery Address `SectionCard`, following the existing pattern:
   ```tsx
   <Input
     label="Delivery note"
     leftIcon="chatbox-outline"
     value={form.deliveryNote}
     onChangeText={(v) => setForm((s) => ({ ...s, deliveryNote: v }))}
     returnKeyType="done"
   />
   ```
4. If it's required, add a check in `validateDelivery()`.
5. Add it to the payload in `handlePlaceOrder`, under `delivery`.
6. **Tell whoever runs litwaypicks.com** — the endpoint has to accept and store the new field, or it goes nowhere.
7. `npm run typecheck` and `npx expo export --platform android`.

### Add a badge to the product card

`components/shop/ProductCard.tsx` already has two overlays — the discount chip and the SOLD OUT scrim. Copy the discount chip's shape inside the same `Animated.View` that holds the image:

```tsx
{product.featured && (
  <View
    style={{
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: color.ink,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.sm,
    }}
  >
    <Text style={{ color: color.onInk, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
      PICK
    </Text>
  </View>
)}
```
Tokens only, and pick a corner that doesn't collide with the discount chip (top-left) or the wishlist heart (top-right). Because `ProductCard` is used everywhere, this appears on Home rails, Shop, Category and wishlist at once.

### See what `console.log` prints

`console.log('cart items', items)` output appears in the terminal where you ran `npx expo start`, and in the dev tools if you have them open. `console.warn` and `console.error` also show in the app's own dev overlay. The codebase uses `console.warn` for recoverable problems, always with a prefix identifying the source:
```ts
console.warn('Cart write failed:', error.message);
console.warn('[supabase] SecureStore read failed for', key, e);
```
Follow that convention. And remember these lines stay in release builds — don't log anything sensitive.

### Bump the version and build

1. `app.json` → `expo.version`. That's the human-facing version ("1.0.1").
2. Build numbers are handled for you: `eas.json`'s production profile sets `"autoIncrement": true`, and the CLI is configured with `"appVersionSource": "remote"` so EAS tracks the counter.
3. **Push your environment variables to EAS if they've changed.** This step is easy to forget and it produces a build that installs fine and then crashes on launch — see [§10](#10-when-things-break):
   ```bash
   eas env:push --environment preview --path .env
   eas env:push --environment production --path .env
   ```
4. Build:
   ```bash
   eas build --profile preview --platform android     # a real release build, for testing
   eas build --profile production --platform all      # store submission
   ```

**Why step 3 exists.** `.env` is in `.gitignore` — correctly, since it holds your Supabase URL and keys and shouldn't be in the repository. But EAS builds from a *clean copy of the repository on a cloud machine*, so that file simply isn't there when your app is compiled. Locally everything works, because `npx expo start` reads `.env` off your disk. Remotely, `process.env.EXPO_PUBLIC_SUPABASE_URL` is `undefined`, `createClient` is handed nothing, and the app dies on launch. `eas env:push` uploads the values to EAS once per environment, where they're stored and injected into every future build. You only need to re-run it when `.env` itself changes — and the three variables that matter are `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_BASE_URL`.

The three profiles in `eas.json`:

| Profile | What it's for |
|---|---|
| `development` | A dev client — the app plus the live-reload connection. Install once, keep. |
| `preview` | A real release-mode build, distributed internally. **Test with this before you ship.** |
| `production` | Store submission. Auto-increments the build number. |

**Why `preview` matters:** it is compiled the same way as production, including hermesc. See [§10](#10-when-things-break).

### Regenerate icons after a logo change

Everything native was generated from `assets/images/logo-1.pdf` / `logo-2.pdf` through the vector `LogoMark`: `icon.png`, the three Android adaptive layers (foreground, background, monochrome), `splash-icon.png`, `favicon.png`. The native splash background in `app.json` is brand orange so it matches `BrandSplash` and the handoff has no visible seam. **If the logo changes, regenerate them all together** — a mismatched set is the classic way an app starts looking sloppy — and update the SVG path data in `LogoMark`, `BrandLoader` and `BrandSplash`.

---

## 10. When things break

### The two gates

There is no simulator here and no test suite. These two commands are your only automated proof:

```bash
npm run typecheck                    # tsc --noEmit. Must be 0 errors.
npx expo export --platform android   # runs hermesc. Must succeed.
```

**Run both before every commit.** Be honest about what they prove: the code compiles and bundles. Not that it behaves.

### Why dev-mode success can still mean release failure

Development interprets your JavaScript on the phone. Release **pre-compiles** it with hermesc, which is stricter — see the OTEL_PKG story in [§7](#7-decisions-and-tradeoffs). Code that runs perfectly in `npx expo start` can fail to bundle for release.

`npx expo export --platform android` runs hermesc locally, on your machine, in seconds. It is the only cheap way to catch this class of failure before EAS spends 15 minutes discovering it for you. Do not skip it because "it worked in dev" — that is exactly the sentence that preceded the last one.

### Day-to-day commands

```bash
npm install                       # once, and after any dependency change
npm start                         # the dev server
npm run typecheck                 # the compile gate
npx expo start -c                 # the same, with caches cleared
```

**`-c` clears the Metro bundler cache.** Reach for it when the app behaves as if it's running code you already deleted, when a newly added file "doesn't exist", when a font or image doesn't update, or after changing `babel.config.js`, `metro.config.js` or `tsconfig.json`. It's the first thing to try for anything inexplicable, and it costs one slow reload.

If that doesn't do it, escalate:
```bash
rm -rf node_modules && npm install
```

### Expo Go vs a development build

`npm start` gives you a QR code, and scanning it in Expo Go runs the app. **But this app uses native features Expo Go can't provide** — push notifications, biometrics, and the FlashList renderer. The code shims around those (`lib/notifications.ts` and `components/ui/List.tsx` both check `Constants.appOwnership === 'expo'`) so it doesn't crash, but you're not seeing the real app.

For real work, install a **development build** once (`eas build --profile development`) and point it at your dev server. It has all the native modules and still live-reloads.

### Reading a red screen

When JavaScript throws in development, you get a full-screen red error. Read it in this order:

1. **The message** — often literally the answer (`undefined is not an object (evaluating 'product.name')`).
2. **The first stack frame that names a file of yours.** Ignore the frames inside `node_modules`; find the top-most `app/…` or `components/…` line. That's where your code went wrong, even if the throw happened deeper.
3. **The component stack**, below the JS stack, tells you *which screen* it happened in.

The three you'll see most:
- `undefined is not an object` / `Cannot read property 'x' of undefined` — you assumed data had arrived. Fix with optional chaining (`product?.name`) or by handling `isLoading` first.
- `Text strings must be rendered within a <Text> component` — a bare string inside a `View`.
- `Objects are not valid as a React child` — you interpolated an object where a string was expected. Usually a missing `.name` or a stray `{error}` instead of `{error.message}`.

In **release** builds there is no red screen. `ErrorBoundary` catches the crash and shows the polite fallback instead, and `componentDidCatch` logs it:
```tsx
componentDidCatch(error: Error, info: React.ErrorInfo) {
  console.error('[ErrorBoundary]', error, info);
}
```
That log goes to the device console, which you'd read via `adb logcat` on Android or Console.app on iOS. There is no crash-reporting service wired up — if you want stack traces from real customers, that's a service to add (Sentry is the usual choice, and it's a native module, so it needs a rebuild).

### When a release build installs and then crashes instantly

This has already happened to you once, and it's worth reading before it happens again — because both gates were green, the build succeeded, the APK installed, and the app died the moment it opened. Neither `npm run typecheck` nor `npx expo export` can catch this class of failure, because there is nothing wrong with the code.

**The symptom:** app opens, white flash, closed. No error, no red screen (release builds don't have them), nothing on your machine.

**How to actually see the crash.** Plug the phone in and read the device's own crash log:

```bash
adb logcat --buffer=crash -d | tail -50
```

Piece by piece: `adb` is the Android Debug Bridge, part of the platform-tools that come with Android Studio (`brew install --cask android-platform-tools` if you don't have it). `logcat` is Android's system log. `--buffer=crash` narrows it to the crash buffer instead of every log line on the device. `-d` means "dump what's there and exit" rather than streaming forever. `tail -50` shows the last fifty lines, which is where the crash is.

For that to work the phone needs **USB debugging** turned on: Settings → About phone → tap "Build number" seven times to unlock Developer options, then Developer options → USB debugging. Plug in, accept the "Allow USB debugging?" prompt on the phone, and confirm with `adb devices` — you want a line ending in `device`, not `unauthorized`.

**The crash you actually got, and what it meant:**

```
supabaseUrl is required
```

Five words, and they're the whole diagnosis. `lib/supabase.ts` calls `createClient(supabaseUrl, supabaseAnonKey, …)`; `supabaseUrl` comes from `process.env.EXPO_PUBLIC_SUPABASE_URL`; that was `undefined`; and the Supabase client throws immediately rather than limping along. The module runs at import time — before any screen renders — so the whole app dies at once.

**The cause was not code at all.** `.env` is gitignored, EAS builds from a clean checkout on a cloud machine, so `.env` never existed in that build. The fix is the `eas env:push` step in [§9](#9-how-to-do-common-things):

```bash
eas env:push --environment preview --path .env
eas env:push --environment production --path .env
```

**The general lesson, which is bigger than this one bug:** *anything that isn't in the repository doesn't exist on the build machine.* Your `.env`, your local `node_modules` quirks, that file you forgot to `git add` — none of it travels. When a build works locally and fails remotely and the code is identical, ask what's on your disk that isn't in git.

### When typecheck fails

Read the *first* error, not the last. TypeScript errors cascade — one bad type at the top produces twenty downstream. Fix the first, re-run, repeat. If an error mentions a route that definitely exists, restart the dev server: typed routes are generated files.

---

## 11. House rules for this codebase

These are the conventions the app was built to. Keep them, and tell any AI assistant working on this code to keep them too.

1. **Tokens only.** No raw hex, no magic numbers. If a value doesn't exist in `theme/tokens.ts`, add it there. The design system is treated as law.
2. **Shared components over local copies.** If a screen needs a button, it uses `Button`. Rebuilding one inline is how a design system dies.
3. **Sentence case in copy.** "Payment failed", not "Payment Failed".
4. **The gates are typecheck and export.** `npm run typecheck` and `npx expo export --platform android` before every commit.
5. **Explicit staging only.** Commit named files. Never `git add -A` — this repo has scratch directories and local config that must not be committed.
6. **Every query handles four states:** loading, error (with a working retry), empty, and data. Never let a failure render as "nothing found".
7. **Every icon-only control has an `accessibilityLabel`.** The shared `IconButton` makes it a *required* prop — the app will not compile without one. Touch targets meet 44pt, using `hitSlop` where the visual can't grow.
8. **Every animation passes `reduceMotion: ReduceMotion.System`.**
9. **Never trust input from outside the app.** Route params, deep links and push payloads all get allowlisted or format-validated before use.
10. **A sync failure must never lose local state.** Surface it, retry it, but keep what the customer has.
11. **Never declare success you haven't verified.** Especially about money.
12. **Write, then apply.** When a change has to land both on the server and in front of the customer, do the server write *first* and only change what they're looking at once it succeeded. A failure path that has already altered the screen is a failure path that lies. (`manualSync` in `store/cart.ts` is the worked example.)
13. **Never auto-retry a 403 without an identity change.** A 401 or 403 is a considered answer, not a hiccup — repeating the same request with the same credentials gets the same answer forever, and that's a loop, not resilience. Retry only when an *input* has genuinely changed; `confirmation.tsx`'s `authFailedUserRef` is how that's tracked.
14. **`EXECUTE` grants: revoke from `PUBLIC`, not just `anon`.** Postgres grants execute on new functions to `PUBLIC` by default, and `PUBLIC` includes every role. Revoking from `anon` alone changes nothing at all.
15. **Write down every judgment call**, with its alternative and its cost. Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`, session records in `.superpowers/overnight/`.
16. **Review is separate from implementation.** When work is done by an agent, have a different agent look for defects in it. That separation caught four real problems, two critical — and two more since, including the write-then-apply ordering in rule 12 and the 403 loop in rule 13.
17. **Update this guide when big changes land**, in the same commit. When a decision is *reversed*, mark the old one superseded and say why rather than deleting it — the reasoning that turned out to be wrong is the most useful thing in the record.

---

## 12. Glossary

**Accessibility label** — invisible text attached to a control so a screen reader can announce what it does. Required on every icon-only button here.

**Allowlist** — a list of permitted values; everything not on it is rejected. Used for deep links, push destinations and the login `next` param.

**`async` / `await`** — syntax for working with results that arrive later. `async` marks a function; `await` pauses it (not the app) until a promise resolves.

**AsyncStorage** — the phone's ordinary app storage. Survives restarts; not encrypted.

**Babel** — the tool that rewrites your modern JavaScript/JSX into what the engine actually runs. Also where the hermesc fix lives.

**Base snapshot** — in a three-way merge, the copy of the data that both sides last agreed on. Each side's *delta* from the base is what actually gets merged, which is why a base is what stops "sum the two copies" from double-counting. Here: `lastSyncedItems`, scoped by `lastSyncedUserId`.

**Bearer token** — a credential presented in a request header (`Authorization: Bearer <token>`) rather than a cookie. Whoever "bears" it is treated as its owner. The app sends its Supabase access token this way because it has no cookies.

**Bundle** — all your JavaScript packed into one file for shipping.

**Component** — a function with a capitalised name that returns UI.

**CRDT / operation log** — sync designs that record *every change* rather than snapshots, so copies converge with no merge step. More powerful than the three-way merge here, and far more machinery; deliberately not used.

**Debounce** — waiting for activity to stop before acting. The cart waits 800ms after the last change before writing to the server.

**Deep link** — a URL that opens the app to a specific screen, e.g. `litwaypicks://product/red-dress`.

**Dependency array** — the `[...]` at the end of `useEffect`/`useMemo`. Lists what the hook depends on; re-runs when one changes.

**Destructuring** — pulling named fields out of an object into variables: `const { data, error } = await ...`.

**EAS** — Expo Application Services. Expo's cloud that compiles the app and submits it to the stores.

**Effect** — code that runs after render to do something other than rendering. See `useEffect`.

**expo-router** — the navigation system where the folder structure *is* the route map.

**Flexbox** — the layout system. Default direction is column (top-to-bottom), unlike the web.

**Hermes / hermesc** — the JavaScript engine on the phone, and its ahead-of-time compiler. Release builds are pre-compiled by hermesc, which is stricter than development.

**Hook** — a function starting with `use` that connects a component to React's machinery. Must be called at the top level, unconditionally, in the same order every render.

**Hydrate** — populate the app's state from a stored or fetched source on startup.

**IDOR** — *Insecure Direct Object Reference*. A URL that hands you someone else's data because you know its id. The order-lookup endpoints were one until the backend added authentication and ownership checks (§8).

**Idempotent** — an operation you can run twice and get the same result as running it once. Sync routines must be idempotent, because they get retried, double-fired and raced constantly. The cart's three-way merge is.

**Immutability** — never editing state in place; always producing a new value. Required for React to notice changes.

**Infinite query** — loading a list one page at a time as the customer scrolls.

**JSX** — the HTML-looking syntax inside `return`. It's JavaScript, transformed at build time.

**Last-writer-wins** — the naive sync rule where whoever writes most recently overwrites everything else. Simple, and the reason cart items used to disappear when two devices were both in use.

**Memoization** — remembering a computed result so it isn't recalculated every render. `useMemo` for values, `React.memo` for components.

**Middleware** — a wrapper adding behaviour to something. `persist` is zustand middleware.

**Mutation** — a write to the server (place order, save profile, submit review).

**Native module** — part of a library written in the phone's own language. Adding one requires a rebuild; it can't arrive over the air.

**Optional chaining (`?.`)** — read a property safely: `user?.id` is `undefined` rather than a crash when `user` is null.

**Prop** — a value passed to a component to configure it. Flows downward only.

**Promise** — an object representing an answer that will arrive later.

**PUBLIC (Postgres role)** — the pseudo-role every database role belongs to. New functions grant `EXECUTE` to it by default, so revoking a permission from `anon` alone does nothing while `PUBLIC` still holds it.

**Query** — a read from a server, managed here by React Query with caching, retries, and loading/error states.

**Query key** — a query's cache address. Include every input the fetch depends on.

**React Native** — the technology that turns one JavaScript codebase into real iOS and Android views.

**Reanimated** — the animation library. Runs animations on the UI thread so they stay smooth while JavaScript is busy.

**Realtime subscription** — a live connection pushing database changes to the app the instant they happen. Used for payment outcomes.

**Reduced motion** — a phone accessibility setting. Every animation here honours it via `ReduceMotion.System`.

**Render** — React calling your component function to get a fresh description of the UI.

**RLS** — *Row Level Security*. Database rules deciding which rows each user may see or change. Your last line of defence, because it's the one a modified app can't route around. Audited and fixed in the backend session (§5c); `wishlists` and `push_tokens` carry own-row policies.

**SecureStore** — hardware-backed encrypted storage (iOS Keychain / Android Keystore). Where the session token lives.

**`security_invoker`** — a Postgres view setting. Off (the default), a view runs with its author's permissions and can hand out rows the caller's own RLS would deny. `security_invoker=on` runs the view as the caller, so RLS still applies. Both product views here have it on.

**Selector** — the `(s) => s.items` function passed to a store hook, subscribing to just one slice so unrelated changes don't re-render.

**Session / token** — proof that a customer is signed in. Whoever holds it *is* that customer, which is why where it's stored matters.

**Shared value** — a Reanimated value both the JS and UI threads can see. Changing it does not re-render.

**Skeleton** — the grey placeholder shapes shown while content loads.

**Skeleton vs. full-screen loader** — a skeleton keeps the app on screen; a full-screen loader removes it. Skeletons for browsing, full-screen only for genuinely blocking moments (§6).

**Spread (`...`)** — copy an object's or array's contents into a new one: `{ ...s, firstName: v }`.

**State** — a value a component remembers between renders, and which triggers a re-render when changed.

**Store** — shared app memory any screen can read and write. Here: cart, auth, wishlist, reviewed.

**Supabase** — the hosted Postgres database and auth system behind both the app and the website.

**Ternary (`? :`)** — an inline if/else expression. The only conditional usable inside JSX.

**Three-way merge** — combining two edited copies of something by comparing each against a shared **base snapshot** and applying both sides' changes, rather than picking a winner or naively adding the copies together. The cart's merge (§5b) is the worked example.

**Token (design)** — a named design value like `color.accent`. Change it once, it changes everywhere.

**Tombstone** — a record that something was *deleted*, kept so a later sync doesn't resurrect it. The wishlist's known v1 hole is the absence of one.

**Type predicate** — a TypeScript function whose return type is written `x is SomeType`; when it returns true, the compiler narrows the argument's type. `isAllowedNext(next): next is string` is one.

**TypeScript** — JavaScript plus data-shape checking, so mistakes surface at compile time instead of on a customer's phone.

**UI thread / JS thread** — the two threads in a React Native app. The UI thread draws frames; the JS thread runs your code. Reanimated exists to keep animation on the former.

**Upsert** — insert a row, or update it if it already exists. How the cart is written to Supabase.

**Write-then-apply** — house rule 12: when a change has to land on the server *and* on screen, do the server write first and only update the screen once it succeeded, so a failure genuinely changes nothing.

**Zustand** — the small library the stores are built with.

---

*Written from the code itself, the specs and plans in `docs/superpowers/`, and the session ledger in `.superpowers/overnight/ledger.md`. Every code excerpt in this guide was copied from the file named above it — including the two excerpts from the website's repository, which are labelled as such and are read-only from here. Where an excerpt is quoted as a historical record of a decision that has since changed, the text says so.*
