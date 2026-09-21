import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ImportFallbacks } from '@/components/import/ImportFallbacks';
import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { ocrAdapter, runImport, useImportSessionStore } from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * OCR / photo path stub — entry + honest fallbacks, no invented recipe fields.
 * Allows manual text paste alongside imageUri until OCR ships.
 */
export default function ImportOcrScreen() {
  const { colors } = useTheme();
  const [imageUri] = useState<string | null>(null); // TODO: wire to image picker when available
  const [manualText, setManualText] = useState('');
  const phase = useImportSessionStore((s) => s.phase);
  const error = useImportSessionStore((s) => s.error);
  const setImporting = useImportSessionStore((s) => s.setImporting);
  const setPreview = useImportSessionStore((s) => s.setPreview);
  const setFailed = useImportSessionStore((s) => s.setFailed);
  const clear = useImportSessionStore((s) => s.clear);

  const loading = phase === 'importing';

  const handleImport = async () => {
    setImporting();
    const result = await runImport(
      {
        imageUri: imageUri || undefined,
        text: manualText.trim() || undefined,
      },
      ocrAdapter.id,
    );
    if (result.ok) {
      setPreview(result.draft);
      router.push('/import/preview');
      return;
    }
    setFailed(result.error);
  };

  return (
    <Screen testID="screen-import-ocr" showSyncStatus={false}>
      <PlaceholderHero
        title="Scan a photo"
        body="Screenshot and cookbook OCR will land here. Until then, you can paste the recipe text you see in a photo to create a draft with the photo as reference. Whisk will never guess a recipe from a photo without a review step."
      />

      <View
        style={[styles.card, { backgroundColor: colors.sunken, borderColor: colors.border }]}
        testID="ocr-stub-card"
      >
        <Text variant="headline" tone="warning">
          OCR not ready yet
        </Text>
        <Text variant="body" tone="secondary">
          Photo OCR is coming. For now, you can manually type the recipe text you see in a photo or
          screenshot.
        </Text>
      </View>

      <Button
        label="Choose photo (coming soon)"
        variant="secondary"
        disabled
        testID="ocr-pick-disabled"
        accessibilityHint="Photo picker will be available when OCR ships"
      />

      <View style={styles.field}>
        <Text variant="headline">Manual text from photo (optional workaround)</Text>
        <Text variant="caption" tone="secondary">
          If you have a recipe photo or screenshot, paste the text you see here. The photo will be
          attached as a reference once the picker is wired.
        </Text>
        <TextInput
          value={manualText}
          onChangeText={setManualText}
          placeholder="Paste recipe text from your photo..."
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="ocr-manual-text-input"
          accessibilityLabel="Manual text from photo"
        />
      </View>

      {error && phase === 'failed' ? (
        <View
          style={[
            styles.errorCard,
            { borderColor: colors.warning, backgroundColor: colors.sunken },
          ]}
          testID="ocr-error"
        >
          <Text variant="headline" tone="warning">
            OCR stub
          </Text>
          <Text variant="body" tone="secondary">
            {error.message}
          </Text>
          <ImportFallbacks
            actions={error.fallbacks}
            onTryAgain={() => {
              clear();
              void handleImport();
            }}
          />
        </View>
      ) : null}

      {manualText.trim() ? (
        <Button
          label="Create draft from text"
          onPress={handleImport}
          loading={loading}
          testID="ocr-submit"
        />
      ) : (
        <ImportFallbacks
          actions={['paste_text', 'manual', 'try_again']}
          onTryAgain={() => {
            clear();
            router.replace('/import/ocr');
          }}
        />
      )}
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
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  errorCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
