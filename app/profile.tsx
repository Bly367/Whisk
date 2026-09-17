import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/tokens';

export default function ProfileScreen() {
  return (
    <Screen testID="screen-profile" showSyncStatus>
      <Text variant="title2">Account</Text>
      <Text variant="body" tone="secondary">
        Guest mode works fully on this device. Sign-in, household sharing, and
        export controls will live here — not as another tab.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Export recipes"
          variant="secondary"
          disabled
          testID="profile-export"
          accessibilityHint="Coming soon"
        />
        <Button
          label="Settings"
          variant="tertiary"
          disabled
          testID="profile-settings"
          accessibilityHint="Coming soon"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
});
