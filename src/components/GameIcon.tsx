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
    case 'vector':
      // Vanishing-point perspective: triangular ship at the bottom,
      // chevrons receding toward a glowing point at top.
      return (
        <>
          {/* Vanishing point glow */}
          <Circle cx="16" cy="6" r="3" fill={color} />
          <Circle cx="16" cy="6" r="6" fill={color} fillOpacity={0.3} />
          {/* Receding lane chevrons */}
          <Polygon points="13,12 16,9 19,12" stroke={color} strokeWidth="1" fill="none" />
          <Polygon points="11,18 16,13 21,18" stroke={color} strokeWidth="1" fill="none" />
          <Polygon points="9,24 16,17 23,24" stroke={color} strokeWidth="1" fill="none" />
          {/* Ship triangle at the bottom */}
          <Polygon points="16,21 11,29 21,29" fill={color} />
        </>
      );
    case 'flip':
      // Phone rotating end-over-end — show two phones at different
      // rotations connected by a curved arrow.
      return (
        <>
          {/* Rotation arc */}
          <Path
            d="M 7 22 A 9 9 0 0 1 25 22"
            stroke={color}
            strokeWidth="1.5"
            strokeOpacity={0.6}
            fill="none"
          />
          <Polygon points="25,22 23,17 27,18" fill={color} />
          {/* Phone, upright */}
          <Rect x="6" y="20" width="6" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          {/* Phone, rotated mid-flip */}
          <Rect
            x="20"
            y="4"
            width="6"
            height="8"
            stroke={color}
            strokeWidth="1.5"
            fill={color}
            fillOpacity={0.5}
            transform="rotate(70, 23, 8)"
          />
        </>
      );
    case 'shake':
      // Phone with motion lines on either side — shaking left/right.
      return (
        <>
          <Rect x="11" y="6" width="10" height="20" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={0.4} />
          <Line x1="3" y1="11" x2="7" y2="11" stroke={color} strokeWidth="2" />
          <Line x1="3" y1="16" x2="6" y2="16" stroke={color} strokeWidth="2" />
          <Line x1="3" y1="21" x2="7" y2="21" stroke={color} strokeWidth="2" />
          <Line x1="25" y1="11" x2="29" y2="11" stroke={color} strokeWidth="2" />
          <Line x1="26" y1="16" x2="29" y2="16" stroke={color} strokeWidth="2" />
          <Line x1="25" y1="21" x2="29" y2="21" stroke={color} strokeWidth="2" />
        </>
      );
    case 'card-shark':
      // Three card backs, one with a question mark on it.
      return (
        <>
          <Rect x="3" y="6" width="8" height="20" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="12" y="6" width="8" height="20" fill={color} />
          <Rect x="21" y="6" width="8" height="20" stroke={color} strokeWidth="1.5" fill="none" />
          {/* Question mark on the middle (queen) card */}
          <Path
            d="M 14 12 Q 14 10 16 10 T 18 12 Q 18 14 16 15 L 16 16"
            stroke="#08080f"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx="16" cy="20" r="0.9" fill="#08080f" />
        </>
      );
    case 'trivia':
      // Question mark inside a card / speech bubble.
      return (
        <>
          <Rect x="4" y="6" width="24" height="22" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M 12 13 Q 12 9 16 9 T 20 13 Q 20 16 16 17 L 16 19" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Circle cx="16" cy="23" r="1.4" fill={color} />
        </>
      );
    case 'draw-it':
      // Star being drawn freehand — geometric (not a curve) so it
      // doesn't collide with tilt-maze's winding path. Bright dot at
      // the apex marks the "pencil tip" mid-stroke.
      return (
        <>
          <Polygon
            points="16,4 19.5,13 29,13.5 21.5,19.5 24,28.5 16,23.5 8,28.5 10.5,19.5 3,13.5 12.5,13"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx="16" cy="4" r="2.2" fill={color} />
        </>
      );
    case 'pulse':
      // Four falling tiles in lanes.
      return (
        <>
          <Line x1="6" y1="3" x2="6" y2="29" stroke={color} strokeOpacity="0.4" strokeWidth="0.8" />
          <Line x1="13" y1="3" x2="13" y2="29" stroke={color} strokeOpacity="0.4" strokeWidth="0.8" />
          <Line x1="20" y1="3" x2="20" y2="29" stroke={color} strokeOpacity="0.4" strokeWidth="0.8" />
          <Line x1="27" y1="3" x2="27" y2="29" stroke={color} strokeOpacity="0.4" strokeWidth="0.8" />
          <Rect x="3" y="9" width="6" height="3" fill={color} />
          <Rect x="17" y="14" width="6" height="3" fill={color} />
          <Rect x="10" y="19" width="6" height="3" fill={color} />
          <Rect x="24" y="22" width="6" height="3" fill={color} />
          {/* Hit line */}
          <Line x1="2" y1="27" x2="30" y2="27" stroke={color} strokeWidth="1.5" strokeDasharray="2,1" />
        </>
      );
    case 'dead-air':
      // Two flat lines (motion + audio meters) crossed by a hush mark.
      return (
        <>
          <Line x1="3" y1="11" x2="29" y2="11" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
          <Line x1="3" y1="11" x2="14" y2="11" stroke={color} strokeWidth="2.5" />
          <Line x1="3" y1="21" x2="29" y2="21" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
          <Line x1="3" y1="21" x2="11" y2="21" stroke={color} strokeWidth="2.5" />
          <Circle cx="22" cy="16" r="4" fill="none" stroke={color} strokeWidth="1.5" />
          <Line x1="19" y1="16" x2="25" y2="16" stroke={color} strokeWidth="1.5" />
        </>
      );
    case 'walk-the-line':
      // A small figure walking along a vertical line, with a slight drift.
      return (
        <>
          <Line x1="16" y1="3" x2="16" y2="29" stroke={color} strokeWidth="2" strokeDasharray="2,2" />
          <Circle cx="16" cy="9" r="3" fill={color} />
          <Path d="M 12 13 L 20 13 L 18 21 L 19 27 M 18 21 L 14 27" stroke={color} strokeWidth="1.5" fill="none" />
        </>
      );
    case 'slipstream':
      // Glow-bug streaking forward: small dot + curving trail behind.
      return (
        <>
          <Path
            d="M 4 22 Q 9 22 12 16 T 22 12"
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeOpacity="0.4"
          />
          <Circle cx="22" cy="12" r="3" fill={color} />
          <Circle cx="22" cy="12" r="5" fill={color} fillOpacity="0.3" />
          {/* Obstacle wall with gap */}
          <Line x1="28" y1="3" x2="28" y2="9" stroke={color} strokeWidth="2" />
          <Line x1="28" y1="14" x2="28" y2="29" stroke={color} strokeWidth="2" />
        </>
      );
    case 'tilt-maze':
      // Winding path with a ball at the end — reads as "rolling through."
      return (
        <>
          <Path
            d="M 4 6 Q 14 6 14 14 Q 14 22 22 22 L 28 22"
            stroke={color}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx="6" cy="6" r="2.5" fill={color} fillOpacity="0.4" />
          <Circle cx="28" cy="22" r="3.5" fill={color} />
        </>
      );
    case 'memory-grid':
      // 3x3 grid of cells, with two cells lit up to suggest a sequence.
      return (
        <>
          <Rect x="3" y="3" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="12" y="3" width="8" height="8" fill={color} />
          <Rect x="21" y="3" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="3" y="12" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="12" y="12" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="21" y="12" width="8" height="8" fill={color} fillOpacity={0.6} />
          <Rect x="3" y="21" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="12" y="21" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
          <Rect x="21" y="21" width="8" height="8" stroke={color} strokeWidth="1.5" fill="none" />
        </>
      );
    case 'stroop':
      // The letters "RED" overlaid with mismatched color blocks (visualized
      // as a striped block — we can't easily draw text, so use a
      // half-and-half rectangle gimmick).
      return (
        <>
          <Rect x="3" y="9" width="13" height="14" fill={color} />
          <Rect x="16" y="9" width="13" height="14" fill={color} fillOpacity={0.4} />
          <Line x1="6" y1="13" x2="13" y2="13" stroke="#08080f" strokeWidth="2" />
          <Line x1="6" y1="16" x2="11" y2="16" stroke="#08080f" strokeWidth="2" />
          <Line x1="6" y1="19" x2="13" y2="19" stroke="#08080f" strokeWidth="2" />
          <Line x1="19" y1="13" x2="26" y2="13" stroke={color} strokeWidth="2" />
          <Line x1="19" y1="16" x2="24" y2="16" stroke={color} strokeWidth="2" />
          <Line x1="19" y1="19" x2="26" y2="19" stroke={color} strokeWidth="2" />
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
