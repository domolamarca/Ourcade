// Tab bar — the "cabinet panel" along the bottom of the screen.

import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { ArcadeText } from '../../src/components/ArcadeText';
import { colors, neon } from '../../src/theme';

type IconProps = { focused: boolean; glyph: string; color: string };

function TabGlyph({ focused, glyph, color }: IconProps) {
  return (
    <View
      style={{
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ArcadeText
        variant="pixel"
        size={focused ? 18 : 14}
        color={focused ? color : colors.textMute}
        glowColor={focused ? color : undefined}
      >
        {glyph}
      </ArcadeText>
    </View>
  );
}

function TabLabel({ focused, label, color }: { focused: boolean; label: string; color: string }) {
  return (
    <ArcadeText
      variant="pixel"
      size={7}
      color={focused ? color : colors.textMute}
      glowColor={focused ? color : undefined}
      style={{ marginTop: 2 }}
      numberOfLines={1}
    >
      {label}
    </ArcadeText>
  );
}

// Wide-enough column so the label doesn't wrap to a second line. The
// icon naturally centers within whatever width the parent gives it.
const tabColumnStyle = {
  alignItems: 'center' as const,
  width: 90,
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={tabColumnStyle}>
              <TabGlyph focused={focused} glyph="◆" color={neon('magenta')} />
              <TabLabel focused={focused} label="MENU" color={neon('magenta')} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={tabColumnStyle}>
              <TabGlyph focused={focused} glyph="★" color={neon('yellow')} />
              <TabLabel focused={focused} label="SCORES" color={neon('yellow')} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={tabColumnStyle}>
              <TabGlyph focused={focused} glyph="◉" color={neon('cyan')} />
              <TabLabel focused={focused} label="PLAYER" color={neon('cyan')} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
