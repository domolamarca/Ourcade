import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

type Props = {
  intervalMs?: number;
  minOpacity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Wraps children and toggles their opacity between 1 and `minOpacity` on a
 * timer. Used for the "PRESS START" and "INSERT COIN" CTAs.
 */
export function Blink({
  intervalMs = 600,
  minOpacity = 0,
  style,
  children,
}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: minOpacity,
          duration: intervalMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: intervalMs,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [intervalMs, minOpacity, opacity]);

  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

export default Blink;
