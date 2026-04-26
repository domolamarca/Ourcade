// Tiny per-game SVG icons. Geometric, monochrome, scale to any size.
// Keeps the pixel aesthetic intact instead of relying on Unicode glyphs the
// arcade font doesn't ship.

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';

type Props = {
  id: string;
  size?: number;
  color: string;
  glow?: boolean;
};

export function GameIcon({ id, size = 56, color, glow = true }: Props) {
  const wrapperStyle = glow
    ? {
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 6,
      }
    : null;

  return (
    <View style={[{ width: size, height: size }, wrapperStyle]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        {renderShape(id, color)}
      </Svg>
    </View>
  );
}

function renderShape(id: string, color: string) {
  switch (id) {
    case 'tap-bullseye':
      return (
        <>
          <Circle cx="16" cy="16" r="14" stroke={color} strokeWidth="2" fill="none" />
          <Circle cx="16" cy="16" r="9" stroke={color} strokeWidth="2" fill="none" />
          <Circle cx="16" cy="16" r="4" fill={color} />
        </>
      );
    case 'reaction-light':
      return (
        <>
          <Circle cx="16" cy="16" r="13" fill={color} />
          <Circle cx="12" cy="12" r="3" fill="#08080f" />
        </>
      );
    case 'dead-still':
      return (
        <>
          <Rect x="3" y="3" width="26" height="26" stroke={color} strokeWidth="2" fill="none" />
          <Rect x="11" y="11" width="10" height="10" fill={color} />
        </>
      );
    case 'spin-360':
      return (
        <>
          <Path
            d="M 26 16 A 10 10 0 1 1 16 6"
            stroke={color}
            strokeWidth="3"
            fill="none"
          />
          <Polygon points="20,3 22,9 14,9" fill={color} />
        </>
      );
    case 'silence':
      return (
        <>
          <Polygon points="4,12 11,12 18,5 18,27 11,20 4,20" fill={color} />
          <Line x1="22" y1="9" x2="29" y2="23" stroke={color} strokeWidth="3" />
          <Line x1="29" y1="9" x2="22" y2="23" stroke={color} strokeWidth="3" />
        </>
      );
    case 'true-north':
      return (
        <>
          <Polygon points="16,3 22,18 16,15 10,18" fill={color} />
          <Polygon
            points="16,29 22,18 16,21 10,18"
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
        </>
      );
    case 'high-rise':
      return (
        <>
          <Polygon points="16,3 28,29 4,29" stroke={color} strokeWidth="2" fill="none" />
          <Line x1="16" y1="11" x2="16" y2="29" stroke={color} strokeWidth="2" />
          <Line x1="10" y1="22" x2="22" y2="22" stroke={color} strokeWidth="2" />
        </>
      );
    case 'tap-and-still':
      return (
        <>
          <Rect x="3" y="3" width="20" height="20" stroke={color} strokeWidth="2" fill="none" />
          <Circle cx="22" cy="22" r="8" fill={color} fillOpacity={0.85} />
        </>
      );
    case 'ghost':
      // Hooded silhouette with a single visible eye — handler-watching-runner vibe.
      return (
        <>
          {/* Hood */}
          <Path
            d="M 16 2 L 26 8 L 26 22 L 22 28 L 10 28 L 6 22 L 6 8 Z"
            fill={color}
            opacity={0.85}
          />
          {/* Face shadow */}
          <Path
            d="M 10 11 L 22 11 L 22 22 L 18 26 L 14 26 L 10 22 Z"
            fill="#08080f"
          />
          {/* Single eye */}
          <Circle cx="16" cy="17" r="2" fill={color} />
        </>
      );
    case 'minesweep':
      // Cluster of small dots — mimics the in-game field at a glance.
      return (
        <>
          <Circle cx="6" cy="9" r="3" fill={color} />
          <Circle cx="14" cy="6" r="3" fill={color} />
          <Circle cx="22" cy="11" r="3" fill={color} />
          <Circle cx="9" cy="20" r="3" fill={color} />
          <Circle cx="18" cy="22" r="3" fill={color} />
          <Circle cx="26" cy="24" r="3" fill={color} />
          <Circle cx="14" cy="14" r="3" fill={color} fillOpacity={0.6} />
        </>
      );
    default:
      return (
        <Rect x="4" y="4" width="24" height="24" stroke={color} strokeWidth="2" fill="none" />
      );
  }
}

export default GameIcon;
