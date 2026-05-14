// Credit shop.
//
// v1.0 ships without any in-app purchases — credits come exclusively
// from gameplay: the welcome bonus, the daily free drop, daily-challenge
// plays, and personal-best / leaderboard bonuses. The pack-store UI is
// intentionally not rendered (TOKEN_PACKS still lives in player.ts so
// v1.1 can re-enable it without a data-model change).
//
// v1.0.1: promo code redemption removed for App Store compliance with
// guideline 3.1.1 (any mechanism that unlocks app functionality outside
// IAP isn't allowed, regardless of whether money changes hands). When
// IAPs land in v1.1, code redemption returns via Apple Offer Codes
// against a real IAP product.

import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../src/components/ArcadeText';
import { NeonFrame } from '../src/components/NeonFrame';
import { ScanlineOverlay } from '../src/components/ScanlineOverlay';
import { usePlayer } from '../src/data/player';
import { colors, neon, spacing } from '../src/theme';

export default function Shop() {
  const player = usePlayer();
  const pendingFree = player.pendingFreeTokens();

  function claimFree() {
    const granted = player.claimDailyIfDue();
    if (granted > 0) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
          }}
        >
          <View>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'>> CREDITS'}
            </ArcadeText>
            <View style={{ height: 4 }} />
            <ArcadeText
              variant="pixel"
              size={20}
              color={neon('yellow')}
              glowColor={neon('yellow')}
            >
              {'BALANCE'}
            </ArcadeText>
          </View>
          <Pressable onPress={() => router.back()}>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <ArcadeText variant="pixel" size={9} color={colors.textDim}>
                {'CLOSE  ✕'}
              </ArcadeText>
            </View>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          {/* Current balance */}
          <NeonFrame color={neon('yellow')} thickness={2} padding={spacing.md} glow>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <ArcadeText variant="pixel" size={9} color={colors.textMute}>
                  {'BALANCE'}
                </ArcadeText>
                <ArcadeText
                  variant="mono"
                  size={36}
                  color={neon('yellow')}
                  glowColor={neon('yellow')}
                >
                  {String(player.tokens)}
                </ArcadeText>
              </View>
              <ArcadeText variant="pixel" size={9} color={colors.textDim}>
                {'CREDITS'}
              </ArcadeText>
            </View>
          </NeonFrame>

          {/* Welcome window — first 7 days of new accounts get 2x daily drops */}
          {player.inWelcomeWindow ? (
            <View
              style={{
                marginTop: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderWidth: 1,
                borderColor: neon('green'),
                backgroundColor: 'rgba(57,255,20,0.08)',
              }}
            >
              <ArcadeText
                variant="pixel"
                size={9}
                color={neon('green')}
                glowColor={neon('green')}
                align="center"
              >
                {'★ WELCOME WEEK · 2X DAILY DROPS ★'}
              </ArcadeText>
            </View>
          ) : null}

          {/* Free daily grant — shown prominently when due */}
          {pendingFree > 0 ? (
            <Pressable onPress={claimFree} style={{ marginTop: spacing.md }}>
              <NeonFrame color={neon('green')} thickness={2} padding={spacing.md} glow>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <ArcadeText
                      variant="pixel"
                      size={11}
                      color={neon('green')}
                      glowColor={neon('green')}
                    >
                      {'DAILY DROP READY'}
                    </ArcadeText>
                    <View style={{ height: 4 }} />
                    <ArcadeText variant="mono" size={16} color={colors.text}>
                      {`+${pendingFree} CREDITS · TAP TO CLAIM`}
                    </ArcadeText>
                  </View>
                  <ArcadeText variant="pixel" size={20} color={neon('green')}>
                    {'★'}
                  </ArcadeText>
                </View>
              </NeonFrame>
            </Pressable>
          ) : (
            <View style={{ marginTop: spacing.md, paddingVertical: spacing.sm }}>
              <ArcadeText
                variant="pixel"
                size={8}
                color={colors.textMute}
                align="center"
              >
                {'NEXT FREE DROP IN 24H'}
              </ArcadeText>
            </View>
          )}

          {/* How to earn — quick reference so players know the credit
              economy at a glance. */}
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'>> HOW TO EARN'}
            </ArcadeText>
          </View>
          <NeonFrame color={colors.border} thickness={1} padding={spacing.md}>
            <EarnRow label="DAILY DROP" detail="+50 EVERY 24H" />
            <View style={{ height: spacing.sm }} />
            <EarnRow label="WELCOME WEEK" detail="2X DAILY · FIRST 7 DAYS" />
            <View style={{ height: spacing.sm }} />
            <EarnRow label="DAILY CHALLENGE" detail="FREE PLAY · ROTATES DAILY" />
            <View style={{ height: spacing.sm }} />
            <EarnRow label="PERSONAL BEST" detail="+5 PER CABINET" />
            <View style={{ height: spacing.sm }} />
            <EarnRow label="TOP 10 FINISH" detail="+20 FIRST TIME / CABINET" />
            <View style={{ height: spacing.sm }} />
            <EarnRow label="#1 FINISH" detail="+50 FIRST TIME / CABINET" />
          </NeonFrame>

          {/* Footer note */}
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute} align="center">
              {'PLAY WELL · EARN MORE'}
            </ArcadeText>
            <View style={{ height: 4 }} />
            <ArcadeText variant="pixel" size={7} color={colors.textMute} align="center">
              {'KEEP THE CREDITS FLOWING'}
            </ArcadeText>
          </View>
        </ScrollView>

        <ScanlineOverlay opacity={0.04} />
      </SafeAreaView>
    </View>
  );
}

function EarnRow({ label, detail }: { label: string; detail: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <ArcadeText variant="pixel" size={10} color={colors.text}>
        {label}
      </ArcadeText>
      <ArcadeText variant="mono" size={12} color={colors.textDim}>
        {detail}
      </ArcadeText>
    </View>
  );
}
