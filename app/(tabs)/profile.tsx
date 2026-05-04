// Player card. Stats + sensor permission status. Initials editable here so
// users don't have to wait for a high score to set them.

import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArcadeText } from '../../src/components/ArcadeText';
import { Blink } from '../../src/components/Blink';
import { InitialsEntry } from '../../src/components/InitialsEntry';
import { NeonFrame } from '../../src/components/NeonFrame';
import { ScanlineOverlay } from '../../src/components/ScanlineOverlay';
import {
  games,
  SKILL_COLORS,
  SKILL_LABELS,
  SKILL_ORDER,
  SkillCategory,
} from '../../src/data/games';
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
          <Stat label="CREDITS" value={String(player.tokens)} color={neon('yellow')} />
          <Stat label="PLAYS" value={String(player.totalPlays)} color={neon('magenta')} />
          <Stat label="#1 WINS" value={String(player.highScores)} color={neon('green')} />
        </View>

        {/* Get more tokens — quick link to shop */}
        <Pressable onPress={() => router.push('/shop')} style={{ marginTop: spacing.md }}>
          <NeonFrame color={neon('yellow')} thickness={2} padding={spacing.md} glow>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <ArcadeText variant="pixel" size={9} color={neon('yellow')} glowColor={neon('yellow')}>
                  {'NEED MORE CREDITS?'}
                </ArcadeText>
                <View style={{ height: 4 }} />
                {player.pendingFreeTokens() > 0 ? (
                  <Blink intervalMs={500} minOpacity={0.5}>
                    <ArcadeText variant="mono" size={14} color={neon('green')} glowColor={neon('green')}>
                      {`+${player.pendingFreeTokens()} FREE READY`}
                    </ArcadeText>
                  </Blink>
                ) : (
                  <ArcadeText variant="mono" size={14} color={colors.textDim}>
                    {'BROWSE PACKS'}
                  </ArcadeText>
                )}
              </View>
              <ArcadeText variant="pixel" size={20} color={neon('yellow')}>
                {'>>'}
              </ArcadeText>
            </View>
          </NeonFrame>
        </Pressable>

        {/* Settings — sound, haptics, promo code, legal, delete account.
            Moved above sensor status so the most-used utility surface
            (toggles + account) is closer to the top of the page. */}
        <View style={{ height: spacing.xl }} />
        <Pressable onPress={() => router.push('/settings')}>
          <NeonFrame
            color={neon('cyan')}
            thickness={2}
            padding={spacing.md}
            glow={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <ArcadeText
                  variant="pixel"
                  size={11}
                  color={neon('cyan')}
                  glowColor={neon('cyan')}
                >
                  {'SETTINGS'}
                </ArcadeText>
                <View style={{ height: 4 }} />
                <ArcadeText variant="mono" size={13} color={colors.textDim}>
                  {'Sound · Haptics · Privacy · Account'}
                </ArcadeText>
              </View>
              <ArcadeText variant="pixel" size={20} color={neon('cyan')}>
                {'>>'}
              </ArcadeText>
            </View>
          </NeonFrame>
        </Pressable>

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

        {/* Skill categories — color key for the lobby's bucket headers
            so a player who wonders "what's the red row?" has an answer
            without leaving the app. Counts only show visible cabinets
            (hidden ones don't render in the lobby). */}
        <View style={{ marginTop: spacing.xl }}>
          <ArcadeText variant="pixel" size={9} color={colors.textMute}>
            {'>> SKILL CATEGORIES'}
          </ArcadeText>
          <View style={{ height: spacing.sm }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {SKILL_ORDER.map((skill) => {
              const skillColor = neon(SKILL_COLORS[skill]);
              const count = cabinetCountForSkill(skill);
              return (
                <View
                  key={skill}
                  style={{ width: '48%' }}
                >
                  <NeonFrame
                    color={skillColor}
                    thickness={2}
                    padding={spacing.sm}
                    glow={false}
                    fill={colors.bgSurface}
                  >
                    <ArcadeText
                      variant="pixel"
                      size={10}
                      color={skillColor}
                      glowColor={skillColor}
                      align="center"
                    >
                      {SKILL_LABELS[skill]}
                    </ArcadeText>
                    <View style={{ height: 4 }} />
                    <ArcadeText
                      variant="mono"
                      size={18}
                      color={skillColor}
                      align="center"
                    >
                      {`${count} CABINET${count === 1 ? '' : 'S'}`}
                    </ArcadeText>
                  </NeonFrame>
                </View>
              );
            })}
          </View>
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

/** How many visible (non-hidden) cabinets fall into a given skill bucket.
 *  Hidden cabinets are excluded — they aren't shown in the lobby, so
 *  the count would mislead players. */
function cabinetCountForSkill(skill: SkillCategory): number {
  return games.filter((g) => g.skill === skill && !g.hidden).length;
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
