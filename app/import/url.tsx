import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImportProgress } from '../../components/ImportProgress';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { detectSource, isSocialSource } from '../../services/import/url';
import { useRecipeStore } from '../../store/recipeStore';

export default function ImportUrlScreen() {
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(params.url ?? '');
  const [suppliedText, setSuppliedText] = useState('');
  const currentImport = useRecipeStore((state) => state.currentImport);
  const startImport = useRecipeStore((state) => state.startImport);
  const clearImport = useRecipeStore((state) => state.clearImport);

  const isSocial = useMemo(() => {
    try {
      return isSocialSource(detectSource(url.trim()));
    } catch {
      return false;
    }
  }, [url]);

  const loading =
    currentImport?.status === 'resolving' ||
    currentImport?.status === 'extracting' ||
    currentImport?.status === 'structuring';

  const recoveryCode = currentImport?.errorCode;
  const showRecovery =
    currentImport?.status === 'failed' &&
    (recoveryCode === 'auth_required' ||
      recoveryCode === 'quota_exceeded' ||
      recoveryCode === 'network');
  const showAssist =
    !showRecovery &&
    (isSocial ||
      currentImport?.status === 'needs_input' ||
      currentImport?.status === 'failed');

  const handleImport = async () => {
    if (!url.trim()) return;
    try {
      await startImport(url.trim(), suppliedText.trim() || undefined);
      router.push('/import/review');
    } catch {
      // The store exposes the error and assisted-import state below.
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title="Paste a link"
          subtitle="We'll extract ingredients and steps into an editable draft."
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://instagram.com/... or any recipe URL"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />

          <View style={styles.hints}>
            <Text style={styles.hintTitle}>Works with</Text>
            <Text style={styles.hint}>Instagram · TikTok · Facebook · Safari · Recipe blogs</Text>
          </View>

          {showRecovery ? (
            <View style={styles.assistCard}>
              <Text style={styles.assistTitle}>
                {recoveryCode === 'auth_required'
                  ? 'Sign in to continue'
                  : recoveryCode === 'quota_exceeded'
                    ? 'Import limit reached'
                    : 'Check your connection'}
              </Text>
              <Text style={styles.assistBody}>{currentImport.error}</Text>
              <Pressable
                onPress={
                  recoveryCode === 'auth_required'
                    ? () => router.push('/account')
                    : handleImport
                }
                style={styles.recoveryButton}
              >
                <Text style={styles.recoveryButtonText}>
                  {recoveryCode === 'auth_required' ? 'Sign in' : 'Try again'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {showAssist ? (
            <View style={styles.assistCard}>
              <Text style={styles.assistTitle}>
                {currentImport?.status === 'failed'
                  ? 'Import failed'
                  : isSocial
                    ? 'Social posts often need the caption'
                    : 'Help Whisk finish'}
              </Text>
              <Text style={styles.assistBody}>
                {currentImport?.error ??
                  'Instagram and TikTok usually hide recipe text behind login. Paste the caption here for best results — Whisk will also try any public page metadata it can read.'}
              </Text>
              <TextInput
                value={suppliedText}
                onChangeText={setSuppliedText}
                placeholder="Paste the post caption or recipe text here..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.captionInput]}
                multiline
              />
            </View>
          ) : null}

          {loading ? <ImportProgress status={currentImport?.status ?? 'resolving'} /> : null}

          <Pressable
            onPress={handleImport}
            disabled={!url.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Import Recipe"
            style={({ pressed }) => [
              styles.importBtn,
              (!url.trim() || loading) && styles.importBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.importText}>Working...</Text>
              </>
            ) : (
              <Text style={styles.importText}>
                {suppliedText.trim() ? 'Import with Recipe Text' : 'Import Recipe'}
              </Text>
            )}
          </Pressable>

          {currentImport ? (
            <Pressable onPress={clearImport}>
              <Text style={styles.note}>Clear import and start over</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>
              Whisk extracts locally first and always lets you review before saving.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 100,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  hints: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  hintTitle: { ...typography.label, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textSecondary },
  assistCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  assistTitle: { ...typography.subtitle, color: colors.text },
  assistBody: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  captionInput: { minHeight: 120 },
  recoveryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recoveryButtonText: { ...typography.caption, color: colors.accent },
  importBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  importBtnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
  importText: { ...typography.subtitle, color: '#fff' },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
