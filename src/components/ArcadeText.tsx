import React from 'react';
import { Text, TextStyle, StyleProp, TextProps } from 'react-native';
import { colors, fonts, glow } from '../theme';

type Variant = 'pixel' | 'mono';

type Props = TextProps & {
  variant?: Variant;
  size?: number;
  color?: string;
  glowColor?: string;
  glowRadius?: number;
  letterSpacing?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
};

export function ArcadeText({
  variant = 'pixel',
  size,
  color = colors.text,
  glowColor,
  glowRadius = 8,
  letterSpacing,
  align = 'left',
  style,
  children,
  ...rest
}: Props) {
  const fontFamily = variant === 'pixel' ? fonts.pixel : fonts.mono;
  const fontSize = size ?? (variant === 'pixel' ? 12 : 18);

  return (
    <Text
      {...rest}
      allowFontScaling={false}
      style={[
        {
          fontFamily,
          fontSize,
          color,
          textAlign: align,
          letterSpacing: letterSpacing ?? (variant === 'pixel' ? 0 : 1),
          // Pixel font has no descenders to speak of — keep line height tight.
          lineHeight: variant === 'pixel' ? fontSize * 1.5 : fontSize * 1.05,
        },
        glowColor ? glow(glowColor, glowRadius) : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export default ArcadeText;
