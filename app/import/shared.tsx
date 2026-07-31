import { router } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImportProgress } from '../../components/ImportProgress';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { extractUrl } from '../../services/import/url';
import { useRecipeStore } from '../../store/recipeStore';

export default function SharedImportScreen() {
  const { sharedPayloads, isResolving, error, clearSharedPayloads } = useIncomingShare();
  const currentImport = useRecipeStore((state) => state.currentImport);
  const startImport = useRecipeStore((state) => state.startImport);
  const started = useRef(false);

  useEffect(() => {
    if (isResolving || started.current || !sharedPayloads.length) return;
    started.current = true;
    const sharedText = sharedPayloads.map((payload) => payload.value ?? '').join('\n');
    const url = extractUrl(sharedText);

    if (!url) return;
    startImport(url, sharedText)
      .then(() => {
        clearSharedPayloads();
        router.replace('/import/review');
      })
      .catch(() => {
        clearSharedPayloads();
      });
  }, [clearSharedPayloads, isResolving, sharedPayloads, startImport]);

  const sharedText = sharedPayloads.map((payload) => payload.value ?? '').join('\n');
  const hasUrl = Boolean(extractUrl(sharedText));
  const waiting =
    isResolving ||
    currentImport?.status === 'resolving' ||
    currentImport?.status === 'extracting' ||
    currentImport?.status === 'structuring';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Import shared recipe" onBack={() => router.back()} />
      <View style={styles.content}>
        {waiting ? (
          <ImportProgress status={currentImport?.status ?? 'resolving'} />
        ) : error ? (
          <Message
            title="Could not read the shared item"
            body={error.message}
            action={() => router.replace('/import/url')}
          />
        ) : currentImport?.error ? (
          <Message
            title="More information needed"
            body={currentImport.error}
            action={() =>
              router.replace({
                pathname: '/import/url',
                params: { url: extractUrl(sharedText) ?? '' },
              })
            }
          />
        ) : !hasUrl ? (
          <Message
            title="No link found"
            body="Share a public recipe link, or paste the recipe text manually."
            action={() => router.replace('/import/manual')}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: () => void;
}) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageBody}>{body}</Text>
      <Pressable onPress={action} style={styles.button}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  message: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageTitle: { ...typography.subtitle, color: colors.text },
  messageBody: { ...typography.body, color: colors.textSecondary },
  button: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  buttonText: { ...typography.subtitle, color: '#fff' },
});
