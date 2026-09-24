import React from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, LinearGradient, Stop } from 'react-native-svg';
import { color } from '@/theme/tokens';

/**
 * Default avatar: a head-and-shoulders silhouette in the brand orange on the
 * soft peach disc, clipped to the circle so the shoulders bleed off the edge
 * like a photo crop. Drawn in SVG so it stays crisp at any size.
 */
export function ProfileAvatar({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id="avatarClip">
          <Circle cx="30" cy="30" r="30" />
        </ClipPath>
        <LinearGradient id="avatarFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.accent} stopOpacity="1" />
          <Stop offset="1" stopColor={color.accentFill} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Circle cx="30" cy="30" r="30" fill={color.accentSoft} />
      <Ellipse cx="30" cy="24" rx="9.5" ry="10" fill="url(#avatarFill)" clipPath="url(#avatarClip)" />
      <Ellipse cx="30" cy="57" rx="21" ry="17" fill="url(#avatarFill)" clipPath="url(#avatarClip)" />
    </Svg>
  );
}
