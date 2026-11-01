import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, useColors } from '@/theme/colors';

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
  const background = { primary: colors.accent, secondary: colors.surface, danger: colors.danger }[variant];
  const foreground = variant === 'secondary' ? colors.text : colors.accentText;
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dim: { opacity: 0.6 },
  label: { fontSize: 17, fontWeight: '600' },
});
