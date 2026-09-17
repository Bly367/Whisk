import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { ConfidenceLevel } from '@/import/types';
import { useTheme } from '@/theme/ThemeProvider';

export type ConfidenceBannerProps = {
  level: ConfidenceLevel | undefined;
  message: string;
  testID?: string;
};

function isLow(level: ConfidenceLevel | undefined): boolean {
  return level === 'low' || level === 'unknown' || level === 'medium';
}

/**
 * Warning treatment for uncertain import fields (color + plain copy — not color alone).
 */
export function ConfidenceBanner({ level, message, testID }: ConfidenceBannerProps) {
  const { colors } = useTheme();
  if (!level || level === 'high') return null;
  if (!isLow(level) && level !== 'medium') return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.brand.yolkSoft,
          borderColor: colors.warning,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Needs review: ${message}`}
      testID={testID}
    >
      <Text variant="caption" tone="warning">
        Needs review
      </Text>
      <Text variant="caption" tone="secondary">
        {message}
      </Text>
    </View>
  );
}

export function fieldNeedsReview(level: ConfidenceLevel | undefined): boolean {
  return level === 'low' || level === 'unknown' || level === 'medium';
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
});
