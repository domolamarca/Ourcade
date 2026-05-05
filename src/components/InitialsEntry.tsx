import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArcadeText } from './ArcadeText';
import { colors, neon, spacing, NeonColor } from '../theme';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
const SLOT_ACCENTS: NeonColor[] = ['magenta', 'cyan', 'yellow'];

type Props = {
  initial?: string;
  onChange?: (initials: string) => void;
};

/**
 * Classic 3-slot arcade initials picker. Tap ▲/▼ to step through
 * letters/numbers. Each slot independently editable.
 */
export function InitialsEntry({ initial = 'AAA', onChange }: Props) {
  const [letters, setLetters] = useState<string[]>(() => {
    const seed = (initial.padEnd(3, 'A').slice(0, 3)).toUpperCase();
    return seed.split('').map((c) => (ALPHABET.includes(c) ? c : 'A'));
  });

  const step = (index: number, dir: 1 | -1) => {
    // Compute the new letters in event-handler scope (not inside a
    // setState updater) so that calling the parent's onChange below
    // doesn't trigger React's "setState during render" warning. The
    // previous version nested onChange inside setLetters((prev) => ...)
    // which evaluates during the next render — by that point any
    // state update propagating to a parent counts as "during render."
    const current = ALPHABET.indexOf(letters[index]);
    const nextIdx = (current + dir + ALPHABET.length) % ALPHABET.length;
    const next = [...letters];
    next[index] = ALPHABET[nextIdx];
    setLetters(next);
    onChange?.(next.join(''));
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.lg,
      }}
    >
      {letters.map((letter, i) => (
        <Slot
          key={i}
          letter={letter}
          accent={neon(SLOT_ACCENTS[i % SLOT_ACCENTS.length])}
          onUp={() => step(i, 1)}
          onDown={() => step(i, -1)}
        />
      ))}
    </View>
  );
}

function Slot({
  letter,
  accent,
  onUp,
  onDown,
}: {
  letter: string;
  accent: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <Pressable onPress={onUp} hitSlop={12}>
        <ArcadeText variant="pixel" size={14} color={accent} glowColor={accent}>
          {'▲'}
        </ArcadeText>
      </Pressable>

      <View
        style={{
          width: 56,
          height: 72,
          borderWidth: 2,
          borderColor: accent,
          backgroundColor: colors.bgSurface,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <ArcadeText variant="pixel" size={32} color={accent} glowColor={accent}>
          {letter}
        </ArcadeText>
      </View>

      <Pressable onPress={onDown} hitSlop={12}>
        <ArcadeText variant="pixel" size={14} color={accent} glowColor={accent}>
          {'▼'}
        </ArcadeText>
      </Pressable>
    </View>
  );
}

export default InitialsEntry;
