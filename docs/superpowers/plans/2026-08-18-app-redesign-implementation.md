# LitwaysPicks Mobile Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin onboarding and the core shopping flow (Home, Shop, Category, Product, Cart, Checkout, Confirmation, Account) to the warm-grey/borderless-card/pill-button visual system extracted from the client's design references, on top of a rebuilt shared component library.

**Architecture:** Bottom-up. First extend the token system additively (no breakage), then build eight new/rebuilt shared primitives (Button, IconButton, Input, Card, QuantityStepper, ProgressStepper, TabBar, ProductCard), then apply them screen by screen. Business logic (queries, payment flow, cart/auth stores) is untouched throughout — every task here is presentational.

**Tech Stack:** Expo SDK 56, Expo Router 56 (`expo-router/ui` headless tabs), React Native 0.85, NativeWind 4, Zustand, TanStack Query, `react-native-reanimated`, `expo-linear-gradient`.

**Spec:** `docs/superpowers/specs/2026-08-18-app-redesign-design.md`

## Global Constraints

- Canvas background is `#ececec` everywhere; white (`#ffffff`) is reserved for surfaces that float on top of it — never make the canvas white.
- The accent orange ramp (`#fff7ed` … `#7c2d12`, base `#ea580c`) is **unchanged** — the client explicitly protected this; do not introduce a new brand color.
- Every button, chip, tab bar, and quantity stepper is pill-shaped. This project's existing `radius.full` token is already `999` — use it; do **not** add a duplicate `radius.pill` key.
- Price text is accent-colored and bold everywhere it appears (currently inconsistent — sometimes orange, sometimes black).
- `ProductCard` becomes borderless: the image is the card (rounded, no border/shadow/white box); name/rating/price sit directly on the grey canvas beneath it.
- Out of scope for every task in this plan: `app/(auth)/*`, dark mode, a home-banners CMS, new accessibility-label work, and any change to payment/checkout/cart/auth *logic*.
- Spec §6 anticipated aliasing `tailwind.config.js`'s color extension to the new tokens. This plan doesn't do that: every task below moves color *decisions* out of NativeWind `className` utilities and into `theme/tokens.ts`-driven inline styles instead (see Tasks 2 and 19's rebuilt `Button`/`Badge`, which drop `className` styling entirely). `tailwind.config.js`'s existing `primary`/`secondary` color extensions are left untouched — they still resolve to the same hex ramp, so any NativeWind color class a screen keeps (e.g. `bg-primary-600`) still renders correctly; new code just doesn't add more of them. This satisfies the spec's actual goal (color flows from one file) without duplicating the palette into a second config.
- `constants/Colors.ts` is **kept, not deleted**, in this phase — 12 files outside this plan's scope (`app/(auth)/login.tsx`, `app/(auth)/new-password.tsx`, `app/(auth)/reset-password.tsx`, `app/about.tsx`, `app/contact.tsx`, `app/privacy.tsx`, `app/returns.tsx`, `app/shipping.tsx`, `app/terms.tsx`, `app/order/[id].tsx`, `app/+not-found.tsx`, `components/ui/ErrorBoundary.tsx`) still import it. `ErrorBoundary` is app-wide crash-recovery infrastructure, not a screen — re-skinning its rarely-seen fallback UI isn't part of a shopping-flow redesign. This corrects spec §6, which anticipated full deletion — that only happens once a later phase migrates those remaining files.
- **Testing adaptation:** this project has no test runner installed (no `jest`, no `react-native-testing-library`, no `test` script — confirmed by reading `package.json`). Installing one is out of scope for a presentational redesign. Every task's verification step is therefore `npm run typecheck` (the project's existing CI gate, already 0 errors) plus a manual visual check in the running app. Where a task introduces real (non-JSX) logic — `clampQuantity`, `useTabBarClearance` — that logic is still factored into a small, named, pure export so it *could* be unit tested the moment a runner exists, but no test file is written here.
- **Expo Router v56 changed its tabs API** (per `AGENTS.md`'s warning to check current docs before writing code): the classic `Tabs` imported from `'expo-router'` is deprecated in favor of `'expo-router/js-tabs'`, and its `BottomTabBarProps` type is not re-exported from the package root (confirmed by reading `node_modules/expo-router/build/exports.d.ts` — only the `Tabs` binding is re-exported, not `export *`). The documented way to build a fully custom tab bar is the headless `Tabs`/`TabList`/`TabTrigger`/`TabSlot` primitives from `'expo-router/ui'` (confirmed against `https://docs.expo.dev/router/advanced/custom-tabs/` and the package's own `.d.ts` files). Task 8 uses that API.

## File Structure

**New files:**
- `components/ui/IconButton.tsx` — floating circular icon button (back/search/wishlist/cart-icon actions).
- `components/ui/Card.tsx` — generic enclosed white surface (cart rows, info cards, order summaries).
- `components/ui/QuantityStepper.tsx` — pill quantity control, extracted out of `cart.tsx`.
- `components/ui/ProgressStepper.tsx` — dotted-line checkout step indicator.
- `components/navigation/TabBar.tsx` — the floating pill tab bar's button components + `useTabBarClearance` hook.

**Modified files:** `theme/tokens.ts`, `components/ui/Button.tsx`, `components/ui/Input.tsx`, `components/ui/Badge.tsx`, `components/ui/EmptyState.tsx`, `components/ui/SkeletonLoader.tsx`, `components/shop/ProductCard.tsx`, `components/shop/FilterSheet.tsx`, `app/(tabs)/_layout.tsx`, `app/onboarding.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/shop.tsx`, `app/category/[slug].tsx`, `app/product/[slug].tsx`, `app/(tabs)/cart.tsx`, `app/checkout.tsx`, `app/confirmation.tsx`, `app/(tabs)/account.tsx`.

**Unmodified in this phase (own the remaining `constants/Colors.ts` consumers):** `app/(auth)/*`, `app/about.tsx`, `app/contact.tsx`, `app/privacy.tsx`, `app/returns.tsx`, `app/shipping.tsx`, `app/terms.tsx`, `app/order/[id].tsx`, `app/+not-found.tsx`, `components/ui/ErrorBoundary.tsx`.

---

## Task 1: Extend design tokens

**Files:**
- Modify: `theme/tokens.ts`

**Interfaces:**
- Produces: `color.bg`, `color.surfaceSunken`, `color.ink`, `color.inkMuted`, `color.inkFaint`, `color.onInk`, `color.accentGradient: readonly [string, string]`, `color.peachTint`. Existing `color.text`/`textMuted`/`textFaint` keep their names as aliases of `ink`/`inkMuted`/`inkFaint` so every current consumer keeps compiling unchanged. `shadow.accentGlow` (new preset for primary pill buttons).
- Consumes: nothing (leaf module).

- [ ] **Step 1: Update the color and shadow blocks**

In `theme/tokens.ts`, replace the `color` and `shadow` exports:

```ts
/* ── Semantic colors ───────────────────────────────────────────────────── */
/* Prefer these in screens — they describe intent, not appearance. */
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
  /** Tertiary text (placeholders, faint labels). */
  inkFaint: '#b8b8b8',
  /** Aliases kept so existing screens using the old names keep compiling. */
  text: '#141414',
  textMuted: '#8a8a8a',
  textFaint: '#b8b8b8',
  /** Text/icons drawn on the accent color. */
  onAccent: palette.neutral[0],
  /** Text/icons drawn on the ink-black tab bar / dark pill button. */
  onInk: palette.neutral[0],

  /** The single brand accent — unchanged, the client asked to keep this. */
  accent: palette.primary[600],
  accentPressed: palette.primary[700],
  accentSoft: palette.primary[50],
  /** Gradient fill for primary pill CTAs only. */
  accentGradient: [palette.primary[500], palette.primary[600]] as const,

  /** Soft accent-tinted card background (order-ID card, info callouts). */
  peachTint: '#fdecd8',

  /** Status — used rarely and deliberately. */
  success: '#16a34a',
  danger: '#dc2626',
  star: '#f59e0b',
} as const;

/* ── Elevation ─────────────────────────────────────────────────────────── */
/* Cards now float on a grey canvas (not white-on-white), so they need a touch
   more presence than before. One shadow preset per purpose, used consistently. */
export const shadow = {
  none: {},
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  /** Soft accent-colored glow under primary gradient pill buttons. */
  accentGlow: {
    shadowColor: palette.primary[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;
```

- [ ] **Step 2: Flatten the display/heading letter-spacing**

In the same file, in the `type` export, change the `letterSpacing` values on `display`, `h1`, and `h2` — the reference screens use friendly, un-tracked bold headlines, not the current tight editorial tracking:

