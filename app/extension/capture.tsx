import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { brand, radius, spacing } from '@/constants/tokens';
import {
  WEB_DESKTOP_SOT_POLICY,
  applyExtensionCaptureToPreview,
  type ExtensionValidationError,
} from '@/lib/extension';
import { useTheme } from '@/theme/ThemeProvider';

function parsePayloadParam(raw: string | string[] | undefined): unknown {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

/**
 * Web/desktop + deep-link landing for browser extension captures.
 * Validates the envelope, loads import preview session, never writes SQLite here.
 */
export default function ExtensionCaptureScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ payload?: string }>();
  const [error, setError] = useState<ExtensionValidationError | null>(null);
  const [readyTitle, setReadyTitle] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parsePayloadParam(params.payload);
    if (parsed == null) {
      setError({
        code: 'invalid_envelope',
        message: 'No extension capture payload was provided.',
      });
      return;
    }

    const result = applyExtensionCaptureToPreview(parsed);
    if (!result.ok) {
      setError(result.error);
      setReadyTitle(null);
      return;
    }

    setError(null);
    setReadyTitle(result.draft.title);
    router.replace('/import/preview');
  }, [params.payload]);

  return (
    <Screen testID="screen-extension-capture" showSyncStatus={false}>
      <View
        style={[styles.brandMark, { backgroundColor: brand.yolkSoft, borderColor: brand.yolk }]}
        accessibilityRole="header"
      >
        <Text variant="title2">Whisk</Text>
        <Text variant="caption" tone="secondary">
          Extension capture
        </Text>
      </View>

      <Text variant="body" tone="secondary">
        Recipes from the browser open in import preview first. This web/desktop surface is a
        capture relay — your mobile SQLite library stays canonical until sync contracts from{' '}
        {WEB_DESKTOP_SOT_POLICY.requiresSyncContractsFrom.join(' / ')} are in use.
      </Text>

      {error ? (
        <View
          style={[styles.card, { borderColor: colors.error, backgroundColor: colors.sunken }]}
          testID="extension-capture-error"
        >
          <Text variant="headline" tone="error">
            Capture rejected
          </Text>
          <Text variant="body" tone="secondary">
            {error.message}
          </Text>
          <Button
            label="Back to Add"
            onPress={() => router.replace('/(tabs)/add')}
            testID="extension-capture-back"
          />
        </View>
      ) : (
        <View
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
          testID="extension-capture-pending"
        >
          <Text variant="headline">{readyTitle ? `Opening “${readyTitle}”…` : 'Validating capture…'}</Text>
          <Text variant="caption" tone="secondary">
            Preview required before any save. Role: {WEB_DESKTOP_SOT_POLICY.role}.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
