import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import {
  ConfidenceBanner,
  fieldNeedsReview,
} from '@/components/import/ConfidenceBanner';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { ConfidenceLevel } from '@/import/types';
import { useTheme } from '@/theme/ThemeProvider';

export type ConfidenceFieldProps = TextInputProps & {
  label: string;
  confidence?: ConfidenceLevel;
  reviewHint?: string;
  testID?: string;
};

export function ConfidenceField({
  label,
  confidence,
  reviewHint,
  testID,
  style,
  ...rest
}: ConfidenceFieldProps) {
  const { colors } = useTheme();
  const review = fieldNeedsReview(confidence);

  return (
    <View style={styles.wrap} testID={testID}>
      <Text variant="headline">{label}</Text>
      <TextInput
        {...rest}
        allowFontScaling
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: review ? colors.warning : colors.border,
            color: colors.textPrimary,
          },
          style,
        ]}
        accessibilityLabel={label}
        accessibilityHint={
          review ? reviewHint ?? 'This field may need a closer look' : undefined
        }
      />
      {review && reviewHint ? (
        <ConfidenceBanner level={confidence} message={reviewHint} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    lineHeight: 22,
  },
});
