import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color as tokens } from '@/theme/tokens';

/* Country-cloth lozenge lattice. Each cell is one diamond; alternate rows are
   offset half a cell, echoing a woven strip-cloth repeat. Rendered as a single
   Path per color for perf. */

function diamondPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
}

function latticePath(width: number, height: number, cell: number): string {
  const r = cell * 0.32;
  let d = '';
  const rows = Math.ceil(height / cell) + 1;
  const cols = Math.ceil(width / cell) + 1;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : cell / 2;
    for (let col = 0; col < cols; col++) {
      d += diamondPath(col * cell + offset, row * cell, r) + ' ';
    }
  }
  return d;
}

interface OverlayProps {
  color?: string;
  opacity?: number;
  cell?: number;
}

export function MotifOverlay({ color = '#ffffff', opacity = 0.05, cell = 34 }: OverlayProps) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Path d={latticePath(size.w, size.h, cell)} fill={color} opacity={opacity} />
        </Svg>
      )}
    </View>
  );
}

interface BandProps {
  height?: number;
  colors?: [string, string];
  cell?: number;
}

/* A single woven strip — two alternating diamond rows, like the selvedge of a
   country-cloth panel. */
export function MotifBand({ height = 14, colors = [tokens.accent, tokens.peachTint], cell = 14 }: BandProps) {
  const [width, setWidth] = React.useState(0);
  const r = cell * 0.42;
  const cols = Math.ceil(width / cell) + 1;
  let dA = '';
  let dB = '';
  for (let col = 0; col < cols; col++) {
    const cx = col * cell + cell / 2;
    (col % 2 === 0 ? (dA += diamondPath(cx, height / 2, r) + ' ') : (dB += diamondPath(cx, height / 2, r) + ' '));
  }
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
      {width > 0 && (
        <Svg width={width} height={height}>
          <Path d={dA} fill={colors[0]} />
          <Path d={dB} fill={colors[1]} />
        </Svg>
      )}
    </View>
  );
}
