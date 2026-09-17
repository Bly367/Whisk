import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncStatusBanner, type SyncStatus } from '@/components/ui/SyncStatusBanner';
import { spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type ScreenProps = ViewProps & {
  children: ReactNode;
  scroll?: boolean;
  showSyncStatus?: boolean;
  syncStatus?: SyncStatus;
};

export function Screen({
  children,
  scroll = true,
  showSyncStatus = true,
  syncStatus = 'saved_locally',
  style,
  ...rest
}: ScreenProps) {
  const { colors } = useTheme();

  const body = (
    <>
      {showSyncStatus ? (
        <View style={styles.syncSlot}>
          <SyncStatusBanner status={syncStatus} />
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.safe, { backgroundColor: colors.canvas }]}
      {...rest}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, style]}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, style]}>{body}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  syncSlot: {
    marginBottom: spacing.sm,
  },
});