```ts
export const type = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: weight.bold, letterSpacing: -0.2, color: color.text },
  h1: { fontSize: 20, lineHeight: 26, fontWeight: weight.bold, letterSpacing: -0.1, color: color.text },
  h2: { fontSize: 17, lineHeight: 22, fontWeight: weight.bold, letterSpacing: 0, color: color.text },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: weight.semibold, color: color.text },
  body: { fontSize: 14, lineHeight: 20, fontWeight: weight.regular, color: color.text },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: weight.semibold, color: color.text },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: weight.regular, color: color.textMuted },
  label: { fontSize: 11, lineHeight: 14, fontWeight: weight.semibold, letterSpacing: 0.3, color: color.textMuted },
  overline: { fontSize: 10, lineHeight: 12, fontWeight: weight.bold, letterSpacing: 0.8, textTransform: 'uppercase', color: color.textFaint },
} as const satisfies Record<string, TextStyle>;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors (this change is purely additive to `color`/`shadow` plus value tweaks to `type` — no existing field was removed or retyped).

- [ ] **Step 4: Commit**

```bash
git add theme/tokens.ts
git commit -m "Extend design tokens with the redesign's warm-grey palette"
```

---

## Task 2: Rebuild Button as pill-shaped, gradient-capable, and re-skin its EmptyState consumer

**Files:**
- Modify: `components/ui/Button.tsx`
- Modify: `components/ui/EmptyState.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `shadow` from `theme/tokens.ts` (Task 1); `PressableScale` (unchanged).
- Produces: `Button` component. Public props narrow from `variant?: 'primary'|'secondary'|'outline'|'ghost'` to `variant?: 'primary'|'dark'|'outline'|'ghost'` (`'secondary'` is confirmed unused anywhere in the app; every other call site uses either the default `primary` or `outline`, both of which are kept — verified via `grep -rn 'variant="' app components`). `title`, `size`, `loading`, `fullWidth`, `icon`, and the rest of `PressableProps` are unchanged. `EmptyState`'s public API (`{ icon?, title, description?, actionLabel?, onAction? }`) is unchanged — every in-scope screen's empty state (Cart, Shop, Category, Account) picks up the new look automatically once this task lands, since none of them pass a `variant` prop.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `components/ui/Button.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, Text, View, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, radius, shadow } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

interface Props extends PressableProps {
  title: string;
  variant?: 'primary' | 'dark' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const SIZES = {
  sm: { height: 40, paddingHorizontal: 16, fontSize: 13 },
  md: { height: 50, paddingHorizontal: 20, fontSize: 15 },
  lg: { height: 56, paddingHorizontal: 24, fontSize: 16 },
} as const;

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  const dims = SIZES[size];

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'dark' ? color.onAccent : color.accent} />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text
            numberOfLines={1}
            style={{
              fontSize: dims.fontSize,
              fontWeight: '700',
              color:
                variant === 'primary' || variant === 'dark'
                  ? color.onAccent
                  : variant === 'outline'
                  ? color.ink
                  : color.accent,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const shared = {
    height: dims.height,
    paddingHorizontal: dims.paddingHorizontal,
    borderRadius: radius.full,
    width: fullWidth ? ('100%' as const) : undefined,
    opacity: isDisabled ? 0.5 : 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (variant === 'primary') {
    return (
      <PressableScale haptic scale={0.97} disabled={isDisabled} style={[{ borderRadius: radius.full, ...shadow.accentGlow }, style]} {...rest}>
        <LinearGradient
          colors={color.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shared}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  const bg = variant === 'dark' ? color.ink : variant === 'outline' ? color.surface : 'transparent';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: color.border } : {};

  return (
    <PressableScale
      haptic
      scale={0.97}
      disabled={isDisabled}
      style={[{ ...shared, backgroundColor: bg, ...border }, style]}
      {...rest}
    >
      {content}
    </PressableScale>
  );
}
```

- [ ] **Step 2: Re-skin EmptyState's icon circle and text colors**

Replace the full contents of `components/ui/EmptyState.tsx`:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color } from '@/theme/tokens';
import { Button } from './Button';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'cube-outline', title, description, actionLabel, onAction }: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Ionicons name={icon} size={36} color={color.accent} />
      </View>
      <Text style={{ fontSize: 19, fontWeight: '800', color: color.ink, textAlign: 'center', marginBottom: 8 }}>{title}</Text>
      {description && (
        <Text style={{ fontSize: 14, color: color.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>{description}</Text>
      )}
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} size="md" />}
    </View>
  );
}
```

(Dropped the `text-xl`/`className`-based NativeWind styling in favor of the same inline-token approach as `Button`/`Badge` — kept for the same reason: nothing here needs NativeWind's layout utilities specifically, and inline styles keep this tiny file self-consistent with its sibling primitives.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Visual check**

Launch the app (`npx expo start`, open in a simulator or Expo Go) and view the Cart tab's empty state (remove all items, or check on a fresh account) — confirm the icon circle uses the accent-soft tint and the action button renders as a pill.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Button.tsx components/ui/EmptyState.tsx
git commit -m "Rebuild Button as a pill with gradient primary variant; re-skin EmptyState"
```

---

## Task 3: Build IconButton

**Files:**
- Create: `components/ui/IconButton.tsx`

**Interfaces:**
- Consumes: `color`, `shadow` from `theme/tokens.ts`; `PressableScale`.
- Produces: `IconButton` component — `{ icon: keyof typeof Ionicons.glyphMap; onPress: () => void; size?: number; iconSize?: number; variant?: 'light' | 'dark'; badge?: number; style?: ViewStyle }`. `variant='light'` (default) is a white circle with an ink icon (back/search/wishlist on light imagery); `variant='dark'` is a translucent-black circle with a white icon (for icon buttons floating over photos, e.g. product-detail back button). `badge`, when a positive number, draws a small accent count bubble top-right (mirrors the current tab-bar cart-count badge pattern).

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, shadow } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  variant?: 'light' | 'dark';
  badge?: number;
  style?: ViewStyle;
}

export function IconButton({ icon, onPress, size = 42, iconSize = 19, variant = 'light', badge, style }: Props) {
  const isLight = variant === 'light';
  return (
    <PressableScale
      haptic
      scale={0.92}
      onPress={onPress}
      hitSlop={8}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isLight ? color.surface : 'rgba(20,20,20,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        isLight ? shadow.card : undefined,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={isLight ? color.ink : color.onInk} />
      {typeof badge === 'number' && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: color.accent,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
            borderWidth: 1.5,
            borderColor: color.bg,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </PressableScale>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors. (Not yet used anywhere — this task only builds it; consumers land in Tasks 11, 14, 15, 16.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/IconButton.tsx
git commit -m "Add IconButton — floating circular icon action"
```

---

## Task 4: Rebuild Input as a borderless pill field

**Files:**
- Modify: `components/ui/Input.tsx`

**Interfaces:**
- Consumes: `color`, `radius` from `theme/tokens.ts`.
- Produces: `Input` — same public API as before (`label`, `error`, `leftIcon`, `rightIcon`, `onRightIconPress`, `isPassword`, plus `TextInputProps`, forwardRef to `TextInput`). No interface change — every existing call site (`checkout.tsx`, `account.tsx`, `login.tsx`, `FilterSheet.tsx`, etc.) keeps compiling unchanged.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `components/ui/Input.tsx`:

```tsx
import React, { useState, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius } from '@/theme/tokens';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, leftIcon, rightIcon, onRightIconPress, isPassword, style, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error ? color.danger : focused ? color.accent : 'transparent';

  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '600', color: color.inkMuted, marginBottom: 6 }}>{label}</Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: color.surface,
          borderRadius: radius.full,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: 16,
          minHeight: 50,
        }}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={focused ? color.accent : color.inkFaint}
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          ref={ref}
          style={[{ flex: 1, fontSize: 14, color: color.ink, paddingVertical: 12 }, style]}
          placeholderTextColor={color.inkFaint}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={color.inkFaint}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} hitSlop={8}>
            <Ionicons name={rightIcon} size={18} color={color.inkFaint} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && (
        <Text style={{ fontSize: 12, color: color.danger, marginTop: 4, marginLeft: 4 }}>{error}</Text>
      )}
    </View>
  );
});
```

Note: `radius.full` (999) on a ~50px-tall field with multi-line or very long labels reads as a stadium/pill shape, matching the reference screens' shipping-form fields exactly.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Visual check**

Open the Filter sheet from the Shop tab (still using the old-style bordered fields around it until Task 13, but the Min/Max price fields inside it use plain `TextInput`, not this `Input` — the first real consumer to eyeball is `app/(auth)/login.tsx`, which is out of scope but still imports `Input` and will render it pill-shaped; open the login screen to confirm it still renders correctly even though its own visual redesign is deferred).

- [ ] **Step 4: Commit**

```bash
git add components/ui/Input.tsx
git commit -m "Rebuild Input as a borderless pill field"
```

---

## Task 5: Build Card

**Files:**
- Create: `components/ui/Card.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `shadow`, `spacing` from `theme/tokens.ts`.
- Produces: `Card` — `{ children: React.ReactNode; style?: ViewStyle; padded?: boolean }`. `padded` (default `true`) applies `spacing.lg` internal padding; pass `false` for cards that manage their own internal padding per-row (e.g. a card that's just a list of divided rows).

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { color, radius, shadow, spacing } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

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

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Card.tsx
git commit -m "Add Card — generic enclosed surface for list rows and info blocks"
```

---

## Task 6: Build QuantityStepper

**Files:**
- Create: `components/ui/QuantityStepper.tsx`

**Interfaces:**
- Consumes: `color`, `radius` from `theme/tokens.ts`; `PressableScale`.
- Produces: `clampQuantity(current: number, delta: number, max: number): number` (pure function, exported for the one place — `Task 16`'s `cart.tsx` — that needs to reason about the resulting quantity before calling the store). `QuantityStepper` component — `{ quantity: number; max: number; onDecrement: () => void; onIncrement: () => void }`. Mirrors the exact behavior currently inlined in `app/(tabs)/cart.tsx`'s `CartItemRow` (decrement button shows a trash icon when `quantity === 1`, increment button disables at `max`) — this task only extracts and re-skins it; Task 16 deletes the inline version and wires this one in.

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

export function clampQuantity(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(current + delta, max));
}

interface Props {
  quantity: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
}

export function QuantityStepper({ quantity, max, onDecrement, onIncrement }: Props) {
  const atMax = quantity >= max;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color.surfaceSunken,
        borderRadius: radius.full,
        overflow: 'hidden',
      }}
    >
      <PressableScale haptic onPress={onDecrement} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons
          name={quantity === 1 ? 'trash-outline' : 'remove'}
          size={15}
          color={quantity === 1 ? color.danger : color.ink}
        />
      </PressableScale>
      <Text style={{ fontSize: 13, fontWeight: '800', color: color.ink, width: 28, textAlign: 'center' }}>
        {quantity}
      </Text>
      <PressableScale
        haptic
        onPress={onIncrement}
        disabled={atMax}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: atMax ? color.border : color.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="add" size={15} color={atMax ? color.inkFaint : '#fff'} />
      </PressableScale>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/QuantityStepper.tsx
git commit -m "Add QuantityStepper, extracted from cart's inline implementation"
```

---

## Task 7: Build ProgressStepper

**Files:**
- Create: `components/ui/ProgressStepper.tsx`

**Interfaces:**
- Consumes: `color` from `theme/tokens.ts`.
- Produces: `ProgressStepper` — `{ steps: { label: string; icon: keyof typeof Ionicons.glyphMap }[]; currentStep: number }`, `currentStep` is 1-indexed, matching `checkout.tsx`'s existing `type Step = 1 | 2` state. Step `i` (1-indexed) renders: accent-filled circle with `icon` when `i === currentStep`; grey circle with a checkmark when `i < currentStep`; grey circle with `icon` (muted) when `i > currentStep`. A dotted line connects consecutive step circles.

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color } from '@/theme/tokens';

