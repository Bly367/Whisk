import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { describeImportLimit, FREE_TIER, type FreeTierUsage } from '@/features/trust/freeTier';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  usage: FreeTierUsage;
  /** Extra plain-language trial/price line when monetization UI is shown. */
  trialCopy?: string | null;
  testID?: string;
};

/**
 * Transparent free-tier notice — place before limited actions (Add / import).
 * Never mount this as a blocking overlay inside cook mode.
 */
export function LimitNotice({ usage, trialCopy, testID = 'limit-notice' }: Props) {
  const { colors } = useTheme();
  const atLimit = usage.importsUsedThisWeek >= FREE_TIER.importsPerWeek;

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.box,
        {
          backgroundColor: atLimit ? colors.brand.yolkSoft : colors.sunken,
          borderColor: atLimit ? colors.warning : colors.border,
        },
      ]}
    >
      <Text variant="headline" tone={atLimit ? 'warning' : 'primary'}>
        Free plan limits
      </Text>
      <Text variant="body" tone="secondary" testID={`${testID}-body`}>
        {describeImportLimit(usage)}
      </Text>
      {trialCopy ? (
        <Text variant="caption" tone="secondary" testID={`${testID}-trial`}>
          {trialCopy}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
