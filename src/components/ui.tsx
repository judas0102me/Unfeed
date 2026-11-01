// Piezas básicas de interfaz con los colores del tema.
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useColors } from '@/theme/colors';

export function Screen({ children, scroll, footer }: { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.fill}>
      {body}
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Heading({ children, style, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, ...rest }: TextProps & { muted?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[styles.body, { color: muted ? colors.textMuted : colors.text }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

// Fila con casilla (selección múltiple) o círculo (una opción).
export function OptionRow({
  label,
  selected,
  onPress,
  kind = 'checkbox',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  kind?: 'checkbox' | 'radio';
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { borderColor: colors.border }, pressed && styles.pressed]}
    >
      <View
        style={[
          kind === 'checkbox' ? styles.checkbox : styles.radio,
          { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : 'transparent' },
        ]}
      >
        {selected && <Text style={[styles.mark, { color: colors.accentText }]}>✓</Text>}
      </View>
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      {({ pressed }) => <Text style={[styles.link, { color: colors.accent }, pressed && styles.pressed]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  heading: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mark: { fontSize: 14, fontWeight: '700' },
  optionLabel: { fontSize: 17 },
  link: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