interface Step {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  steps: Step[];
  currentStep: number;
}

export function ProgressStepper({ steps, currentStep }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {steps.map((step, i) => {
        const n = i + 1;
        const done = n < currentStep;
        const active = n === currentStep;
        return (
          <React.Fragment key={step.label}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? color.accent : color.surfaceSunken,
                }}
              >
                <Ionicons
                  name={done ? 'checkmark' : step.icon}
                  size={16}
                  color={active ? color.onAccent : done ? color.ink : color.inkFaint}
                />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: active || done ? color.ink : color.inkFaint }}>
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 0,
                  borderTopWidth: 2,
                  borderStyle: 'dotted',
                  borderTopColor: n < currentStep ? color.accent : color.border,
                  marginHorizontal: 8,
                  marginBottom: 18,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/ProgressStepper.tsx
git commit -m "Add ProgressStepper — dotted-line checkout step indicator"
```

---

## Task 8: Build the floating pill TabBar and wire it into the tabs layout

**Files:**
- Create: `components/navigation/TabBar.tsx`
- Modify: `app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `shadow` from `theme/tokens.ts`; `useCartStore` (unchanged, `store/cart.ts`); `Tabs`, `TabList`, `TabTrigger`, `TabSlot` from `expo-router/ui`, and `TabTriggerSlotProps` type from `expo-router/ui` (confirmed exported — `TabTrigger.d.ts` defines and `ui.d.ts` does `export * from './build/ui'`, which re-exports `TabTrigger.ts` fully via `export * from './TabTrigger'` in `Tabs.d.ts`).
- Produces: `TAB_BAR_HEIGHT: number`, `useTabBarClearance(): number` (returns the bottom padding a scrollable tab screen needs so its last content isn't hidden behind the floating bar — `insets.bottom + 12 + TAB_BAR_HEIGHT`), `TabButton` and `CartTabButton` components (both used only inside `_layout.tsx` via `TabTrigger asChild`). Tasks 11, 12, 16, 19 (Home/Shop/Cart/Account) consume `useTabBarClearance()`.

- [ ] **Step 1: Write the TabBar file**

```tsx
import React from 'react';
import { View, Text, Pressable, type View as RNView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { color, shadow } from '@/theme/tokens';
import { useCartStore } from '@/store/cart';

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_FAB_SIZE = 56;

export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + 12 + TAB_BAR_HEIGHT;
}

interface TabButtonProps extends TabTriggerSlotProps {
  iconOn: keyof typeof Ionicons.glyphMap;
  iconOff: keyof typeof Ionicons.glyphMap;
  label: string;
}

export const TabButton = React.forwardRef<RNView, TabButtonProps>(function TabButton(
  { isFocused, iconOn, iconOff, label, ...props },
  ref
) {
  return (
    <Pressable
      ref={ref}
      {...props}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: TAB_BAR_HEIGHT }}
    >
      <Ionicons name={isFocused ? iconOn : iconOff} size={22} color={isFocused ? color.onInk : 'rgba(255,255,255,0.45)'} />
      <Text style={{ fontSize: 10, fontWeight: '600', color: isFocused ? color.onInk : 'rgba(255,255,255,0.45)' }}>
        {label}
      </Text>
    </Pressable>
  );
});

export const CartTabButton = React.forwardRef<RNView, TabTriggerSlotProps>(function CartTabButton(
  { isFocused, ...props },
  ref
) {
  const itemCount = useCartStore((s) => s.itemCount());
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        ref={ref}
        {...props}
        style={{
          position: 'absolute',
          bottom: TAB_BAR_HEIGHT - TAB_BAR_FAB_SIZE / 2 - 4,
          width: TAB_BAR_FAB_SIZE,
          height: TAB_BAR_FAB_SIZE,
          borderRadius: TAB_BAR_FAB_SIZE / 2,
          backgroundColor: color.ink,
          borderWidth: 4,
          borderColor: color.bg,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.card,
        }}
      >
        <Ionicons name={isFocused ? 'bag' : 'bag-outline'} size={22} color={color.onInk} />
        {itemCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: color.accent,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
              borderWidth: 1.5,
              borderColor: color.bg,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
              {itemCount > 99 ? '99+' : itemCount}
            </Text>
          </View>
        )}
      </Pressable>
      <Text style={{ position: 'absolute', bottom: 6, fontSize: 10, fontWeight: '700', color: color.accent }}>
        Cart
      </Text>
    </View>
  );
});
```

- [ ] **Step 2: Replace the tabs layout**

Replace the full contents of `app/(tabs)/_layout.tsx`:

```tsx
import React from 'react';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, shadow } from '@/theme/tokens';
import { TabButton, CartTabButton, TAB_BAR_HEIGHT } from '@/components/navigation/TabBar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 12,
          height: TAB_BAR_HEIGHT,
          backgroundColor: color.ink,
          borderRadius: radius.full,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 6,
          ...shadow.card,
        }}
      >
        <TabTrigger name="index" href="/" asChild>
          <TabButton iconOn="home" iconOff="home-outline" label="Home" />
        </TabTrigger>
        <TabTrigger name="shop" href="/shop" asChild>
          <TabButton iconOn="grid" iconOff="grid-outline" label="Shop" />
        </TabTrigger>
        <TabTrigger name="cart" href="/cart" asChild>
          <CartTabButton />
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <TabButton iconOn="person" iconOff="person-outline" label="Account" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
```

This fully replaces the old `<Tabs screenOptions={...}><Tabs.Screen .../>...</Tabs>` structure — route registration now happens via the four `TabTrigger`s themselves rather than `Tabs.Screen`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors. If `TabTriggerSlotProps` fails to resolve from `'expo-router/ui'`, run `grep -n "TabTriggerSlotProps" node_modules/expo-router/build/ui/TabTrigger.d.ts` to confirm the exact export name hasn't changed in the installed version before adjusting the import.

- [ ] **Step 4: Visual check**

Launch the app and confirm: the four tabs render inside a floating black pill near the bottom, Cart renders as a raised black circle above the bar line with the live cart-item-count badge, tapping each tab navigates and updates the focused icon/label color, and screen content isn't clipped by the system home-indicator area.

- [ ] **Step 5: Commit**

```bash
git add components/navigation/TabBar.tsx app/\(tabs\)/_layout.tsx
git commit -m "Replace stock tab bar with a floating pill bar and raised cart FAB"
```

---

## Task 9: Redesign Onboarding

**Files:**
- Modify: `app/onboarding.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `type` from `theme/tokens.ts` (Task 1); `Button` (Task 2).
- Produces: nothing new (leaf screen).

- [ ] **Step 1: Replace the illustration block and CTA**

In `app/onboarding.tsx`, the illustration `View` (currently lines 60–68, the `color.accent`-filled rounded square) stays conceptually the same — accent-filled rounded card with a centered icon — but drops its glow shadow in favor of the shared `shadow.card`-style presence and the flattened radius scale. Replace lines 58–110 (the "Illustration" through "CTA" sections) with:

```tsx
      {/* Illustration */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <View style={{
          width: 220, height: 260, borderRadius: radius['2xl'],
          backgroundColor: color.accent,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={slide.icon} size={92} color={color.onAccent} />
        </View>
      </View>

      {/* Copy */}
      <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
        <Text style={{ ...t.display, textAlign: 'center' }}>
          {slide.title}
        </Text>
        <Text style={{ fontSize: 15, color: color.inkMuted, textAlign: 'center', lineHeight: 22, marginTop: spacing.md }}>
          {slide.body}
        </Text>
      </View>

      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.xl }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 22 : 7,
              height: 7,
              borderRadius: radius.full,
              backgroundColor: i === index ? color.accent : color.border,
            }}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) }}>
        <Button
          title={isLast ? 'Start shopping' : 'Next'}
          onPress={next}
          fullWidth
          size="lg"
          icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
        />
      </View>
```

Also update the import line (currently `import { color, radius, spacing } from '@/theme/tokens';`) to include the `type` presets, aliased to `t` — matching the convention every other consumer of this export already uses (`ProductCard.tsx`, `app/(tabs)/index.tsx`) specifically to avoid the reserved-word-shaped `type` binding name:

```tsx
import { color, radius, spacing, type as t } from '@/theme/tokens';
```

And add the `Button` import alongside the existing ones:

```tsx
import { Button } from '@/components/ui/Button';
```

Note: `Button`'s `icon` prop renders to the *left* of the title (see Task 2's implementation), matching the reference's forward-arrow-trailing convention closely enough — this is a cosmetic simplification worth calling out, not a functional gap.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Visual check**

Clear the app's onboarding-seen flag (uninstall/reinstall the dev build, or temporarily call `AsyncStorage.removeItem('litways-onboarded')` from a debug action) and confirm the two onboarding slides render with the new token values and a pill "Next"/"Start shopping" button.

- [ ] **Step 4: Commit**

```bash
git add app/onboarding.tsx
git commit -m "Re-skin onboarding to the new design tokens"
```

---

## Task 10: Redesign ProductCard as borderless, and match its skeleton

**Files:**
- Modify: `components/shop/ProductCard.tsx`
- Modify: `components/ui/SkeletonLoader.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `type` from `theme/tokens.ts`.
- Produces: `ProductCard` keeps its exact current public API — `{ product: Product; width?: number; variant?: 'grid' | 'horizontal' }` — Home (`variant="horizontal"`, `width={172}`), Shop, and Category (`variant` defaulted, no `width`) all keep compiling unchanged; only Task 11–14 need to *look* at the new rendered result, not touch call sites. `ProductCardSkeleton` and `ProductGridSkeleton` (from `SkeletonLoader.tsx`) keep their existing exported names/signatures — only their internal dimensions/colors change to match the borderless card.

