import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ImportFallbacks } from '@/components/import/ImportFallbacks';
import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import {
  runImport,
  SHARE_SHEET_ADAPTER_ID,
  useImportSessionStore,
} from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Share-sheet entry stub.
 * On device, OS share will deep-link here; until then users can paste shared content.
 */
export default function ImportShareScreen() {
  const { colors } = useTheme();
  const [shared, setShared] = useState('');
  const [caption, setCaption] = useState('');
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
        sharedContent: shared.trim() || undefined,
        text: caption.trim() || undefined,
        url: shared.trim() || undefined,
      },
      SHARE_SHEET_ADAPTER_ID,
    );
    if (result.ok) {
      setPreview(result.draft);
      router.push('/import/preview');
      return;
    }
    setFailed(result.error);
  };

  return (
    <Screen testID="screen-import-share" showSyncStatus={false}>
      <PlaceholderHero
        title="Share into Whisk"
        body="Entry point for Share → Whisk from social apps and browsers. Paste what was shared until the OS hand-off is connected."
      />

      <View style={styles.field}>
        <Text variant="headline">Shared link or text</Text>
        <TextInput
          value={shared}
          onChangeText={setShared}
          placeholder="Paste the shared URL or post text"
          placeholderTextColor={colors.textSecondary}
          multiline
          autoCapitalize="none"
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="share-content-input"
          accessibilityLabel="Shared content"
        />
      </View>

      <View style={styles.field}>
        <Text variant="headline">Caption (optional)</Text>
        <Text variant="caption" tone="secondary">
          Social posts often need the caption — Whisk will not invent ingredients
          from a bare social URL.
        </Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Paste the post caption or recipe text"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.input,
            styles.tall,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="share-caption-input"
          accessibilityLabel="Post caption"
        />
      </View>

      {error && phase === 'failed' ? (
        <View
          style={[
            styles.errorCard,
            { borderColor: colors.warning, backgroundColor: colors.sunken },
          ]}
          testID="share-error"
        >
          <Text variant="headline" tone="warning">
            Share sheet
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

      <Button
        label="Continue"
        onPress={handleImport}
        loading={loading}
        testID="share-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  tall: {
    minHeight: 120,
  },
  errorCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
