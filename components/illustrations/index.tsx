import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { color } from '@/theme/tokens';

/**
 * LitwaysPicks spot illustrations.
 *
 * A small duotone set used by empty states and the order-confirmation moment.
 * The house style is deliberately narrow so the six read as one family:
 *
 *  - canvas is always `0 0 120 120`, drawn at whatever `size` the caller wants
 *  - every stroke is `color.ink` at width 3 with round caps and joins
 *  - fills come only from `accent` / `accentSoft` / `peachTint` / `surface`
 *  - a soft `accentSoft` disc sits behind each subject as a "ground"
 *  - geometry is built from circles, rounded rects and straight-run paths —
 *    no gradients, no organic curves, nothing that mushes at small sizes
 *  - the accent diamond ("lozenge") is the brand's country-cloth motif; it is
 *    used where a real object would carry a mark, not sprinkled everywhere
 */

type Props = { size?: number };

/** Shared ink stroke. Spread onto any stroked element. */
const inkStroke = {
  stroke: color.ink,
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** The soft disc every subject sits on. */
const GROUND = { cx: 60, cy: 64, r: 44 };

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Empty cart / bag. Style anchor for the set: accentSoft ground, a
 * surface-filled ink-stroked body, an arched handle, one accent lozenge.
 *
 * Three deliberate deviations from the brief's snippet, all to kill a padlock
 * read that test renders confirmed: the body is a flared trapezoid rather than
 * a rounded rect, the handle is a bare semicircle with no vertical legs (the
 * legs are what make an arc read as a lock shackle), and a rim line marks the
 * bag's folded top. Everything else — ground disc, surface fill, ink stroke,
 * one accent lozenge — is the anchor unchanged.
 */
export function EmptyBagIllustration({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* soft ground */}
      <Circle cx={60} cy={64} r={44} fill={color.accentSoft} />
      {/* bag body — flared trapezoid, 48 across the top, 56 across the base */}
      <Path d="M 36 46 L 84 46 L 88 96 L 32 96 Z" fill={color.surface} {...inkStroke} />
      {/* handle */}
      <Path d="M 46 46 a 14 14 0 0 1 28 0" fill="none" {...inkStroke} />
      {/* folded rim */}
      <Path d="M 37 58 H 83" fill="none" {...inkStroke} />
      {/* lozenge detail — ties into the brand motif */}
      <Path d="M 60 66 l 8 8 l -8 8 l -8 -8 Z" fill={color.accent} />
    </Svg>
  );
}

/**
 * Empty wishlist. Geometric heart: a bottom point at (60,97), two straight
 * flanks out to (32,60) and (88,60), and two exact semicircles (chord length
 * 35 = 2r, so r = 17.5) capping each flank into the cleft at (60,39).
 */
export function HeartIllustration({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx={GROUND.cx} cy={GROUND.cy} r={GROUND.r} fill={color.accentSoft} />
      {/* heart outline */}
      <Path
        d="M 60 97 L 32 60 A 17.5 17.5 0 0 1 60 39 A 17.5 17.5 0 0 1 88 60 Z"
        fill={color.surface}
        {...inkStroke}
      />
      {/* lozenge motif at the heart's centre */}
      <Path d="M 60 54 l 8 8 l -8 8 l -8 -8 Z" fill={color.accent} />
    </Svg>
  );
}

/**
 * No search results. Magnifier: lens circle at (54,52) r24, handle leaving the
 * rim at exactly 45° — (54 + 24·cos45, 52 + 24·sin45) ≈ (71,69) — and running
 * down to (89,87). The lozenge sits where a result would have been.
 */
export function NoResultsIllustration({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx={GROUND.cx} cy={GROUND.cy} r={GROUND.r} fill={color.accentSoft} />
      {/* handle — drawn first so the lens rim caps it cleanly */}
      <Path d="M 71 69 L 89 87" fill="none" {...inkStroke} />
      {/* lens */}
      <Circle cx={54} cy={52} r={24} fill={color.surface} {...inkStroke} />
      {/* the "result" that isn't there */}
      <Path d="M 54 43 l 9 9 l -9 9 l -9 -9 Z" fill={color.accent} />
    </Svg>
  );
}

/**
 * No orders yet. Receipt: rounded top corners (r10) on a 48-wide body running
 * x 36→84, straight sides down to y 88, then six 8-wide zigzag runs alternating
 * ±8 in y — they sum to exactly -48 in x and 0 in y, closing back at (36,88).
 */