- [ ] **Step 1: Rewrite ProductCard's outer wrapper and info block**

In `components/shop/ProductCard.tsx`, replace the `return (...)` block (from `return (` through the closing `</PressableScale>` — i.e. lines 65–235) with:

```tsx
  return (
    <PressableScale
      haptic
      scale={0.97}
      onPress={() => router.push(`/product/${product.slug}`)}
      style={{
        width: width ?? (isHorizontal ? 172 : undefined),
        alignSelf: width || isHorizontal ? 'auto' : 'stretch',
      }}
    >
      {/* Image — the card IS the image now, no enclosing box */}
      <Animated.View
        sharedTransitionTag={`product-image-${product.id}`}
        style={{ position: 'relative', height: imageHeight, borderRadius: radius.lg, overflow: 'hidden' }}
      >
        <Image
          source={{ uri: imageUrl ?? undefined }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        />

        {hasDiscount && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: color.accent,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ color: color.onAccent, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
              -{discount}%
            </Text>
          </View>
        )}

        {!inStock && (
          <View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <View style={{ backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>SOLD OUT</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={handleWishlist}
          hitSlop={8}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.95)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={15}
            color={isWishlisted ? '#ef4444' : color.inkMuted}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Caption — sits directly on the grey canvas, no card box */}
      <View style={{ paddingTop: 8, paddingHorizontal: 2 }}>
        <Text numberOfLines={1} style={{ ...type.overline, marginBottom: 3 }}>
          {product.brand ?? '—'}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: color.ink, lineHeight: 18, marginBottom: 4 }}>
          {product.name}
        </Text>
        {rating > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Ionicons name="star" size={12} color={color.star} />
            <Text style={{ fontSize: 11, color: color.inkMuted, fontWeight: '600', marginLeft: 4 }}>
              {rating.toFixed(1)}
              {reviewCount > 0 ? ` · ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : ''}
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 16, fontWeight: '800', color: color.accent, letterSpacing: -0.2 }}>
          {formatCurrency(displayPrice)}
          {hasDiscount && (
            <Text style={{ fontSize: 12, fontWeight: '500', color: color.inkFaint, textDecorationLine: 'line-through' }}>
              {'  '}{formatCurrency(product.price!)}
            </Text>
          )}
        </Text>
      </View>
    </PressableScale>
  );
});
```

This drops the previous `shadow.card` white box around the whole card and its inline "Add to cart" pill under every grid item — the reference screens' listing cards are tap-to-detail only, with add-to-cart happening on the product page (Task 15) and cart page, not from the grid. If a fast add-to-cart-from-grid affordance turns out to be missed in review, it can be reintroduced as a small floating `IconButton` over the image rather than the old full-width button — flag to the user rather than silently dropping the feature.

Also remove the now-unused `Colors` import (`import { Colors } from '@/constants/Colors';`) and the `useCartStore`/`addItem`/`handleAddToCart` logic (lines 11, 25, 50–61 in the original) since the add-to-cart button no longer renders here — but leave the `useWishlistStore` wishlist toggle exactly as-is.

- [ ] **Step 2: Update the skeletons to match**

In `components/ui/SkeletonLoader.tsx`, replace `ProductCardSkeleton` and `ProductGridSkeleton`:

```tsx
export function ProductCardSkeleton() {
  return (
    <View style={{ width: 172, marginRight: 12 }}>
      <SkeletonBlock height={185} borderRadius={16} />
      <View style={{ paddingTop: 8, gap: 6 }}>
        <SkeletonBlock height={10} width="50%" borderRadius={5} />
        <SkeletonBlock height={13} borderRadius={6} />
        <SkeletonBlock height={16} width="40%" borderRadius={6} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: '50%', padding: 6 }}>
          <SkeletonBlock height={190} borderRadius={16} />
          <View style={{ paddingTop: 8, gap: 6 }}>
            <SkeletonBlock height={10} width="45%" borderRadius={5} />
            <SkeletonBlock height={13} borderRadius={6} />
            <SkeletonBlock height={13} width="70%" borderRadius={6} />
            <SkeletonBlock height={16} width="35%" borderRadius={6} style={{ marginTop: 2 }} />
          </View>
        </View>
      ))}
    </>
  );
}
```

Also change `SkeletonBlock`'s default placeholder fill (in the same file, the `backgroundColor: '#e5e7eb'` on the outer `View` and the `['#e5e7eb', '#f3f4f6', '#e5e7eb']` gradient) to use the new sunken-surface tone: `backgroundColor: '#e2e2e2'` and gradient `['#e2e2e2', '#ececec', '#e2e2e2']`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Visual check**

Open the Shop tab (still on its old screen chrome until Task 12, but already rendering the new `ProductCard` grid) and confirm cards now show as a rounded image with the name/price directly below on the grey background, no white box or shadow around the whole card.

- [ ] **Step 5: Commit**

```bash
git add components/shop/ProductCard.tsx components/ui/SkeletonLoader.tsx
git commit -m "Make ProductCard borderless and match its loading skeletons"
```

---

## Task 11: Redesign Home

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `gutter`, `shadow`, `type` (Task 1); `IconButton` (Task 3); `useTabBarClearance` (Task 8); `ProductCard` (Task 10, unchanged call sites); `Button` (Task 2, for the hero CTA).

- [ ] **Step 1: Update the header's search field and add clearance padding**

In `app/(tabs)/index.tsx`, add the `IconButton` and `useTabBarClearance` imports:

```tsx
import { IconButton } from '@/components/ui/IconButton';
import { useTabBarClearance } from '@/components/navigation/TabBar';
```

Replace the "Help" `TouchableOpacity` (lines 135–147) with an `IconButton`:

```tsx
          <IconButton icon="help-circle-outline" onPress={() => router.push('/contact')} />
```

Replace the search `TouchableOpacity` (lines 151–166) so it floats as its own pill with a shadow, matching the reference's floating search bar rather than sitting flush inside the header:

```tsx
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/shop')}
          activeOpacity={0.7}
          style={{
            marginTop: spacing.md,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: color.surface,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            height: 48,
            gap: spacing.sm,
            ...shadow.card,
          }}
        >
          <Ionicons name="search" size={19} color={color.inkMuted} />
          <Text style={{ ...t.body, color: color.inkMuted, flex: 1 }}>Search for anything…</Text>
        </TouchableOpacity>
```

Add `useTabBarClearance` inside the component body (near the other hooks, after `const [refreshing, setRefreshing] = useState(false);`):

```tsx
  const tabBarClearance = useTabBarClearance();
```

And update the `ScrollView`'s `contentContainerStyle` (currently `{ paddingBottom: spacing['2xl'] }`) so the floating tab bar never overlaps the last section:

```tsx
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
```

- [ ] **Step 2: Make the hero CTA a dark pill**

The hero's "Start shopping" pill (lines 211–214) currently renders white-on-image, which doesn't match the reference's black "Get it now"/"Shop Now" hero CTA. It's a decorative pill (the whole hero already has its own `onPress` via the outer `PressableScale`, so this inner element isn't its own separate touch target) — recolor it in place rather than introducing a nested pressable:

```tsx
              <View style={{ alignSelf: 'flex-start', backgroundColor: color.ink, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ color: color.onInk, fontWeight: '800', fontSize: 13 }}>Start shopping</Text>
                <Ionicons name="arrow-forward" size={15} color={color.onInk} />
              </View>
```

- [ ] **Step 3: Re-skin the deals banner's CTA**

The "Deals on now" block (lines 274–290) already uses token colors; change its container `backgroundColor: color.text` to `color.ink` (same value, canonical name) — no other change needed there.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Visual check**

Launch the app on the Home tab: confirm the search field now floats with a shadow below the header, the hero CTA and Help icon are dark/circular respectively, product cards render borderless (from Task 10), and scrolling to the bottom shows the "See all products" button fully clear of the floating tab bar.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "Re-skin Home: floating search pill, IconButton, tab-bar clearance"
```

---

## Task 12: Redesign Shop / Search

**Files:**
- Modify: `app/(tabs)/shop.tsx`

**Interfaces:**
- Consumes: `color`, `radius` (Task 1); `useTabBarClearance` (Task 8). The search bar stays a bespoke inline field (not the shared `Input`) — it's a compact live-search-with-inline-clear pattern embedded in a header, not a labeled form field, so `Input`'s label/wrapper assumptions don't fit; only its colors/radius are re-skinned. The filter button stays bespoke too — it toggles between an accent-filled "active" state and a muted "idle" state with a count badge, which doesn't map onto `IconButton`'s `light`/`dark` variant pair without stretching that component's scope for one caller.

- [ ] **Step 1: Replace the header block (search bar, filter button, sort pills)**

Replace lines 144–243:

