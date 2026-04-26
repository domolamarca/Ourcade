// Token shop — mock IAP.
//
// Real in-app-purchase wiring requires:
//   - App Store Connect: register product IDs
//   - expo-in-app-purchases or react-native-iap to actually charge cards
//   - Server-side receipt verification before granting tokens
//
// Until that's in place, the BUY buttons here grant tokens directly
// (clearly labeled "DEV" so we don't kid ourselves about it shipping).
// The UI/UX is the real product though, so we get that right now.

import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArcadeText } from '../src/components/ArcadeText';
import { NeonFrame } from '../src/components/NeonFrame';
import { ScanlineOverlay } from '../src/components/ScanlineOverlay';
import { TOKEN_PACKS, usePlayer } from '../src/data/player';
import { colors, fonts, neon, NeonColor, spacing } from '../src/theme';

type CodeFeedback =
  | { kind: 'idle' }
  | { kind: 'success'; tokens: number; label: string; code: string }
  | { kind: 'invalid' }
  | { kind: 'used' };

export default function Shop() {
  const player = usePlayer();
  const [purchased, setPurchased] = useState<string | null>(null);
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

  function buy(pack: { id: string; tokens: number; label: string }) {
    Alert.alert(
      `Buy ${pack.label}?`,
      `${pack.tokens} tokens — DEV BUILD: this credits the tokens directly without charging. Real IAP wiring is TODO.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            player.grantTokens(pack.tokens);
            setPurchased(pack.id);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
            setTimeout(() => setPurchased(null), 1400);
          },
        },
      ],
    );
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
              {'TOKENS'}
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
                {'TOKENS'}
              </ArcadeText>
            </View>
          </NeonFrame>

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
                      {`+${pendingFree} TOKENS · TAP TO CLAIM`}
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
                  {`+${feedback.tokens} TOKENS  ★`}
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
                {'CHECK SOCIAL FOR DROPS · CODES VARY 25–2,500 TOKENS'}
              </ArcadeText>
            )}
          </NeonFrame>

          {/* Section header */}
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
            <ArcadeText variant="pixel" size={9} color={colors.textMute}>
              {'>> TOKEN PACKS'}
            </ArcadeText>
          </View>

          {/* Packs */}
          {TOKEN_PACKS.map((pack) => {
            const accent = neon(pack.accent as NeonColor);
            const justBought = purchased === pack.id;
            return (
              <Pressable
                key={pack.id}
                onPress={() => buy(pack)}
                style={{ marginBottom: spacing.md }}
              >
                <NeonFrame
                  color={justBought ? neon('green') : accent}
                  thickness={2}
                  padding={spacing.md}
                  glow
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    {/* Left: name + description */}
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <ArcadeText
                          variant="pixel"
                          size={14}
                          color={accent}
                          glowColor={accent}
                        >
                          {pack.label}
                        </ArcadeText>
                        {pack.discountPct ? (
                          <View
                            style={{
                              backgroundColor: accent,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <ArcadeText variant="pixel" size={8} color={colors.bg}>
                              {`-${pack.discountPct}%`}
                            </ArcadeText>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ height: 4 }} />
                      <ArcadeText variant="mono" size={15} color={colors.textDim}>
                        {pack.description}
                      </ArcadeText>
                    </View>
                    {/* Right: tokens + price */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <ArcadeText
                        variant="mono"
                        size={28}
                        color={accent}
                        glowColor={accent}
                      >
                        {pack.tokens}
                      </ArcadeText>
                      <ArcadeText variant="pixel" size={7} color={colors.textMute}>
                        {'TOKENS'}
                      </ArcadeText>
                      <View style={{ height: 4 }} />
                      <ArcadeText variant="pixel" size={11} color={colors.text}>
                        {`$${pack.priceUsd.toFixed(2)}`}
                      </ArcadeText>
                    </View>
                  </View>
                </NeonFrame>
              </Pressable>
            );
          })}

          {/* Footer note */}
          <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
            <ArcadeText variant="pixel" size={7} color={colors.textMute} align="center">
              {'DEV BUILD — NO REAL CHARGES.\nIAP WIRING IS PENDING.'}
            </ArcadeText>
          </View>
        </ScrollView>

        <ScanlineOverlay opacity={0.04} />
      </SafeAreaView>
    </View>
  );
}