export function ReceiptIllustration({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx={GROUND.cx} cy={GROUND.cy} r={GROUND.r} fill={color.accentSoft} />
      {/* paper with a torn bottom edge */}
      <Path
        d="M 36 36 a 10 10 0 0 1 10 -10 h 28 a 10 10 0 0 1 10 10 v 52 l -8 8 l -8 -8 l -8 8 l -8 -8 l -8 8 l -8 -8 Z"
        fill={color.surface}
        {...inkStroke}
      />
      {/* rule lines */}
      <Path d="M 46 44 h 28" fill="none" {...inkStroke} />
      <Path d="M 46 56 h 28" fill="none" {...inkStroke} />
      <Path d="M 46 68 h 16" fill="none" {...inkStroke} />
      {/* stamp */}
      <Path d="M 72 61 l 7 7 l -7 7 l -7 -7 Z" fill={color.accent} />
    </Svg>
  );
}

/**
 * Expired / invalid reset link. Two capsule chain links (36×26, r13) laid on a
 * shared axis with a 12-unit gap between their facing edges, each carrying a
 * concentric peachTint hole, plus a snap tick either side of the gap. The whole
 * group is rotated -35° about the canvas centre: laid out flat the pair reads as
 * a pair of eyes, on the diagonal it reads unmistakably as a snapped chain.
 */
export function BrokenLinkIllustration({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx={GROUND.cx} cy={GROUND.cy} r={GROUND.r} fill={color.accentSoft} />
      <G rotation={-35} originX={60} originY={64}>
        {/* left link */}
        <Rect x={18} y={51} width={36} height={26} rx={13} fill={color.surface} {...inkStroke} />
        <Rect x={26} y={58} width={20} height={12} rx={6} fill={color.peachTint} {...inkStroke} />
        {/* right link */}
        <Rect x={66} y={51} width={36} height={26} rx={13} fill={color.surface} {...inkStroke} />
        <Rect x={74} y={58} width={20} height={12} rx={6} fill={color.peachTint} {...inkStroke} />
        {/* snap ticks, perpendicular to the break */}
        <Path d="M 60 39 v 8" fill="none" {...inkStroke} />
        <Path d="M 60 81 v 8" fill="none" {...inkStroke} />
      </G>
    </Svg>
  );
}

/**
 * Order on its way. Profile motorbike facing right: equal r14 wheels sharing the
 * ground line y=96, a solid surface-filled body polygon spanning hub-to-hub (the
 * mass that separates a motorbike from a bicycle), an exhaust stub out the back,
 * a fork and riser above the front wheel, and a peachTint parcel on the rack.
 */
export function DeliveryBikeIllustration({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx={GROUND.cx} cy={GROUND.cy} r={GROUND.r} fill={color.accentSoft} />

      {/* wheels — equal radius, bottoms both at y = 96 */}
      <Circle cx={37} cy={82} r={14} fill={color.surface} {...inkStroke} />
      <Circle cx={85} cy={82} r={14} fill={color.surface} {...inkStroke} />

      {/* exhaust — tucked behind the body so it reads as emerging from it */}
      <Rect x={23} y={70} width={20} height={8} rx={4} fill={color.surface} {...inkStroke} />

      {/* body: rear hub → tail → seat → tank → front → back to rear hub */}
      <Path
        d="M 37 82 L 29 66 L 62 66 L 78 58 L 81 70 L 66 82 Z"
        fill={color.surface}
        {...inkStroke}
      />

      {/* front fork down to the hub, riser and handlebar above it */}
      <Path d="M 81 70 L 85 82" fill="none" {...inkStroke} />
      <Path d="M 78 58 L 82 47" fill="none" {...inkStroke} />
      <Path d="M 75 47 h 14" fill="none" {...inkStroke} />

      {/* headlight */}
      <Rect x={79} y={56} width={11} height={9} rx={4} fill={color.peachTint} {...inkStroke} />

      {/* hubs, drawn last so the body does not clip them */}
      <Circle cx={37} cy={82} r={4} fill={color.surface} {...inkStroke} />
      <Circle cx={85} cy={82} r={4} fill={color.surface} {...inkStroke} />

      {/* parcel on the rear rack, sitting on the seat line y = 66 */}
      <Rect x={25} y={42} width={27} height={24} rx={6} fill={color.peachTint} {...inkStroke} />
      <Path d="M 39 47 l 7 7 l -7 7 l -7 -7 Z" fill={color.accent} />
    </Svg>
  );
}
