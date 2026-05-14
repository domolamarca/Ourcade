// Settings screen.
//
// Audio + haptic toggles, privacy / terms links, and (per Apple
// guidelines) a DELETE ACCOUNT flow that wipes local state. Reachable
// from the Player tab.
//
// v1.0.1: removed the REDEEM PROMO CODE shortcut for App Store
// compliance with guideline 3.1.1 (no non-IAP unlock mechanisms). Code
// redemption returns in v1.1 via Apple Offer Codes against real IAP
// products.

import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { ArcadeText } from '../src/components/ArcadeText';
import { NeonFrame } from '../src/components/NeonFrame';
import { ScanlineOverlay } from '../src/components/ScanlineOverlay';
import { usePlayer } from '../src/data/player';
import { colors, neon, spacing } from '../src/theme';

// Hosted on GitHub Pages from /docs in this repo. Enable Pages in repo
// settings → Pages → Deploy from branch: main, folder: /docs. If you
// later move to a custom domain, redirect from these URLs so the app
// shipped to TestFlight + the App Store keeps working.
const PRIVACY_URL = 'https://domolamarca.github.io/Ourcade/privacy.html';
const TERMS_URL = 'https://domolamarca.github.io/Ourcade/terms.html';
// Apple expects a working support contact reachable from inside the
// app. mailto: opens the user's default mail client with a prefilled
// subject so triage is easier on the receiving end.
const SUPPORT_EMAIL = 'domlamarca@gmail.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ourcade Support')}`;

export default function SettingsScreen() {
  const player = usePlayer();

  const settings = player.settings;

  const toggle = (key: 'soundOn' | 'hapticsOn' | 'musicOn') => () => {
    const next = !settings[key];
    player.setSetting(key, next);
    if (next || key !== 'hapticsOn') {
      // Confirm flip with a tap haptic — but skip when turning haptics
      // off (would be ironic) and the haptics flag was already off.
      if (settings.hapticsOn) {
        Haptics.selectionAsync().catch(() => {});
      }
    }
  };

  const openLink = (url: string) => () => {
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Cannot Open Link',
        'Your device blocked this link. Try opening it from a browser:\n' + url,
      );
    });
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Account?',
      'This wipes your initials, tokens, personal bests, daily-challenge progress, and tutorial history on this device. Leaderboard scores stay live (they are anonymous).\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await player.resetPlayer();
            // Send them back to the lobby; on next launch they'll
            // hit the initials-prompt flow as a fresh player.
            router.replace('/');
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '0.1.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.runtimeVersion ?? '—';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'>> PLAYER'}
            </ArcadeText>
            <View style={{ height: 4 }} />
            <ArcadeText
              variant="pixel"
              size={20}
              color={neon('cyan')}
              glowColor={neon('cyan')}
            >
              {'SETTINGS'}
            </ArcadeText>
          </View>
          <Pressable onPress={() => router.back()}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'<<  DONE'}
            </ArcadeText>
          </Pressable>
        </View>

        {/* AUDIO + HAPTICS */}
        <SectionLabel text="FEEL & SOUND" />
        <NeonFrame
          color={colors.border}
          thickness={1}
          glow={false}
          padding={0}
        >
          <Toggle
            label="SOUND EFFECTS"
            on={settings.soundOn}
            onPress={toggle('soundOn')}
          />
          <Divider />
          <Toggle
            label="MUSIC"
            on={settings.musicOn}
            onPress={toggle('musicOn')}
          />
          <Divider />
          <Toggle
            label="HAPTICS"
            on={settings.hapticsOn}
            onPress={toggle('hapticsOn')}
          />
        </NeonFrame>

        {/* LEGAL + SUPPORT */}
        <View style={{ height: spacing.xl }} />
        <SectionLabel text="HELP & LEGAL" />
        <NeonFrame color={colors.border} thickness={1} glow={false} padding={0}>
          <Row
            label="CONTACT SUPPORT"
            sub={SUPPORT_EMAIL}
            onPress={openLink(SUPPORT_MAILTO)}
            external
          />
          <Divider />
          <Row label="PRIVACY POLICY" onPress={openLink(PRIVACY_URL)} external />
          <Divider />
          <Row label="TERMS OF SERVICE" onPress={openLink(TERMS_URL)} external />
        </NeonFrame>

        {/* DANGER ZONE */}
        <View style={{ height: spacing.xl }} />
        <SectionLabel text="DANGER ZONE" color={neon('red')} />
        <NeonFrame color={neon('red')} thickness={1} glow={false} padding={0}>
          <Row
            label="DELETE ACCOUNT"
            sub="Wipe all local progress on this device"
            onPress={confirmDelete}
            danger
          />
        </NeonFrame>

        {/* ABOUT */}
        <View style={{ height: spacing.xl }} />
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'OURCADE'}
          </ArcadeText>
          <View style={{ height: 4 }} />
          <ArcadeText variant="mono" size={13} color={colors.textDim}>
            {`v${version} · build ${buildNumber}`}
          </ArcadeText>
          <View style={{ height: 4 }} />
          <ArcadeText variant="pixel" size={7} color={colors.textMute}>
            {'MADE WITH ♥ FOR THE ARCADE FLOOR'}
          </ArcadeText>
        </View>
      </ScrollView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}

// ---------- Reusable settings widgets -----------------------------------

function SectionLabel({ text, color }: { text: string; color?: string }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <ArcadeText
        variant="pixel"
        size={9}
        color={color ?? colors.textMute}
        glowColor={color}
      >
        {`>> ${text}`}
      </ArcadeText>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        <ArcadeText variant="pixel" size={11} color={colors.text}>
          {label}
        </ArcadeText>
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: on ? neon('green') : colors.border,
            backgroundColor: on ? colors.bgSurface : 'transparent',
          }}
        >
          <ArcadeText
            variant="pixel"
            size={10}
            color={on ? neon('green') : colors.textMute}
            glowColor={on ? neon('green') : undefined}
          >
            {on ? 'ON' : 'OFF'}
          </ArcadeText>
        </View>
      </View>
    </Pressable>
  );
}

function Row({
  label,
  sub,
  onPress,
  external,
  danger,
  disabled,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const labelColor = danger ? neon('red') : colors.text;
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <ArcadeText variant="pixel" size={11} color={labelColor}>
            {label}
          </ArcadeText>
          {sub ? (
            <View>
              <View style={{ height: 4 }} />
              <ArcadeText variant="mono" size={12} color={colors.textDim}>
                {sub}
              </ArcadeText>
            </View>
          ) : null}
        </View>
        <ArcadeText
          variant="pixel"
          size={12}
          color={danger ? neon('red') : colors.textMute}
        >
          {external ? '↗' : danger ? '⚠' : '>'}
        </ArcadeText>
      </View>
    </Pressable>
  );
}
