import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import {
  describeImportLimit,
  FREE_TIER,
  hasUnlimitedAccess,
  type Entitlement,
  type FreeTierUsage,
} from '@/features/trust/freeTier';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  usage: FreeTierUsage;
  entitlement?: Entitlement;
  /** Extra plain-language unlock/price line when monetization UI is shown. */
  unlockCopy?: string | null;
  /** @deprecated Prefer unlockCopy */
  trialCopy?: string | null;
  testID?: string;
};

/**
 * Transparent free-tier notice — place before limited actions (Add / import).
 * Never mount this as a blocking overlay inside cook mode.
 */
export function LimitNotice({
  usage,
  entitlement = 'free',
  unlockCopy,
  trialCopy,
  testID = 'limit-notice',
}: Props) {
  const { colors } = useTheme();
  const unlimited = hasUnlimitedAccess(entitlement);
  const atLimit = !unlimited && usage.importsUsedThisWeek >= FREE_TIER.importsPerWeek;
  const offerCopy = unlockCopy ?? trialCopy ?? null;

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
        {unlimited ? (entitlement === 'admin' ? 'Admin unlock' : 'Unlocked') : 'Free plan limits'}
      </Text>
      <Text variant="body" tone="secondary" testID={`${testID}-body`}>
        {describeImportLimit(usage, entitlement)}
      </Text>
      {offerCopy && !unlimited ? (
        <Text variant="caption" tone="secondary" testID={`${testID}-trial`}>
          {offerCopy}
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
