import { TextStyle } from 'react-native';

/**
 * Design tokens for LitwaysPicks.
 *
 * One source of truth for spacing, radius, elevation, color and type. Screens
 * should consume these instead of hand-picking raw hex/number values so the app
 * stays visually consistent as it grows. The direction is "clean-premium with
 * disciplined marketplace energy": a neutral canvas, a single orange accent used
 * sparingly, hairline borders over heavy shadows, and one muted style for the
 * promotional badges (deals/new) rather than a rainbow of accents.
 */

/* ── Spacing scale (4-pt grid) ─────────────────────────────────────────── */
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

/* ── Corner radius ─────────────────────────────────────────────────────── */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
} as const;

/* ── Palette (raw ramps) ───────────────────────────────────────────────── */
export const palette = {
  // Brand accent — warm orange. Use for CTAs, active states, price.
  primary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  // Neutrals — a touch warm so the accent feels at home.
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
} as const;

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
  /** Resting outline of a text field — must read against both white cards and the grey canvas. */
  fieldBorder: '#c4c4c4',

  /** Primary text (canonical name). */
  ink: '#141414',
  /** Secondary text (subtitles, meta). */
  inkMuted: '#5f5f5f',
  /** Body copy (descriptions, paragraphs) — passes AA contrast on white,
   *  which the old #8a8a8a muted grey did not. */
  inkBody: '#4a4a4a',
  /** Placeholders and decorative icons only (4.5:1 on white, ~3.8:1 on the canvas). Never for readable content — use inkMuted. */
  inkFaint: '#767676',
  /** Aliases kept so existing screens using the old names keep compiling. */
  text: '#141414',
  textMuted: '#5f5f5f',
  textFaint: '#767676',
  /** Text/icons drawn on the accent color. */
  onAccent: palette.neutral[0],
  /** Text/icons drawn on the ink-black tab bar / dark pill button. */
  onInk: palette.neutral[0],

  /** The single brand accent — unchanged, the client asked to keep this. */
  accent: palette.primary[600],
  /** The accent as TEXT (prices, links). #ea580c is 3.0:1 on the canvas; this is 4.8:1. Use accent for fills and icons. */
  accentText: '#b93a08',
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

/* ── Font families ─────────────────────────────────────────────────────── */
export const font = {
  /** Primary: all UI text. Static files, so each weight is its own family (Android doesn't synthesise weights for custom fonts). */
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  /** Secondary: editorial headings (hero, display, title). */
  serif: 'Merriweather_700Bold',
  /** Logo lockup only (components/brand/LogoMark.tsx) — the wordmark is artwork, not UI type. */
  logo: 'BricolageGrotesque_700Bold',
  logoHeavy: 'BricolageGrotesque_800ExtraBold',
} as const;

/** Reference weights for the system font; UI text picks weight via font family instead. */
export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/* ── Typography ────────────────────────────────────────────────────────── */
/* Two families: Inter (primary) for all UI text, prices and buttons; Merriweather
   (secondary) for editorial headings — hero, display, title. Both are static
   font files, so a role picks its weight through fontFamily, NOT fontWeight
   (Android ignores fontWeight on custom fonts). Use <Text weight="…"> to change
   weight on a nested span.
   Sixteen roles and no other sizes, each with its line height. Render text with
   <Text variant="…"> (components/ui/Text.tsx) rather than raw fontSize.
   `npm run check:type` flags sizes/weights outside this scale. */
const tabular: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const type = {
  /** Brand moments only: home greeting, auth header. */
  hero: { fontSize: 32, lineHeight: 42, fontFamily: font.serif, letterSpacing: -0.4, color: color.text },
  /** Page titles. */
  display: { fontSize: 26, lineHeight: 34, fontFamily: font.serif, letterSpacing: -0.3, color: color.text },
  /** Section and screen headings, dialog and empty-state titles. */
  title: { fontSize: 20, lineHeight: 28, fontFamily: font.serif, letterSpacing: -0.2, color: color.text },
  /** Card, sheet and compact-rail titles. */
  heading: { fontSize: 17, lineHeight: 22, fontFamily: font.sansBold, letterSpacing: -0.2, color: color.text },
  /** Order totals. */
  priceLg: { fontSize: 24, lineHeight: 30, fontFamily: font.sansBold, letterSpacing: -0.3, ...tabular, color: color.text },
  /** Prices. */
  price: { fontSize: 16, lineHeight: 20, fontFamily: font.sansBold, ...tabular, color: color.text },
  /** Descriptions, dialog messages. */
  bodyLg: { fontSize: 15, lineHeight: 22, fontFamily: font.sans, color: color.text },
  /** Default UI text, inputs, list rows. */
  body: { fontSize: 14, lineHeight: 20, fontFamily: font.sans, color: color.text },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontFamily: font.sansSemibold, color: color.text },
  /** Product names, chips, secondary lines. */
  small: { fontSize: 13, lineHeight: 18, fontFamily: font.sansSemibold, color: color.text },
  /** Secondary lines and helper text that read as plain sentences. */
  caption: { fontSize: 13, lineHeight: 18, fontFamily: font.sansMedium, color: color.text },
  /** Chips, badges and emphasised counts. */
  metaStrong: { fontSize: 12, lineHeight: 16, fontFamily: font.sansSemibold, color: color.text },
  /** Counts, dates, helper and error text. */
  meta: { fontSize: 12, lineHeight: 16, fontFamily: font.sansMedium, color: color.textMuted },
  /** Field labels, tab labels, captions. */
  label: { fontSize: 11, lineHeight: 14, fontFamily: font.sansSemibold, letterSpacing: 0.3, color: color.textMuted },
  /** Badges and eyebrows. */
  overline: { fontSize: 11, lineHeight: 14, fontFamily: font.sansBold, letterSpacing: 0.6, textTransform: 'uppercase', color: color.textFaint },
  /** Button labels (sizes follow Button's sm / md / lg: 13 / 15 / 16). */
  button: { fontSize: 15, lineHeight: 20, fontFamily: font.sansBold, color: color.text },
} as const satisfies Record<string, TextStyle>;

/** Style for every TextInput (they don't inherit from <Text>): same size, line height and family as `body`. */
export const inputText = {
  fontSize: 14,
  lineHeight: 20,
  fontFamily: font.sans,
  color: color.ink,
} as const satisfies TextStyle;

export type TypeVariant = keyof typeof type;

export const theme = { spacing, gutter, radius, palette, color, shadow, type, weight, font } as const;
export default theme;
