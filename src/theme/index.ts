// Sensor Arcade — theme tokens.
//
// Aesthetic: late-80s/early-90s arcade cabinet. Deep black backgrounds,
// chunky pixel typography, neon accents. Each game in the catalog gets
// assigned an accentColor key from `colors.neon` so the UI feels color-coded.

import { TextStyle } from 'react-native';

export const colors = {
  // Surfaces — go from near-black to slightly elevated for depth.
  bg: '#08080f',
  bgSurface: '#12121f',
  bgElevated: '#1a1a2e',
  border: '#2a2a3a',

  // Text.
  text: '#f5f5fa',
  textDim: '#8a8aa8',
  textMute: '#5a5a7a',

  // Neon palette — keep fully saturated for that CRT-glow look.
  neon: {
    magenta: '#ff2bd6',
    cyan: '#00f0ff',
    yellow: '#ffea00',
    green: '#39ff14',
    purple: '#bd00ff',
    orange: '#ff7b00',
    red: '#ff2e2e',
    blue: '#3a86ff',
  },
} as const;

export type NeonColor = keyof typeof colors.neon;

export const neon = (key: NeonColor): string => colors.neon[key];

export const fonts = {
  // Logical names — mapped to actual file names by expo-font in _layout.tsx.
  pixel: 'PressStart2P',
  mono: 'VT323',
} as const;

// Press Start 2P is a chunky 8x8 pixel font; sizes scale by 2 for readability.
// VT323 is a tall terminal font; can go larger before getting awkward.
export const fontSize = {
  pixelXs: 8,
  pixelSm: 10,
  pixelMd: 12,
  pixelLg: 16,
  pixelXl: 20,
  pixelHuge: 28,
  monoSm: 14,
  monoMd: 18,
  monoLg: 22,
  monoXl: 28,
  monoHuge: 36,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
} as const;

// Subtle text shadow that suggests CRT glow without ruining performance.
export const glow = (hex: string, radius = 8): TextStyle => ({
  textShadowColor: hex,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: radius,
});

export const theme = {
  colors,
  neon,
  fonts,
  fontSize,
  spacing,
  radius,
  glow,
};

export default theme;
