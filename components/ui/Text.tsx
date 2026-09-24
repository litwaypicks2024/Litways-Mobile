import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { color, font, type, type TypeVariant } from '@/theme/tokens';

/**
 * The one way to render text. `variant` picks a role from the type scale in
 * theme/tokens.ts (size, line height, font, weight, tracking); `tone` picks a
 * text colour. Pass `style` only for layout (margins, alignment) — reaching for
 * fontSize/fontWeight here means the scale is missing a role, so add one.
 */

const TONES = {
  default: color.ink,
  body: color.inkBody,
  muted: color.inkMuted,
  faint: color.inkFaint,
  accent: color.accent,
  onAccent: color.onAccent,
  danger: color.danger,
  success: color.success,
} as const;

export type TextTone = keyof typeof TONES;

/* Large or tight text is capped so OS font scaling can't break layouts;
   reading text scales freely. */
const SCALE_CAP: Partial<Record<TypeVariant, number>> = {
  hero: 1.15,
  display: 1.2,
  title: 1.25,
  priceLg: 1.2,
  price: 1.3,
  button: 1.3,
  label: 1.3,
  overline: 1.3,
};

/* Inter ships as separate static files, so weight is a font family. This is
   how a nested span (a bold word, a link) changes weight — never fontWeight. */
const WEIGHTS = { regular: font.sans, semibold: font.sansSemibold, bold: font.sansBold } as const;
export type TextWeight = keyof typeof WEIGHTS;

interface Props extends TextProps {
  weight?: TextWeight;
  /** Omit for plain RN text (only while a screen is mid-migration). */
  variant?: TypeVariant;
  tone?: TextTone;
}

export function Text({ variant, tone, weight, style, maxFontSizeMultiplier, ...rest }: Props) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (variant ? SCALE_CAP[variant] : undefined)}
      style={[variant && type[variant], weight && { fontFamily: WEIGHTS[weight] }, tone && { color: TONES[tone] }, style]}
      {...rest}
    />
  );
}
