import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  testID?: string;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  testID,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? colors.brand.yolk
      : variant === 'destructive'
        ? colors.error
        : variant === 'secondary'
          ? colors.card
          : 'transparent';

  const borderColor =
    variant === 'secondary' ? colors.border : 'transparent';

  const labelColor =
    variant === 'primary'
      ? colors.textOnYolk
      : variant === 'destructive'
        ? colors.card
        : variant === 'tertiary'
          ? colors.info
          : colors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={hitSlop}
      testID={testID}
      style={(state) => {
        const pressed = state.pressed;
        const base: ViewStyle = {
          ...styles.base,
          backgroundColor:
            variant === 'primary' && pressed
              ? colors.brand.yolkPressed
              : backgroundColor,
          borderColor,
          opacity: isDisabled ? 0.45 : 1,
        };
        const resolved =
          typeof style === 'function' ? style(state) : style;
        return [ensureMinTouchTarget(base), resolved];
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text variant="callout" style={{ color: labelColor }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
