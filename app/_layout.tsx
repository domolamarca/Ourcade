// Root layout. Responsibilities:
//  1) Load arcade fonts before any screen renders.
//  2) Configure the Stack navigator that wraps the entire app.
//  3) Hold the splash screen open until fonts finish loading.

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as usePressStart,
  PressStart2P_400Regular,
} from '@expo-google-fonts/press-start-2p';
import {
  useFonts as useVT,
  VT323_400Regular,
} from '@expo-google-fonts/vt323';
import { View } from 'react-native';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* irrelevant if it's already dismissed */
});

export default function RootLayout() {
  const [pressLoaded] = usePressStart({ PressStart2P: PressStart2P_400Regular });
  const [vtLoaded] = useVT({ VT323: VT323_400Regular });
  const ready = pressLoaded && vtLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    // Keep the screen black-flat while fonts download — splash is still up.
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen
          name="play/tap-bullseye"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/minesweep"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/ghost"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen name="result/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
