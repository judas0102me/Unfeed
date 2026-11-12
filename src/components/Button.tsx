import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, radius, spacing, useColors } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}) {
  const colors = useColors();
  const background = { primary: colors.text, secondary: colors.surface, danger: colors.danger }[variant];
  const foreground = { primary: colors.background, secondary: colors.text, danger: colors.accentText }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dim: { opacity: 0.6 },
  label: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
});
