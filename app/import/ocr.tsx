import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ImportFallbacks } from '@/components/import/ImportFallbacks';
import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { ocrAdapter, runImport, useImportSessionStore } from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * OCR / photo path — pick/take photo → recognize text → preview draft.
 */
export default function ImportOcrScreen() {
  const { colors } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const phase = useImportSessionStore((s) => s.phase);
  const error = useImportSessionStore((s) => s.error);
  const setImporting = useImportSessionStore((s) => s.setImporting);
  const setPreview = useImportSessionStore((s) => s.setPreview);
  const setFailed = useImportSessionStore((s) => s.setFailed);
  const clear = useImportSessionStore((s) => s.clear);

  const handlePickImage = async (useCamera: boolean) => {
    setIsProcessing(true);
    clear();

    try {
      const permissionMethod = useCamera
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync;
      const { status } = await permissionMethod();

      if (status !== 'granted') {
        setFailed({
          code: 'needs_input',
          message: `Camera ${useCamera ? 'camera' : 'photo library'} permission is required to scan recipes.`,
          fallbacks: ['try_again', 'paste_text', 'manual'],
        });
        setIsProcessing(false);
        return;
      }

      const pickerMethod = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await pickerMethod({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled) {
        setIsProcessing(false);
        return;
      }

      setImporting();
      const ocrResult = await ocrAdapter.import({
        imageUri: result.assets[0].uri,
      });

      if (ocrResult.ok) {
        setPreview(ocrResult.draft);
        router.push('/import/preview');
      } else {
        setFailed(ocrResult.error);
      }
    } catch (err) {
      setFailed({
        code: 'parse_failed',
        message: err instanceof Error ? err.message : 'Failed to process image.',
        fallbacks: ['try_again', 'paste_text', 'manual'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const loading = phase === 'importing' || isProcessing;

  return (
    <Screen testID="screen-import-ocr" showSyncStatus={false}>
      <PlaceholderHero
        title="Scan a recipe"
        body="Take a photo or choose one from your library. Whisk will extract the text and let you review before saving."
      />

      {error && phase === 'failed' ? (
        <View
          style={[styles.card, { backgroundColor: colors.sunken, borderColor: colors.warning }]}
          testID="ocr-error-card"
        >
          <Text variant="headline" tone="warning">
            OCR failed
          </Text>
          <Text variant="body" tone="secondary">
            {error.message}
          </Text>
        </View>
      ) : null}

      <ImportFallbacks
        actions={error?.fallbacks ?? ['paste_text', 'manual']}
        onTryAgain={() => {
          clear();
        }}
      />

      <View style={styles.buttons}>
        <Button
          label="Take photo"
          variant="primary"
          onPress={() => handlePickImage(true)}
          loading={loading}
          testID="ocr-take-photo"
          accessibilityHint="Open camera to photograph a recipe"
        />
        <Button
          label="Choose from library"
          variant="secondary"
          onPress={() => handlePickImage(false)}
          loading={loading}
          testID="ocr-pick-photo"
          accessibilityHint="Select a recipe photo from your library"
        />
      </View>
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
  buttons: {
    gap: spacing.md,
  },
});
