import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { ImportFallbackAction } from '@/import/types';
import { useTheme } from '@/theme/ThemeProvider';

const LABELS: Record<ImportFallbackAction, string> = {
  try_again: 'Try again',
  paste_text: 'Paste text',
  scan: 'Scan instead',
  manual: 'Create manually',
};

export type ImportFallbacksProps = {
  actions: ImportFallbackAction[];
  onTryAgain?: () => void;
  testID?: string;
};

export function ImportFallbacks({
  actions,
  onTryAgain,
  testID = 'import-fallbacks',
}: ImportFallbacksProps) {
  const { colors } = useTheme();

  const handle = (action: ImportFallbackAction) => {
    switch (action) {
      case 'try_again':
        onTryAgain?.();
        break;
      case 'paste_text':
        router.push('/import/url?mode=paste');
        break;
      case 'scan':
        router.push('/import/ocr');
        break;
      case 'manual':
        router.push('/import/manual');
        break;
    }
  };

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.sunken, borderColor: colors.border }]}
      testID={testID}
      accessibilityRole="summary"
    >
      <Text variant="caption" tone="secondary">
        Failed imports never create a blank recipe. Pick a fallback:
      </Text>
      <View style={styles.row}>
        {actions.map((action) => (
          <Button
            key={action}
            label={LABELS[action]}
            variant={action === 'try_again' ? 'primary' : 'secondary'}
            onPress={() => handle(action)}
            testID={`fallback-${action}`}
            style={styles.btn}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  row: {
    gap: spacing.sm,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
