// Credit shop.
//
// v1.0 ships without any in-app purchases — credits come exclusively
// from daily drops, the welcome bonus, personal-best bonuses, and
// promo codes. The pack-store UI is intentionally not rendered (we
// keep TOKEN_PACKS in player.ts so v1.1 can re-enable it without a
// data-model change). This screen now offers two surfaces:
//   1. Daily drop claim (free credits the welcome window grants).
//   2. Promo code redemption (codes mint free credits — no real money).

import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../src/components/ArcadeText';
import { NeonFrame } from '../src/components/NeonFrame';
import { ScanlineOverlay } from '../src/components/ScanlineOverlay';
import { usePlayer } from '../src/data/player';
import { colors, fonts, neon, spacing } from '../src/theme';

type CodeFeedback =
  | { kind: 'idle' }
  | { kind: 'success'; tokens: number; label: string; code: string }
  | { kind: 'invalid' }
  | { kind: 'used' };

export default function Shop() {
  const player = usePlayer();
  const pendingFree = player.pendingFreeTokens();

  // Promo code state
  const [codeInput, setCodeInput] = useState('');
  const [feedback, setFeedback] = useState<CodeFeedback>({ kind: 'idle' });
  const inputRef = useRef<TextInput>(null);

  function redeem() {
    const trimmed = codeInput.trim();
    if (!trimmed) return;
    const result = player.redeemPromoCode(trimmed);
    if (result.ok) {
      setFeedback({
        kind: 'success',
        tokens: result.tokens,
        label: result.label,
        code: result.code,
      });
      setCodeInput('');
      inputRef.current?.blur();
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } else if (result.reason === 'used') {
      setFeedback({ kind: 'used' });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    } else {
      setFeedback({ kind: 'invalid' });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
  }

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
              {'>> SHOP'}
            </ArcadeText>
            <View style={{ height: 4 }} />
            <ArcadeText
              variant="pixel"
              size={20}
              color={neon('yellow')}
              glowColor={neon('yellow')}
            >
              {'CREDITS'}
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

          {/* Promo code redemption */}
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'>> REDEEM CODE'}
            </ArcadeText>
          </View>
          <NeonFrame
            color={
              feedback.kind === 'success'
                ? neon('green')
                : feedback.kind === 'invalid' || feedback.kind === 'used'
                  ? neon('red')
                  : neon('cyan')
            }
            thickness={2}
            padding={spacing.md}
            glow={feedback.kind === 'success'}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <TextInput
                ref={inputRef}
                value={codeInput}
                onChangeText={(text) => {
                  setCodeInput(text.toUpperCase());
                  if (feedback.kind !== 'idle') setFeedback({ kind: 'idle' });
                }}
                onSubmitEditing={redeem}
                returnKeyType="go"
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="ENTER CODE"
                placeholderTextColor={colors.textMute}
                style={{
                  flex: 1,
                  fontFamily: fonts.mono,
                  fontSize: 20,
                  color: colors.text,
                  letterSpacing: 2,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
              <Pressable onPress={redeem} disabled={!codeInput.trim()}>
                <View
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: codeInput.trim() ? neon('cyan') : colors.bgElevated,
                  }}
                >
                  <ArcadeText
                    variant="pixel"
                    size={11}
                    color={codeInput.trim() ? colors.bg : colors.textMute}
                  >
                    {'REDEEM'}
                  </ArcadeText>
                </View>
              </Pressable>
            </View>

            {/* Feedback line */}
            <View style={{ height: spacing.sm }} />
            {feedback.kind === 'success' ? (
              <View>
                <ArcadeText
                  variant="pixel"
                  size={10}
                  color={neon('green')}
                  glowColor={neon('green')}
                >
                  {`+${feedback.tokens} CREDITS  ★`}
                </ArcadeText>
                <View style={{ height: 4 }} />
                <ArcadeText variant="mono" size={13} color={colors.textDim}>
                  {`${feedback.code} — ${feedback.label}`}
                </ArcadeText>
              </View>
            ) : feedback.kind === 'invalid' ? (
              <ArcadeText variant="pixel" size={9} color={neon('red')} glowColor={neon('red')}>
                {'INVALID CODE'}
              </ArcadeText>
            ) : feedback.kind === 'used' ? (
              <ArcadeText variant="pixel" size={9} color={neon('red')} glowColor={neon('red')}>
                {'CODE ALREADY USED'}
              </ArcadeText>
            ) : (
              <ArcadeText variant="pixel" size={8} color={colors.textMute}>
                {'CHECK SOCIAL FOR DROPS · CODES VARY 25–2,500 CREDITS'}
              </ArcadeText>
            )}
          </NeonFrame>

          {/* Footer note — daily drops + promo codes are the credit
              economy in v1.0. Pack store deliberately not rendered
              (Apple guideline 2.3.1 disallows preview of features
              that aren't yet enabled). */}
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute} align="center">
              {'DAILY DROPS + PROMO CODES'}
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