```tsx
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />

      {/* ─── Header ─── */}
      <View style={{
        backgroundColor: color.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 14,
        ...shadow.header,
      }}>
        {/* Search + Filter row */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: color.surfaceSunken,
            borderRadius: radius.full,
            paddingHorizontal: 14,
            height: 46,
            gap: 8,
          }}>
            <Ionicons name="search-outline" size={17} color={color.inkFaint} />
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              onFocus={handleFocus}
              onBlur={() => setTimeout(() => setShowRecent(false), 150)}
              onSubmitEditing={() => handleCommitSearch()}
              returnKeyType="search"
              placeholder="Search products, brands..."
              placeholderTextColor={color.inkFaint}
              style={{ flex: 1, fontSize: 14, color: color.ink }}
            />
            {inputValue.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={color.inkFaint} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            style={{
              width: 46, height: 46,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeFilterCount > 0 ? color.accent : color.surfaceSunken,
            }}
          >
            <Ionicons name="options-outline" size={19} color={activeFilterCount > 0 ? '#fff' : color.inkMuted} />
            {activeFilterCount > 0 && (
              <View style={{
                position: 'absolute', top: 6, right: 6,
                width: 14, height: 14,
                backgroundColor: '#fff',
                borderRadius: 7,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: color.accent, fontSize: 8, fontWeight: '800' }}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Sort pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSort(opt.value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: sort === opt.value ? color.accent : color.surface,
                borderWidth: 1,
                borderColor: sort === opt.value ? color.accent : color.border,
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: sort === opt.value ? '#fff' : color.inkMuted,
              }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recent searches dropdown */}
      {showRecent && recentSearches.length > 0 && !inputValue && (
        <View style={{ backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border, paddingHorizontal: 16, paddingVertical: 8, zIndex: 10 }}>
          <Text style={{ fontSize: 11, color: color.inkFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Recent searches
          </Text>
          {recentSearches.map((term) => (
            <TouchableOpacity
              key={term}
              onPress={() => handleCommitSearch(term)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}
            >
              <Ionicons name="time-outline" size={15} color={color.inkFaint} />
              <Text style={{ fontSize: 14, color: color.ink, flex: 1 }}>{term}</Text>
              <Ionicons name="arrow-up-outline" size={14} color={color.inkFaint} style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border, maxHeight: 46 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 6, alignItems: 'center' }}
        >
          {filters.brands?.map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => setFilters((f) => ({ ...f, brands: f.brands?.filter((x) => x !== b) }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text style={{ fontSize: 12, color: color.accentPressed, fontWeight: '600' }}>{b}</Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          ))}
          {filters.sizes?.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilters((f) => ({ ...f, sizes: f.sizes?.filter((x) => x !== s) }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text style={{ fontSize: 12, color: color.accentPressed, fontWeight: '600' }}>Size {s}</Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          ))}
          {(filters.minPrice != null || filters.maxPrice != null) && (
            <TouchableOpacity
              onPress={() => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text style={{ fontSize: 12, color: color.accentPressed, fontWeight: '600' }}>
                ${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'}
              </Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setFilters({})}
            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#fee2e2' }}
          >
            <Text style={{ fontSize: 12, color: '#b91c1c', fontWeight: '700' }}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Result count bar */}
      {!isLoading && products.length > 0 && (
        <View style={{ backgroundColor: color.surface, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: color.inkMuted, fontWeight: '500' }}>
            {query ? (
              <Text><Text style={{ fontWeight: '700', color: color.ink }}>{products.length}</Text> results for "<Text style={{ fontWeight: '700', color: color.accent }}>{query}</Text>"</Text>
            ) : (
              <Text><Text style={{ fontWeight: '700', color: color.ink }}>{products.length}</Text> products</Text>
            )}
          </Text>
          {isFetching && !isFetchingNextPage && <ActivityIndicator size="small" color={color.accent} />}
        </View>
      )}
```

Note the "Clear all" filter-reset chip's colors intentionally stay literal (`#fee2e2`/`#b91c1c`) rather than being routed through a token — this matches the same literal danger-tint pattern used in `Badge`'s `error` variant (Task 19) and `product/[slug].tsx`'s out-of-stock badge (Task 15); there's no `color.dangerSoft` token and inventing one for two call sites isn't worth it.

- [ ] **Step 2: Re-skin the results list and add tab-bar clearance**

Replace lines 327–363 (from the "Results" comment through the closing `)}` before `<FilterSheet`):

```tsx
      {/* Results */}
      {isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 10 }}>
          <ProductGridSkeleton count={6} />
        </View>
      ) : !products.length ? (
        <EmptyState
          icon="search-outline"
          title="No products found"
          description={query ? `No results for "${query}".` : 'No products match your filters.'}
          actionLabel="Clear filters"
          onAction={() => { handleClear(); setFilters({}); }}
        />
      ) : (
        <FlashList
          data={products}
          numColumns={2}
          estimatedItemSize={290}
          keyExtractor={(item) => item.id ?? ''}
          contentContainerStyle={{ padding: 10, paddingBottom: tabBarClearance }}
          renderItem={({ item }) => (
            <View style={{ flex: 1, margin: 5 }}>
              <ProductCard product={item} />
            </View>
          )}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={color.accent} />
                <Text style={{ fontSize: 12, color: color.inkFaint, marginTop: 6 }}>Loading more...</Text>
              </View>
            ) : null
          }
        />
      )}
```

Add `const tabBarClearance = useTabBarClearance();` inside the component body, near the other `useState`/`useRef` declarations at the top of `ShopScreen`.

- [ ] **Step 3: Update imports**

Replace `import { Colors } from '@/constants/Colors';` with `import { color, radius, shadow } from '@/theme/tokens';`, and add `import { useTabBarClearance } from '@/components/navigation/TabBar';`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Visual check**

