import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect, Ellipse } from 'react-native-svg';
import { color, font } from '@/theme/tokens';

/**
 * The Litway Picks brand mark — the dashing shopping bag from the official
 * logo (assets/images/logo-1.pdf / logo-2.pdf), rebuilt as a recolorable
 * vector so it stays crisp at any size and works on any of the app's three
 * surfaces. Geometry visually matched against the source PDFs.
 */

type Variant = 'onLight' | 'onOrange' | 'onInk';

const SCHEMES: Record<Variant, { bag: string; glyph: string; midLine: string }> = {
  /** Orange bag, ink L — the logo-2 treatment for light/grey canvases. */
  onLight: { bag: color.accent, glyph: color.ink, midLine: color.ink },
  /** White bag, ink L — the logo-1 treatment for accent-orange surfaces. */
  onOrange: { bag: '#ffffff', glyph: color.ink, midLine: color.ink },
  /** White bag, ink L, accent middle speed line — for ink-black panels. */
  onInk: { bag: '#ffffff', glyph: color.ink, midLine: color.accent },
};

interface MarkProps {
  size?: number;
  variant?: Variant;
}

export function LogoMark({ size = 48, variant = 'onLight' }: MarkProps) {
  const c = SCHEMES[variant];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* speed lines */}
      <Rect x={12} y={49} width={26} height={5} rx={2.5} fill={c.bag} />
      <Rect x={6} y={59.5} width={24} height={5} rx={2.5} fill={c.midLine} />
      <Rect x={14} y={70} width={17} height={5} rx={2.5} fill={c.bag} />
      {/* handle */}
      <Path
        d="M 59 43 v -5.5 a 8 8 0 0 1 16 0 v 5.5"
        stroke={c.bag}
        strokeWidth={3.6}
        strokeLinecap="round"
        fill="none"
      />
      {/* bag body */}
      <Path
        d="M 53 42 L 81 42 Q 87 42 88.2 47.5 L 95 81.5 Q 96.6 90 87.5 90 L 46.5 90 Q 37.4 90 39 81.5 L 45.8 47.5 Q 47 42 53 42 Z"
        fill={c.bag}
      />
      {/* L glyph */}
      <Path
        d="M 69.5 52.5 L 63.5 77.5 L 77 77.5"
        stroke={c.glyph}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* feet */}
      <Ellipse cx={52.5} cy={98.5} rx={4.8} ry={7} transform="rotate(16 52.5 98.5)" fill={c.bag} />
      <Ellipse cx={80} cy={98.5} rx={4.8} ry={7} transform="rotate(-5 80 98.5)" fill={c.bag} />
    </Svg>
  );
}

interface LockupProps {
  variant?: Variant;
  /** Height of the bag mark; text scales relative to it. */
  markSize?: number;
  /** Wordmark color — defaults to ink on light, white on orange/ink panels. */
  textColor?: string;
}

/**
 * Mark + wordmark, echoing the official lockup's structure ("Litway" with
 * letterspaced "PICKS" beneath) using the app's display face.
 */
export function LogoLockup({ variant = 'onLight', markSize = 34, textColor }: LockupProps) {
  const resolvedText = textColor ?? (variant === 'onLight' ? color.ink : '#ffffff');
  const nameSize = markSize * 0.56;
  const picksSize = markSize * 0.26;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: markSize * 0.14 }}>
      <LogoMark size={markSize} variant={variant} />
      <View>
        <Text
          style={{
            fontFamily: font.displayHeavy,
            fontSize: nameSize,
            lineHeight: nameSize * 1.15,
            color: resolvedText,
          }}
        >
          Litway
        </Text>
        <Text
          style={{
            fontFamily: font.display,
            fontSize: picksSize,
            letterSpacing: picksSize * 0.42,
            /* PICKS is white on orange surfaces (logo-1) and accent elsewhere (logo-2). */
            color: variant === 'onOrange' ? '#ffffff' : color.accent,
            marginTop: 1,
          }}
        >
          PICKS
        </Text>
      </View>
    </View>
  );
}
