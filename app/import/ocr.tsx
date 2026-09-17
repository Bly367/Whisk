import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ImportFallbacks } from '@/components/import/ImportFallbacks';
import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { ocrAdapter, useImportSessionStore } from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * OCR / photo path stub — entry + honest fallbacks, no invented recipe fields.
 */
export default function ImportOcrScreen() {
  const { colors } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const setFailed = useImportSessionStore((s) => s.setFailed);
  const clear = useImportSessionStore((s) => s.clear);

  useEffect(() => {
    void (async () => {
      const result = await ocrAdapter.import({});
      if (!result.ok) {
        setMessage(result.error.message);
        setFailed(result.error);
      }
    })();
  }, [setFailed]);

  return (
    <Screen testID="screen-import-ocr" showSyncStatus={false}>
      <PlaceholderHero
        title="Scan a photo"
        body="Screenshot and cookbook OCR will land here. Whisk will never guess a recipe from a photo without a review step."
      />

      <View
        style={[styles.card, { backgroundColor: colors.sunken, borderColor: colors.border }]}
        testID="ocr-stub-card"
      >
        <Text variant="headline" tone="warning">
          OCR not ready yet
        </Text>
        <Text variant="body" tone="secondary">
          {message ??
            'Photo import is stubbed so the Add tab path exists. Use paste text or create manually for now.'}
        </Text>
      </View>

      <ImportFallbacks
        actions={['paste_text', 'manual', 'try_again']}
        onTryAgain={() => {
          clear();
          router.replace('/import/ocr');
        }}
      />

      <Button
        label="Choose photo (soon)"
        variant="secondary"
        disabled
        testID="ocr-pick-disabled"
        accessibilityHint="Photo picker will be available when OCR ships"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
