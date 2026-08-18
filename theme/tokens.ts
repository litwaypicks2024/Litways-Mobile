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

/* ── Typography ────────────────────────────────────────────────────────── */
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

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Reusable text presets. Spread into a Text style. */
export const type = {
  display: { fontSize: 26, lineHeight: 34, fontFamily: font.display, letterSpacing: -0.2, color: color.text },
  h1: { fontSize: 20, lineHeight: 26, fontFamily: font.display, letterSpacing: -0.1, color: color.text },
  h2: { fontSize: 17, lineHeight: 22, fontFamily: font.display, letterSpacing: 0, color: color.text },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: weight.semibold, color: color.text },
  body: { fontSize: 14, lineHeight: 20, fontWeight: weight.regular, color: color.text },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: weight.semibold, color: color.text },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: weight.regular, color: color.textMuted },
  label: { fontSize: 11, lineHeight: 14, fontWeight: weight.semibold, letterSpacing: 0.3, color: color.textMuted },
  overline: { fontSize: 10, lineHeight: 12, fontWeight: weight.bold, letterSpacing: 0.8, textTransform: 'uppercase', color: color.textFaint },
} as const satisfies Record<string, TextStyle>;

export const theme = { spacing, gutter, radius, palette, color, shadow, type, weight, font } as const;
export default theme;
