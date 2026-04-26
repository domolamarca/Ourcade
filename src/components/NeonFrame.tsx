import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { colors, radius as r, spacing } from '../theme';

type Props = {
  color?: string;
  thickness?: number;
  fill?: string;
  padding?: number;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * A neon-bordered box. Optional glow uses elevation/shadow which is platform-y
 * but works well enough for arcade vibe. Fall back to a doubled border if you
 * need it tighter.
 */
export function NeonFrame({
  color = colors.neon.magenta,
  thickness = 2,
  fill = colors.bgSurface,
  padding = spacing.md,
  glow = true,
  style,
  children,
}: Props) {
  return (
    <View
      style={[
        {
          borderColor: color,
          borderWidth: thickness,
          borderRadius: r.sm,
          backgroundColor: fill,
          padding,
        },
        glow
          ? {
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 8,
              elevation: 6,
            }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default NeonFrame;