Open the Shop tab: confirm the search field and filter button are pill-shaped on the sunken-grey fill, sort/active-filter chips are pill-shaped, and the product grid scrolls fully clear of the floating tab bar.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/shop.tsx
git commit -m "Re-skin Shop/Search screen chrome to the new design tokens"
```

---

## Task 13: Redesign FilterSheet

**Files:**
- Modify: `components/shop/FilterSheet.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `type` (Task 1); `Card` (Task 5, for the sheet's price-range block); `Button` (Task 2, unchanged call already present at line 245).

- [ ] **Step 1: Replace the Colors import and header close icon color**

Replace `import { Colors } from '@/constants/Colors';` with `import { color, radius } from '@/theme/tokens';`, and update line 150 (`<Ionicons name="close" size={22} color={Colors.gray[600]} />`) to `color={color.inkMuted}`, and line 169/183 (`placeholderTextColor={Colors.gray[300]}`) to `color.inkFaint`.

- [ ] **Step 2: Re-skin the brand/size chip toggles**

Replace the brand-chip `className` (line 204, currently `` `px-4 py-2 rounded-xl border-2 ${selected ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-200'}` ``) with a pill shape:

```tsx
                      className={`px-4 py-2 rounded-full border-2 ${selected ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-200'}`}
```

Apply the same `rounded-xl` → `rounded-full` change to the size-chip `className` at line 228. (NativeWind's `rounded-full` already maps to a large enough radius to read as a pill at these chip sizes — no need to route this through the `radius` token, since NativeWind classes are the established pattern in this specific file and the spec's token migration is about *color* decisions flowing from one place, not banning NativeWind's own radius utilities.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Visual check**

Open the Filter sheet from Shop: confirm brand/size chips are now fully pill-shaped and the close icon/placeholder text use the new ink tones.

- [ ] **Step 5: Commit**

```bash
git add components/shop/FilterSheet.tsx
git commit -m "Re-skin FilterSheet chips to pill shape and new tokens"
```

---

## Task 14: Redesign Category grid

**Files:**
- Modify: `app/category/[slug].tsx`

**Interfaces:**
- Consumes: `color`, `spacing` (Task 1); `IconButton` (Task 3); `ProductCard` (Task 10, unchanged call site).

- [ ] **Step 1: Replace the header**

Replace the header `View` (lines 52–63) — currently a white bar with a bordered bottom and a plain `TouchableOpacity` back arrow:

```tsx
      <View
        style={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: color.ink, flex: 1 }} numberOfLines={1}>
          {categoryName ?? 'Category'}
        </Text>
        {isFetching && !isLoading && <ActivityIndicator size="small" color={Colors.primary[500]} />}
      </View>
```

Change the screen's root `View`'s NativeWind class from `className="flex-1 bg-gray-50"` to a plain `style={{ flex: 1, backgroundColor: color.bg }}` (dropping the `className` on this root element only — everywhere else in the file that still uses `bg-gray-50`/`text-gray-900` NativeWind utilities is untouched by this task, since those don't clash visually with the new grey canvas value closely enough to require a change here; `color.bg` (`#ececec`) vs NativeWind's `gray-50` (`#f9fafb`) is the one visible seam worth fixing on the root canvas specifically).

Add the import: `import { IconButton } from '@/components/ui/IconButton';` and `import { color } from '@/theme/tokens';`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Visual check**

Tap into any category from Home: confirm the back button is a circular `IconButton`, the canvas is the new warm grey, and the product grid (already borderless from Task 10) renders correctly.

- [ ] **Step 4: Commit**

```bash
git add app/category/\[slug\].tsx
git commit -m "Re-skin Category header with IconButton and the new canvas color"
```

---

## Task 15: Redesign Product Detail

**Files:**
- Modify: `app/product/[slug].tsx`

**Interfaces:**
- Consumes: `color`, `radius` (Task 1); `IconButton` (Task 3, for the back/share buttons only — see Step 1).
- The sticky "Add to Cart" button is **not** routed through the shared `Button` (Task 2): it has three visual states (`accent` default / `success`-green "Added!" flash / muted disabled "Out of Stock") plus a secondary price line under the label, which exceeds `Button`'s current single-line/loading/disabled API. Extending `Button` for this one caller would be scope creep; it stays a bespoke element, re-skinned to tokens.

- [ ] **Step 1: Replace the floating nav bar — back/share become IconButton, wishlist stays bespoke**

Replace lines 156–181. The wishlist button keeps its own markup (unlike back/share, its icon color flips between white and pink based on `wishlisted`, which `IconButton` doesn't parameterize):

```tsx
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          zIndex: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
        }}
      >
        <IconButton icon="arrow-back" variant="dark" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="share-outline" variant="dark" onPress={handleShare} />
          <PressableScale haptic onPress={handleWishlist} style={navBtnStyle}>
            <Ionicons
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={20}
              color={wishlisted ? '#fca5a5' : '#fff'}
            />
          </PressableScale>
        </View>
      </View>
```

- [ ] **Step 2: Re-skin the discount and low-stock badges to accent tokens**

Replace line 231's discount badge color (currently `backgroundColor: '#ef4444'`) with `backgroundColor: color.accent` — matching `ProductCard`'s already-migrated discount badge (Task 10), which uses the same accent treatment rather than red.

Replace line 297's low-stock badge colors (`backgroundColor: '#fff7ed'`, text `color: '#ea580c'`) with `backgroundColor: color.accentSoft` and `color: color.accent` — same visual result, now token-sourced. Leave the out-of-stock badge (line 292, `#fee2e2`/`#dc2626`) as literal — it matches the same danger-tint literal used in `Badge`'s `error` variant (Task 19).

- [ ] **Step 3: Re-skin the thumbnail strip and text colors**

Line 269, active-thumbnail border: `Colors.primary[600]` → `color.accent`; inactive: `'#e5e7eb'` → `color.border`.

Line 287, brand label: `Colors.gray[400]` → `color.inkMuted`. Line 304, product name: `'#111827'` → `color.ink`.

- [ ] **Step 4: Re-skin the rating bar, price block, and reviews**

Lines 313, 456–457, 469 (star colors): `Colors.warning` → `color.star`, `Colors.gray[200]` → `color.surfaceSunken`. Line 316: `'#111827'` → `color.ink`. Line 317, 472: `Colors.gray[400]` → `color.inkFaint`.

Replace the price block (lines 322–336):

```tsx
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 20, backgroundColor: color.accentSoft, borderRadius: 14, padding: 14 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: color.accent }}>
              {formatCurrency(displayPrice)}
            </Text>
            {hasDiscount && (
              <View>
                <Text style={{ fontSize: 15, color: color.inkFaint, textDecorationLine: 'line-through', lineHeight: 20 }}>
                  {formatCurrency(product.price!)}
                </Text>
                <Text style={{ fontSize: 12, color: color.danger, fontWeight: '700' }}>
                  You save {formatCurrency(product.price! - displayPrice)}
                </Text>
              </View>
            )}
          </View>
```

Lines 343, 345, 378, 417 (accent text — "· selectedSize", "Size guide", "· selectedColor", "Read more"): `Colors.primary[600]` → `color.accent`. Lines 410, 478 (body copy): `'#4b5563'` → `color.inkMuted`. Line 408, 452: `'#111827'` → `color.ink`. Line 455 (`Colors.warning + '20'` review-summary chip background): `color.star + '20'`. Line 463–464 (review-avatar bg/icon): `Colors.primary[100]` → `color.accentSoft`, `Colors.primary[600]` → `color.accent`. Line 461 divider: `'#f3f4f6'` → `color.border`.

Leave the green "Delivery card" (lines 425–445) untouched — it's a distinct trust/success semantic block, not accent-branded, and Task 16's Cart trust badges are left the same way for consistency.

- [ ] **Step 5: Re-skin size/color selector chips to pills**

Replace the size-chip style block (lines 353–363):

```tsx
                    style={{
                      minWidth: 52,
                      height: 44,
                      paddingHorizontal: 14,
                      borderRadius: radius.full,
                      borderWidth: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedSize === size ? color.ink : color.surface,
                      borderColor: selectedSize === size ? color.ink : color.border,
                    }}
```

and its text color (line 365): `selectedSize === size ? '#fff' : '#374151'` → `selectedSize === size ? color.onInk : color.inkMuted`.

Apply the same shape to the color-chip block (lines 386–397): `borderRadius: radius.full`, `backgroundColor: selectedColor === color ? color.ink : color.surface`, `borderColor: selectedColor === color ? color.ink : color.border`, text `selectedColor === color ? color.onInk : color.inkMuted`.

(Note: this screen already destructures a local variable named `color` from `product.colors.map((color) => ...)` at line 381, which shadows the `color` tokens import inside that specific `.map` callback. Rename the loop variable to `colorName` — `product.colors.map((colorName) => ...)` — and use `colorName` for the key/comparison/label inside that block, so `color.ink`/`color.surface`/etc. still resolve to the token import rather than the shadowed string.)

- [ ] **Step 6: Re-skin the sticky CTA bar**

Replace lines 490–554:

```tsx
      <View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: color.surface,
          borderTopWidth: 1,
          borderTopColor: color.border,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 32 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <PressableScale
          haptic
          onPress={handleWishlist}
          style={{
            width: 48, height: 48,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: wishlisted ? '#ef4444' : color.border,
            backgroundColor: wishlisted ? '#fff1f2' : color.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={22} color={wishlisted ? '#ef4444' : color.inkMuted} />
        </PressableScale>

        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={!inStock}
          activeOpacity={0.85}
          style={{
            flex: 1,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: addedToCart ? color.success : (inStock ? color.accent : color.surfaceSunken),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons
            name={addedToCart ? 'checkmark-circle-outline' : 'bag-add-outline'}
            size={20}
            color={inStock || addedToCart ? '#fff' : color.inkFaint}
          />
          <View>
            <Text style={{ color: inStock || addedToCart ? '#fff' : color.inkFaint, fontSize: 16, fontWeight: '800' }}>
              {addedToCart ? 'Added to Cart!' : inStock ? 'Add to Cart' : 'Out of Stock'}
            </Text>
            {inStock && !addedToCart && (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>
                {formatCurrency(displayPrice)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
```

- [ ] **Step 7: Update imports**

Replace `import { Colors } from '@/constants/Colors';` with `import { color, radius } from '@/theme/tokens';`, and add `import { IconButton } from '@/components/ui/IconButton';`.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 9: Visual check**

Open any product from the Shop grid: confirm back/share are circular `IconButton`s over the image, size/color chips are pill-shaped with a black-fill selected state, price renders in the accent-tinted card, and the sticky "Add to Cart" bar is a full-width pill that flashes green on add.

- [ ] **Step 10: Commit**

```bash
git add app/product/\[slug\].tsx
git commit -m "Re-skin Product Detail: IconButtons, pill selectors, token colors"
```

---

## Task 16: Redesign Cart

**Files:**
- Modify: `app/(tabs)/cart.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `shadow`, `type` (Task 1); `Card` (Task 5); `QuantityStepper`, `clampQuantity` (Task 6); `Button` (Task 2); `IconButton` (Task 3); `useTabBarClearance` (Task 8).

- [ ] **Step 1: Replace the header and free-shipping block**

Replace lines 76–130 (the root `View` through the free-shipping progress block) — dropping the `Colors`/hardcoded-hex header styling for token-driven values and swapping the "Clear all" `TouchableOpacity` region's card background to `color.surface`/`color.bg`:

```tsx
  const tabBarClearance = useTabBarClearance();

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={{
          backgroundColor: color.surface,
          paddingHorizontal: 20,
          paddingBottom: 14,
          paddingTop: insets.top + 12,
        }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: color.ink }}>My Cart</Text>
        </View>
        <EmptyState
          icon="bag-outline"
          title="Your cart is empty"
          description="Looks like you haven't added anything yet. Start shopping!"
          actionLabel="Browse Shop"
          onAction={() => router.push('/shop')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />

      <View style={{
        backgroundColor: color.surface,
        paddingHorizontal: 20,
        paddingBottom: 14,
        paddingTop: insets.top + 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: color.ink }}>My Cart</Text>
          <Text style={{ fontSize: 13, color: color.inkMuted, marginTop: 1 }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleClearAll} hitSlop={8}>
          <Text style={{ fontSize: 13, color: color.danger, fontWeight: '600' }}>Clear all</Text>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: color.surface, marginBottom: 8, paddingHorizontal: 20, paddingVertical: 12 }}>
        {freeShipping ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, backgroundColor: '#dcfce7', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={16} color="#16a34a" />
            </View>
            <Text style={{ fontSize: 13, color: '#15803d', fontWeight: '700' }}>Free shipping unlocked!</Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 12, color: color.inkMuted, marginBottom: 6 }}>
              Add <Text style={{ fontWeight: '800', color: color.accent }}>{formatCurrency(remaining)}</Text> more for{' '}
              <Text style={{ fontWeight: '700', color: '#15803d' }}>FREE shipping</Text>
            </Text>
            <View style={{ height: 6, backgroundColor: color.surfaceSunken, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${shippingProgress}%`, backgroundColor: color.accent, borderRadius: 3 }} />
            </View>
          </View>
        )}
      </View>
```

- [ ] **Step 2: Replace the order-summary footer with Card + Button**

Replace the `FlashList`'s `ListFooterComponent` (lines 140–207) — wrapping its content in `Card` and its two action buttons in `Button`:

```tsx
        contentContainerStyle={{ padding: 12, paddingBottom: tabBarClearance }}
        renderItem={({ item }) => (
          <CartItemRow item={item} onUpdate={updateQuantity} onRemove={removeItem} />
        )}
        ListFooterComponent={
          <Card style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink, marginBottom: 14 }}>Order Summary</Text>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: color.inkMuted }}>
                  Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: color.ink }}>{formatCurrency(total)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: color.inkMuted }}>Shipping</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: freeShipping ? '#16a34a' : color.inkMuted }}>
                  {freeShipping ? 'FREE' : 'Calculated at checkout'}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: color.border, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: color.ink }}>Total</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: color.accent }}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: color.border }}>
              {[
                { icon: 'shield-checkmark-outline', label: 'Secure\nPayment' },
                { icon: 'refresh-outline', label: 'Easy\nReturns' },
                { icon: 'car-outline', label: 'Fast\nDelivery' },
              ].map((tItem) => (
                <View key={tItem.label} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={tItem.icon as any} size={18} color="#16a34a" />
                  </View>
                  <Text style={{ fontSize: 10, color: color.inkMuted, fontWeight: '600', textAlign: 'center' }}>{tItem.label}</Text>
                </View>
              ))}
            </View>

            <Button
              title={`Checkout · ${formatCurrency(total)}`}
              onPress={handleCheckout}
              variant="primary"
              fullWidth
              size="lg"
              icon={<Ionicons name="lock-closed-outline" size={18} color={color.onAccent} />}
              style={{ marginTop: 20 }}
            />
            <TouchableOpacity onPress={() => router.push('/shop')} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, color: color.inkMuted }}>Continue Shopping</Text>
            </TouchableOpacity>
          </Card>
        }
```

(Renamed the map callback's destructured `t` to `tItem` to avoid shadowing if a `type as t` import is later added to this file — not currently imported here, but worth the trivial rename for clarity since `t` is a common alias in other screens.)

- [ ] **Step 3: Replace CartItemRow's card and quantity stepper**

Replace the `CartItemRow` function body (lines 213–309) — wrapping it in `Card` and swapping its inline quantity buttons for `QuantityStepper`:

```tsx
function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (id: string, qty: number, size?: string, color?: string) => void;
  onRemove: (id: string, size?: string, color?: string) => void;
}) {
  const router = useRouter();
  return (
    <Card padded={false} style={{ padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 }}>
      <PressableScale haptic onPress={() => router.push(`/product/${item.slug}`)} style={{ borderRadius: 12, overflow: 'hidden', width: 88, height: 88, backgroundColor: color.surfaceSunken }}>
        <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      </PressableScale>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          {item.brand}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: color.ink, lineHeight: 18, marginBottom: 5 }} numberOfLines={2}>
          {item.name}
        </Text>

        {(item.size || item.color) && (
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {item.size && (
              <View style={{ backgroundColor: color.surfaceSunken, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
                <Text style={{ fontSize: 11, color: color.inkMuted, fontWeight: '600' }}>Size {item.size}</Text>
              </View>
            )}
            {item.color && (
              <View style={{ backgroundColor: color.surfaceSunken, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
                <Text style={{ fontSize: 11, color: color.inkMuted, fontWeight: '600' }}>{item.color}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: color.accent }}>
            {formatCurrency(item.price * item.quantity)}
          </Text>
          <QuantityStepper
            quantity={item.quantity}
            max={item.stock}
            onDecrement={() => onUpdate(item.productId, item.quantity - 1, item.size, item.color)}
            onIncrement={() => onUpdate(item.productId, item.quantity + 1, item.size, item.color)}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onRemove(item.productId, item.size, item.color)}
        hitSlop={10}
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} color={color.inkFaint} />
      </TouchableOpacity>
    </Card>
  );
}
```

`clampQuantity` (from Task 6) isn't actually needed inside this component — `onUpdate` already forwards raw `quantity ± 1` to the store's `updateQuantity`, which itself clamps against stock and removes at zero (confirmed in `store/cart.ts`). It's produced by Task 6 for symmetry/future use, not required here; don't force an unnecessary call to it.

- [ ] **Step 4: Update imports**

Replace `import { Colors } from '@/constants/Colors';` with `import { color, radius } from '@/theme/tokens';`, and add:

```tsx
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useTabBarClearance } from '@/components/navigation/TabBar';
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Visual check**

Add an item to the cart and open the Cart tab: confirm item rows are enclosed white cards with the new pill quantity stepper, the order-summary/checkout block is a `Card` with a gradient checkout button, and the list scrolls fully clear of the floating tab bar.

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/cart.tsx
git commit -m "Re-skin Cart: Card rows, QuantityStepper, gradient checkout button"
```

---

## Task 17: Redesign Checkout

**Files:**
- Modify: `app/checkout.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `shadow` (Task 1); `ProgressStepper` (Task 7); `Input` (Task 4, already imported); `Button` (Task 2); `IconButton` (Task 3).
- The payment-confirmation `useEffect` (lines 78–144: the realtime subscription + polling fallback + `AppState` re-check + timeout), `validateDelivery`, and `handlePlaceOrder` (lines 146–241, including the price/stock re-validation) are **unchanged by this task** — this is a visual pass only, per the Global Constraints.

- [ ] **Step 1: Replace the header's step progress with ProgressStepper**

Replace the "Step progress" block (lines 266–296) with:

```tsx
        <ProgressStepper
          steps={[
            { label: 'Delivery', icon: 'location-outline' },
            { label: 'Payment', icon: 'card-outline' },
          ]}
          currentStep={step}
        />
```

Remove the now-unused `STEPS` constant (lines 33–36) since `ProgressStepper` takes its own `steps` array directly.

- [ ] **Step 2: Replace the header container and back button**

Replace lines 246–264 (the header `View` and its back-button `TouchableOpacity`):

```tsx
      <View style={{
        backgroundColor: color.surface,
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: insets.top + 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <IconButton
            icon="arrow-back"
            onPress={() => (step === 1 ? router.back() : setStep(1))}
            style={isProcessing ? { opacity: 0.4 } : undefined}
          />
          <Text style={{ fontSize: 18, fontWeight: '800', color: color.ink }}>Checkout</Text>
        </View>
```

(`IconButton` has no built-in `disabled` prop — since this back action must stay tappable-disabled while `isProcessing`, gating it visually via reduced opacity is sufficient here; if blocking the tap itself turns out to matter in testing, wrap the `IconButton` in a `View pointerEvents={isProcessing ? 'none' : 'auto'}` rather than adding a one-off `disabled` prop to the shared component.)

- [ ] **Step 3: Re-skin the delivery-step section cards and county picker**

`SectionCard` (lines 532–554) already provides the enclosed-card wrapper this screen uses for "Contact Info"/"Delivery Address"/"Payment Method"/"Order Summary" — replace its hardcoded styling with `Card` plus the icon-badge treatment already present:

```tsx
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <View style={{ width: 32, height: 32, backgroundColor: color.accentSoft, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={16} color={color.accent} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}
```

Add the `Card` import: `import { Card } from '@/components/ui/Card';`.

Replace the county-picker's `TouchableOpacity` border/background hex literals (lines 352–366) with token equivalents: `borderColor: showCountyPicker ? color.accent : color.border`, `backgroundColor: color.surface`, and its dropdown list background/row-selected-state hex literals (lines 368–383) similarly mapped to `color.surface`/`color.accentSoft`/`color.accent`.

- [ ] **Step 4: Replace the Continue/Pay buttons**

Replace the "Continue to Payment" `TouchableOpacity` (lines 396–403) with:

```tsx
            <Button
              title="Continue to Payment"
              onPress={() => { if (validateDelivery()) setStep(2); }}
              variant="primary"
              fullWidth
              size="lg"
              icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
            />
```

Replace the "Pay" `TouchableOpacity` (lines 496–520) with:

```tsx
            <Button
              title={
                paymentStatus === 'processing' ? 'Initiating...'
                : paymentStatus === 'polling' ? 'Awaiting MoMo...'
                : `Pay ${formatCurrency(total)} with MoMo`
              }
              onPress={handlePlaceOrder}
              disabled={isProcessing}
              loading={isProcessing}
              variant="primary"
              fullWidth
              size="lg"
              icon={!isProcessing ? <Ionicons name="lock-closed" size={18} color={color.onAccent} /> : undefined}
            />
```

- [ ] **Step 5: Update remaining literal colors to tokens**

Replace the remaining `Colors.*`/hardcoded-hex references in this file (the `#f3f4f6` root background, `Colors.gray[...]` text colors on the summary rows, `Colors.primary[...]` MoMo payment-method card) with `color.bg`, `color.inkMuted`/`color.ink`, `color.accent`/`color.accentSoft` respectively, and remove the `import { Colors } from '@/constants/Colors';` line once none remain. Add `import { color, radius, shadow } from '@/theme/tokens';` and `import { ProgressStepper } from '@/components/ui/ProgressStepper';` and `import { IconButton } from '@/components/ui/IconButton';` alongside the existing imports.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Visual check**

Add an item to the cart, proceed to checkout: confirm the dotted-line `ProgressStepper` renders at the top, section cards use the new `Card` treatment, and both step-advance buttons are gradient pills. **Do not** attempt to verify the payment flow itself changed — it didn't; only confirm it still visually renders through both steps without runtime errors.

- [ ] **Step 8: Commit**

```bash
git add app/checkout.tsx
git commit -m "Re-skin Checkout: ProgressStepper, Card sections, gradient CTAs"
```

---

## Task 18: Redesign Confirmation

**Files:**
- Modify: `app/confirmation.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `shadow` (Task 1); `Card` (Task 5); `Button` (Task 2). The `useEffect` fetching the order via `momoAPI.getOrder` is unchanged.

- [ ] **Step 1: Replace the success header and body**

Replace the full `return (...)` block (lines 27–99) — dropping the green `LinearGradient` header entirely in favor of the reference's centered accent checkmark badge with a soft glow:

```tsx
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: insets.top + 32, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: color.surface,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              ...shadow.card,
            }}
          >
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={40} color={color.onAccent} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: color.ink }}>Thank You!</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: color.accent, marginTop: 2 }}>Your Order is Confirmed</Text>
          <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
            We received your order and it's now being processed.
          </Text>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color={color.accent} />
            <Text style={{ fontSize: 13, color: color.inkMuted, marginTop: 12 }}>Loading order details...</Text>
          </View>
        ) : order ? (
          <>
            <View style={{ backgroundColor: color.peachTint, borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="document-text-outline" size={22} color={color.accentPressed} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: color.accentPressed, fontWeight: '700', marginBottom: 2 }}>ORDER ID</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>{order.external_id}</Text>
              </View>
            </View>

            <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Order Details
              </Text>
              <View style={{ gap: 10 }}>
                <Row label="Status" value={order.payment_status} highlight />
                <Row label="Total Paid" value={formatCurrency(order.final_total)} highlight />
              </View>
            </Card>

            <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Delivery
              </Text>
              <View style={{ gap: 10 }}>
                <Row label="Name" value={`${order.customer_first_name} ${order.customer_last_name}`} />
                <Row label="Email" value={order.customer_email} />
                <Row label="Phone" value={order.customer_phone} />
                <Row label="Address" value={`${order.delivery_address}, ${order.delivery_city}, ${order.delivery_state}`} />
              </View>
            </Card>

            <Card style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Items
              </Text>
              {(order.items as any[])?.map((item: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border }}>
                  <Text style={{ fontSize: 13, color: color.ink, flex: 1 }} numberOfLines={1}>
                    {item.name} {item.size ? `(${item.size})` : ''} × {item.quantity}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: color.accent, marginLeft: 8 }}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <View style={{ backgroundColor: color.peachTint, borderRadius: 20, padding: 16, marginBottom: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: color.accentPressed, textAlign: 'center', fontWeight: '600' }}>
              Your order has been placed! Reference:{'\n'}{referenceId}
            </Text>
          </View>
        )}

        <Button title="Track Your Order" onPress={() => router.replace('/(tabs)/account')} variant="primary" fullWidth size="lg" />
        <Button title="Continue Shopping" variant="outline" onPress={() => router.replace('/(tabs)')} fullWidth size="md" style={{ marginTop: 12 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: color.inkMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: highlight ? color.accent : color.ink }}>{value}</Text>
    </View>
  );
}
```

Note the primary CTA changed from "Continue Shopping" to "Track Your Order" (routing to `/(tabs)/account`, where order history lives) per the spec's §5 description of this screen — "Continue Shopping" moves to the secondary outline button, swapping the two buttons' former targets accordingly (previously "Continue Shopping" was primary → `/(tabs)`, "View Orders" was outline → `/(tabs)/account`; both destinations are preserved, just re-labeled/reordered to match the reference).

- [ ] **Step 2: Update imports**

Remove `import { LinearGradient } from 'expo-linear-gradient';` (line 5, no longer used — the gradient header is gone) and `import { Colors } from '@/constants/Colors';` (line 6, replaced by tokens below; its only use, `Colors.primary[500]` on the loading `ActivityIndicator`, is already replaced by `color.accent` in Step 1). `import { Button } from '@/components/ui/Button';` and the `Ionicons`/React Native imports stay as they are. Add:

```tsx
import { color, shadow } from '@/theme/tokens';
import { Card } from '@/components/ui/Card';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Visual check**

