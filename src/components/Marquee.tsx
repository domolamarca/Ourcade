import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';
import { ArcadeText } from './ArcadeText';
import { colors } from '../theme';

type Props = {
  text: string;
  speed?: number; // pixels per second
  size?: number;
  color?: string;
  glowColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Continuously scrolls text from right to left, restarting when it runs off
 * screen. Uses RN's core Animated (no Reanimated dep) so it works in Expo Go
 * with no extra setup. We render the text twice in a row so the "wrap" is
 * seamless.
 */
export function Marquee({
  text,
  speed = 40,
  size = 10,
  color = colors.neon.yellow,
  glowColor,
  height = 28,
  style,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (textWidth === 0) return;
    translateX.setValue(0);
    const duration = (textWidth / speed) * 1000;
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [textWidth, speed, translateX]);

  const onLayoutFirst = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - textWidth) > 1) setTextWidth(w);
  };

  // Doubled content — first measures width, second fills the gap.
  return (
    <View
      style={[
        {
          height,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          transform: [{ translateX }],
        }}
      >
        <ArcadeText
          onLayout={onLayoutFirst}
          variant="pixel"
          size={size}
          color={color}
          glowColor={glowColor}
          style={{ paddingHorizontal: 24 }}
        >
          {text}
        </ArcadeText>
        <ArcadeText
          variant="pixel"
          size={size}
          color={color}
          glowColor={glowColor}
          style={{ paddingHorizontal: 24 }}
        >
          {text}
        </ArcadeText>
      </Animated.View>
    </View>
  );
}

export default Marquee;
