// La firma visual de Unfeed: lo que se borra queda tachado.
import { ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius, spacing, useColors } from '@/theme/colors';

export function Struck({ on, thickness = 5, overhang = 4, children }: { on: boolean; thickness?: number; overhang?: number; children: ReactNode }) {
  const colors = useColors();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active) return;
      Animated.timing(progress, {
        toValue: on ? 1 : 0,
        duration: reduced ? 0 : 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      active = false;
    };
  }, [on, progress]);

  return (
    <View style={styles.struck}>
      {children}
      <Animated.View
        style={[
          styles.line,
          { left: -overhang, right: -overhang, height: thickness, marginTop: -thickness / 2, backgroundColor: colors.accent, transform: [{ scaleX: progress }] },
        ]}
      />
    </View>
  );
}

export function Wordmark() {
  const colors = useColors();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Unfeed" style={styles.wordmark}>
      <Text style={[styles.wordmarkText, { color: colors.text }]}>Un</Text>
      <Struck on thickness={4} overhang={0}>
        <Text style={[styles.wordmarkText, { color: colors.text }]}>feed</Text>
      </Struck>
    </View>
  );
}

export function CategoryWord({ label, struck, dim, size = 56 }: { label: string; struck: boolean; dim?: boolean; size?: number }) {
  const colors = useColors();
  return (
    <Struck on={struck} thickness={Math.round(size / 10)}>
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.12, color: dim ? colors.textMuted : colors.text }]}>{label}</Text>
    </Struck>
  );
}

// Marcar una categoría la tacha: lo tachado es lo que se va a borrar.
export function CategoryToggle({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <CategoryWord label={label} struck={selected} />
    </Pressable>
  );
}

export function Meter({ value, max }: { value: number; max: number }) {
  const colors = useColors();
  return (
    <View style={[styles.meter, { backgroundColor: colors.border }]}>
      <View style={[styles.meterFill, { backgroundColor: colors.text, width: `${Math.round((value / max) * 100)}%` }]} />
    </View>
  );
}

export function Count({ value, label }: { value: number; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.count}>
      <Text style={[styles.countNumber, { color: colors.accent }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  struck: { alignSelf: 'flex-start' },
  line: { position: 'absolute', top: '54%', borderRadius: 2, transformOrigin: 'left' },
  wordmark: { flexDirection: 'row' },
  wordmarkText: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44 },
  word: { fontFamily: fonts.display },
  toggle: { alignSelf: 'stretch', paddingVertical: spacing.xs },
  pressed: { opacity: 0.6 },
  meter: { height: 6, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.sm },
  meterFill: { height: '100%' },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  countNumber: { fontFamily: fonts.display, fontSize: 84, lineHeight: 90, fontVariant: ['tabular-nums'] },
  countLabel: { fontFamily: fonts.strong, fontSize: 16 },
});
