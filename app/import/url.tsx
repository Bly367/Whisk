import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { ImportFallbacks } from '@/components/import/ImportFallbacks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { runImport, useImportSessionStore, WEBSITE_ADAPTER_ID } from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

export default function ImportUrlScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string; url?: string }>();
  const [url, setUrl] = useState(typeof params.url === 'string' ? params.url : '');
  const [pasteText, setPasteText] = useState('');
  const showPaste = params.mode === 'paste' || pasteText.length > 0;

  const phase = useImportSessionStore((s) => s.phase);
  const error = useImportSessionStore((s) => s.error);
  const setImporting = useImportSessionStore((s) => s.setImporting);
  const setPreview = useImportSessionStore((s) => s.setPreview);
  const setFailed = useImportSessionStore((s) => s.setFailed);
  const clear = useImportSessionStore((s) => s.clear);

  const loading = phase === 'importing';

  const handleImport = async () => {
    if (!url.trim() && !pasteText.trim()) return;
    setImporting();
    const result = await runImport(
      {
        url: url.trim() || undefined,
        text: pasteText.trim() || undefined,
      },
      url.trim() ? WEBSITE_ADAPTER_ID : undefined,
    );
    if (result.ok) {
      setPreview(result.draft);
      router.push('/import/preview');
      return;
    }
    setFailed(result.error);
  };

  return (
    <Screen testID="screen-import-url" showSyncStatus={false}>
      <Text variant="body" tone="secondary">
        Whisk extracts structured recipe data when the site provides it, then asks you to review
        before anything is saved.
      </Text>

      <View style={styles.field}>
        <Text variant="headline">Recipe link</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/recipe"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          multiline
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="import-url-input"
          accessibilityLabel="Recipe link"
        />
      </View>

      {(showPaste || error?.code === 'needs_input') && (
        <View style={styles.field}>
          <Text variant="headline">Paste recipe text</Text>
          <Text variant="caption" tone="secondary">
            Use this when the page has no structured recipe, or to add a social caption.
          </Text>
          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder={'Ingredients\n1 cup flour\n...\nInstructions\nMix...'}
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
            testID="import-paste-input"
            accessibilityLabel="Pasted recipe text"
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loading} testID="import-progress">
          <ActivityIndicator color={colors.brand.yolk} />
          <Text variant="callout" tone="secondary">
            Reading the page…
          </Text>
        </View>
      ) : null}

      {error && phase === 'failed' ? (
        <View
          style={[styles.errorCard, { borderColor: colors.error, backgroundColor: colors.sunken }]}
          testID="import-error"
        >
          <Text variant="headline" tone="error">
            Couldn’t import yet
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
        label={pasteText.trim() ? 'Import with pasted text' : 'Import link'}
        onPress={handleImport}
        loading={loading}
        disabled={!url.trim() && !pasteText.trim()}
        testID="import-url-submit"
      />

      {!showPaste ? (
        <Button
          label="Paste text instead"
          variant="tertiary"
          onPress={() => setPasteText(' ')}
          testID="import-show-paste"
        />
      ) : null}
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
    minHeight: 160,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
