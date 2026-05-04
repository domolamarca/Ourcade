// Small EXIT button for in-game screens. Tap fires a confirmation
// dialog ("forfeit this token and return to menu?"). Confirm routes
// to /home. Drops absolutely-positioned into any play screen.
//
// Position: top-right, BELOW the safe-area inset so the chip clears
// the iPhone Dynamic Island / notch. Sitting on top of the inset
// makes it (a) hard to tap because iOS reserves touches near the
// island, and (b) physically out of reach. We push it down by the
// safe-area top inset plus a small breathing gap, and use a chunky
// hitSlop so it's a comfortable thumb target.

import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArcadeText } from './ArcadeText';
import { colors } from '../theme';

type Props = {
  /** Optional override of the confirmation copy. */
  message?: string;
  /** Extra vertical offset (px) below the safe-area inset. Default 4. */
  topOffset?: number;
};

export function InGameExit({ message, topOffset = 4 }: Props) {
  const insets = useSafeAreaInsets();

  function confirm() {
    Alert.alert(
      'Quit run?',
      message ?? 'Forfeit this token and return to the main menu?',
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Quit',
          style: 'destructive',
          onPress: () => router.replace('/home'),
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        // Top-left, compact icon. Wider chip earlier kept overlapping
        // timer bars and HUD readouts on different cabinets.
        top: insets.top + topOffset,
        left: 8,
        zIndex: 100,
        elevation: 100,
      }}
    >
      <Pressable
        onPress={confirm}
        hitSlop={18}
        style={({ pressed }) => ({
          opacity: pressed ? 0.5 : 1,
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(8,8,15,0.92)',
          borderWidth: 1,
          borderColor: colors.textMute,
        })}
      >
        <ArcadeText variant="pixel" size={11} color={colors.text}>
          {'✕'}
        </ArcadeText>
      </Pressable>
    </View>
  );
}

export default InGameExit;