Complete a test checkout (or navigate directly to `/confirmation?referenceId=<any-existing-order-external_id>` during development) and confirm the accent checkmark badge, peach order-ID card, and white info `Card`s render as specified.

- [ ] **Step 5: Commit**

```bash
git add app/confirmation.tsx
git commit -m "Redesign Confirmation: checkmark badge, peach order card, Card sections"
```

---

## Task 19: Redesign Account

**Files:**
- Modify: `app/(tabs)/account.tsx`
- Modify: `components/ui/Badge.tsx`

**Interfaces:**
- Consumes: `color`, `radius`, `spacing`, `shadow` (Task 1); `Card` (Task 5); `ProductCard` (Task 10, replacing the bespoke wishlist-tab item markup); `useTabBarClearance` (Task 8). `Badge`'s public API is unchanged: `{ label: string; variant?: Variant; status?: string; size?: 'sm' | 'md' }`.

- [ ] **Step 1: Re-skin Badge to a pill with the new tokens**

Replace the full contents of `components/ui/Badge.tsx`:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { color, radius } from '@/theme/tokens';

type Variant = 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary';

const VARIANT_STYLES: Record<Variant, { bg: string; text: string }> = {
  success: { bg: '#dcfce7', text: '#15803d' },
  error: { bg: '#fee2e2', text: '#b91c1c' },
  warning: { bg: '#fef3c7', text: '#b45309' },
  info: { bg: '#dbeafe', text: '#1d4ed8' },
  primary: { bg: color.accentSoft, text: color.accentPressed },
  secondary: { bg: color.surfaceSunken, text: color.inkMuted },
};

