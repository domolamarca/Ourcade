import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';

type Props = {
  opacity?: number;
  spacing?: number;
  color?: string;
};

/**
 * CRT-style horizontal scanlines, layered as an absolute overlay. Pointer
 * events disabled so it never eats taps. Implemented as a single SVG with a
 * tiled <pattern> so it stays cheap regardless of screen size.
 */
export function ScanlineOverlay({
  opacity = 0.08,
  spacing = 3,
  color = '#ffffff',
}: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="scan"
            x="0"
            y="0"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <Line x1="0" y1="0" x2={spacing} y2="0" stroke={color} strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scan)" />
      </Svg>
    </View>
  );
}

export default ScanlineOverlay;
