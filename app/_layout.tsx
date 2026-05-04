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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadLeaderboard } from '../src/data/leaderboard';
import { loadPlayer } from '../src/data/player';
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

  // Hydrate persistent state at boot.
  useEffect(() => {
    loadPlayer().catch(() => {});
    loadLeaderboard().catch(() => {});
  }, []);

  if (!ready) {
    // Keep the screen black-flat while fonts download — splash is still up.
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
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
        <Stack.Screen name="onboarding/initials" />
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
          name="play/tilt-maze"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/walk-the-line"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/slipstream"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/dead-air"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/trivia"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/draw-it"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/pulse"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/memory-grid"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/stroop"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/reaction-light"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/spin-360"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/flip"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/shake"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/card-shark"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="play/vector"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen name="result/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen
          name="shop"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