const STATUS_MAP: Record<string, Variant> = {
  SUCCESSFUL: 'success',
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  REFUNDED: 'info',
  DISPUTED: 'error',
};

interface Props {
  label: string;
  variant?: Variant;
  status?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, variant, status, size = 'sm' }: Props) {
  const v: Variant = variant ?? (status ? STATUS_MAP[status] ?? 'secondary' : 'secondary');
  const s = VARIANT_STYLES[v];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderRadius: radius.full,
        paddingHorizontal: size === 'sm' ? 8 : 12,
        paddingVertical: size === 'sm' ? 3 : 5,
      }}
    >
      <Text style={{ fontWeight: '600', color: s.text, fontSize: size === 'sm' ? 11 : 13 }}>{label}</Text>
    </View>
  );
}
```

(This drops the NativeWind-`className` implementation for the same reason `Button` did — mapping arbitrary hex pairs per status is clearer as a plain style lookup than juggling Tailwind's generated color-utility names, and it keeps `radius.full` as the single source for "pill" rather than relying on NativeWind's `rounded-full` utility matching it by coincidence.)

- [ ] **Step 2: Re-skin the Account screen's headers, tabs, and cards**

This file mixes NativeWind `className` (structure/spacing) with a few `Colors.*` references (`components/ui/Input`'s inherited styling aside, direct usages are at lines 93, 163, 174, 245, 368, 429, 485). Replace each:
- Line 93 `color={activeTab === t.key ? '#fff' : Colors.gray[600]}` → `color={activeTab === t.key ? '#fff' : color.inkMuted}` (and the active-tab pill's `bg-primary-600` class already matches the accent — no change needed there since NativeWind's `primary` palette is still wired to the same hex ramp in `tailwind.config.js`, untouched by this plan).
- Line 163 `style={!editing ? { backgroundColor: Colors.gray[50] } : undefined}` → `{ backgroundColor: color.surfaceSunken }`.
- Line 174 `color={Colors.primary[600]}` → `color={color.accent}`.
- Line 245 `color={star <= rating ? Colors.warning : Colors.gray[300]}` → `color={star <= rating ? color.star : color.surfaceSunken}`.
- Line 368 `color={Colors.primary[600]}` (review-chip star icon) → `color.accent`.
- Line 429 `color={Colors.error}` (wishlist-remove heart) → `color.danger`.
- Line 485 `color={Colors.gray[400]}` (settings chevron) → `color.inkFaint`.

Replace `import { Colors } from '@/constants/Colors';` with `import { color, radius } from '@/theme/tokens';` once all six are migrated.

Wrap the Profile tab's white info block (the `View` at line 154, `className="bg-white rounded-2xl p-5 shadow-sm"`) and the Settings tab's account-info block (line 475, same pattern) in the shared `Card` component instead of a hand-rolled NativeWind card — replace `<View className="bg-white rounded-2xl p-5 shadow-sm">...</View>` with `<Card>...</Card>` in both places (removing the now-redundant `className` since `Card` already supplies the background/radius/shadow/padding).

- [ ] **Step 3: Simplify WishlistTab to reuse ProductCard**

Replace the `WishlistTab` function body (lines 386–447) — its bespoke `FlashList` `renderItem` duplicates what `ProductCard` (Task 10) now does, just without the wishlist-remove overlay's exact placement. Reuse `ProductCard` directly and let its own wishlist-heart toggle handle removal (it already reads `useWishlistStore` internally and toggles on tap — confirmed in Task 10's version):

```tsx
function WishlistTab() {
  const router = useRouter();
  const items = useWishlistStore((s) => s.items);
  const addToCart = useCartStore((s) => s.addItem);

  if (!items.length) {
    return (
      <EmptyState
        icon="heart-outline"
        title="Your wishlist is empty"
        description="Save items you love and come back later."
        actionLabel="Browse Shop"
        onAction={() => router.push('/(tabs)/shop')}
      />
    );
  }

  return (
    <FlashList
      data={items}
      numColumns={2}
      estimatedItemSize={230}
      keyExtractor={(i) => i.productId}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <View style={{ flex: 1, margin: 6 }}>
          <ProductCard
            product={{
              id: item.productId,
              slug: item.slug,
              name: item.name,
              brand: item.brand,
              price: item.price,
              sale_price: item.salePrice ?? null,
              stock: item.stock,
              image_urls: [item.imageUrl],
              rating: null,
              review_count: null,
            } as any}
          />
        </View>
      )}
    />
  );
}
```

This is a deliberate, narrow simplification: `WishlistItem` (in `types/index.ts`) doesn't carry every field `Product` has (no `rating`/`review_count`/`category_*`), so the cast to `any` bridges the gap rather than widening `ProductCard`'s prop type or `WishlistItem`'s shape for one call site — flag to the user if a cleaner shared type is worth introducing later. `addToCart` is no longer used directly in this function (it moved into `ProductCard`'s own logic in Task 10 for the product-detail add-to-cart flow, but note **Task 10 removed the grid card's own add-to-cart button** — so this wishlist grid also loses its inline "Add to Cart" pill per row, consistent with every other product grid in the app after Task 10). Remove the now-unused `addToCart` line if this causes an "unused variable" lint concern; it does not cause a *typecheck* error either way, but delete it for cleanliness: drop the `const addToCart = useCartStore((s) => s.addItem);` line entirely.

- [ ] **Step 4: Add tab-bar clearance**

Add `import { useTabBarClearance } from '@/components/navigation/TabBar';`, call `const tabBarClearance = useTabBarClearance();` inside `AccountScreen`, and apply `paddingBottom: tabBarClearance` to each tab's outer scroll container (`ProfileTab`'s `ScrollView` `contentContainerStyle`, `OrdersTab`'s `FlashList` `contentContainerStyle`, `WishlistTab`'s `FlashList` `contentContainerStyle`, `SettingsTab`'s `ScrollView` `contentContainerStyle`) — matching the pattern from Tasks 11/12/16.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Visual check**

Sign in, open the Account tab, and check all four sub-tabs: Profile's info block and Settings' account block render as `Card`s, order-status `Badge`s are pill-shaped, and the Wishlist grid renders via the shared borderless `ProductCard`.

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/account.tsx components/ui/Badge.tsx
git commit -m "Re-skin Account: Card sections, pill Badge, shared ProductCard in Wishlist"
```

---

## Task 20: Final verification pass

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Confirm no in-scope file still imports the legacy Colors constant**

Run:

```bash
grep -rln "from '@/constants/Colors'" app components
```

Expected output: only the twelve files listed in this plan's Global Constraints as intentionally unmigrated (`app/(auth)/login.tsx`, `app/(auth)/new-password.tsx`, `app/(auth)/reset-password.tsx`, `app/about.tsx`, `app/contact.tsx`, `app/privacy.tsx`, `app/returns.tsx`, `app/shipping.tsx`, `app/terms.tsx`, `app/order/[id].tsx`, `app/+not-found.tsx`, `components/ui/ErrorBoundary.tsx`). If any file from this plan's actual scope (Tasks 9–19's targets) still appears, go back and finish migrating it before proceeding.

- [ ] **Step 3: Full manual walkthrough**

Launch the app (`npx expo start`) and walk the entire redesigned flow in order: onboarding → Home → Shop (search + filter) → a category → a product detail page → add to cart → Cart → Checkout (both steps, without necessarily completing a real payment) → back out to Account (all four sub-tabs). Confirm at every screen: the canvas is the warm grey (never white), every button/chip/tab bar is pill-shaped, price text is accent-colored, and the floating tab bar never overlaps scrollable content.

- [ ] **Step 4: Commit (only if Step 3 surfaced fixes)**

If the walkthrough required any touch-ups, stage and commit them with a message describing what the walkthrough caught — otherwise this task produces no commit of its own.
