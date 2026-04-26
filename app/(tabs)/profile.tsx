// Player card. Stats + sensor permission status. Initials editable here so
// users don't have to wait for a high score to set them.

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { InitialsEntry } from '../../src/components/InitialsEntry';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import { usePlayer } from '../../src/data/player';
import { colors, neon, spacing } from '../../src/theme';

// Stub sensor permission rows. Wire to real Expo permission APIs once we
// add the sensor-using games.
const SENSORS = [
  { key: 'TOUCH', label: 'TOUCH', state: 'OK' },
  { key: 'MOTION', label: 'ACCEL/GYRO', state: 'OK' },
  { key: 'MIC', label: 'MICROPHONE', state: 'ASK' },
  { key: 'MAG', label: 'COMPASS', state: 'OK' },
  { key: 'BARO', label: 'BAROMETER', state: 'OK' },
  { key: 'GPS', label: 'LOCATION', state: 'ASK' },
  { key: 'CAM', label: 'CAMERA', state: 'OFF' },
] as const;

const STATE_COLOR: Record<string, string> = {
  OK: neon('green'),
  ASK: neon('yellow'),
  OFF: neon('red'),
};

export default function ProfileScreen() {
  const player = usePlayer();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        <ArcadeText variant="pixel" size={9} color={colors.textMute}>
          {'>> PLAYER ONE'}
        </ArcadeText>
        <View style={{ height: 4 }} />
        <ArcadeText variant="pixel" size={20} color={neon('cyan')} glowColor={neon('cyan')}>
          {'PROFILE'}
        </ArcadeText>

        {/* Initials editor */}
        <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'YOUR INITIALS'}
          </ArcadeText>
          <View style={{ height: spacing.md }} />
          <InitialsEntry initial={player.initials} onChange={player.setInitials} />
        </View>

        {/* Stat row */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: spacing.xl,
          }}
        >
          <Stat label="CREDITS" value={String(player.coins)} color={neon('yellow')} />
          <Stat label="PLAYS" value={String(player.totalPlays)} color={neon('magenta')} />
          <Stat label="#1 WINS" value={String(player.highScores)} color={neon('green')} />
        </View>

        {/* Sensor status */}
        <View style={{ marginTop: spacing.xl }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'>> SENSOR STATUS'}
          </ArcadeText>
          <View style={{ height: spacing.sm }} />
          <NeonFrame color={colors.border} thickness={1} glow={false} padding={0}>
            {SENSORS.map((s, i) => (
              <View
                key={s.key}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderBottomWidth: i === SENSORS.length - 1 ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <ArcadeText variant="pixel" size={9} color={colors.text}>
                  {s.label}
                </ArcadeText>
                <ArcadeText
                  variant="pixel"
                  size={9}
                  color={STATE_COLOR[s.state]}
                  glowColor={STATE_COLOR[s.state]}
                >
                  {s.state}
                </ArcadeText>
              </View>
            ))}
          </NeonFrame>
        </View>

        <View style={{ height: spacing.lg }} />
        <ArcadeText variant="pixel" size={7} color={colors.textMute} align="center">
          {'V0.1 — THEME PREVIEW BUILD'}
        </ArcadeText>
      </ScrollView>

      <ScanlineOverlay opacity={0.05} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <NeonFrame color={color} thickness={1} padding={spacing.sm} glow={false} style={{ flex: 1 }}>
      <ArcadeText variant="pixel" size={7} color={colors.textMute} align="center">
        {label}
      </ArcadeText>
      <View style={{ height: 4 }} />
      <ArcadeText variant="mono" size={26} color={color} align="center">
        {value}
      </ArcadeText>
    </NeonFrame>
  );
}
