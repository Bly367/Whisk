import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { SyncBannerStatus } from '@/data/contracts';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/** @deprecated Prefer `SyncBannerStatus` from `@/data/contracts`. */
export type SyncStatus = SyncBannerStatus;

const STATUS_COPY: Record<SyncBannerStatus, string> = {
  saved_locally: 'Saved on this device. Sync comes later.',
  syncing: 'Syncing…',
  synced: 'Synced',
  needs_attention: 'Needs attention — your edits are still on this device.',
  offline: 'Offline. Your recipes stay available here.',
};

export type SyncStatusBannerProps = {
  status?: SyncBannerStatus;
  testID?: string;
};

/**
 * Visible sync-status chrome for local-first trust UX.
 * Driven by `useSyncStatusStore` (local persist outcomes). Never fakes cloud sync.
 */
export function SyncStatusBanner({
  status = 'saved_locally',
  testID = 'sync-status-banner',
}: SyncStatusBannerProps) {
  const { colors } = useTheme();

  const accent =
    status === 'synced' || status === 'saved_locally'
      ? colors.success
      : status === 'needs_attention'
        ? colors.warning
        : status === 'offline'
          ? colors.textSecondary
          : colors.info;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={STATUS_COPY[status]}
      testID={testID}
      style={[
        styles.banner,
        {
          backgroundColor: colors.sunken,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text variant="caption" tone="secondary" style={styles.copy}>
        {STATUS_COPY[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  copy: {
    flex: 1,
  },
});
