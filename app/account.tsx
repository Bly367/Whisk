import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../constants/theme';
import { isSyncAvailable } from '../services/sync/recipeSync';
import { useAuthStore } from '../store/authStore';
import { useRecipeStore } from '../store/recipeStore';

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const configured = useAuthStore((state) => state.configured);
  const loading = useAuthStore((state) => state.loading);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signOut = useAuthStore((state) => state.signOut);
  const loadFromCloud = useRecipeStore((state) => state.loadFromCloud);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);
  const syncStatus = useRecipeStore((state) => state.syncStatus);

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      void loadFromCloud(user.id);
    }
  }, [user?.id]);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    const result =
      mode === 'sign-in'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    if (result) setError(result);
    setBusy(false);
  };

  const handleSync = async () => {
    if (!user) return;
    setBusy(true);
    await syncToCloud(user.id);
    setBusy(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title="Account"
          subtitle={
            configured
              ? 'Sign in to sync recipes, meal plans, and grocery lists.'
              : 'Add Supabase env vars to enable cloud sync.'
          }
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!configured || !isSyncAvailable() ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Local only</Text>
              <Text style={styles.cardBody}>
                Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then run the
                migration in supabase/migrations/001_initial_schema.sql.
              </Text>
            </View>
          ) : user ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Signed in</Text>
                <Text style={styles.cardBody}>{user.email}</Text>
                <Text style={styles.syncMeta}>
                  Sync status:{' '}
                  {syncStatus === 'idle'
                    ? 'Synced'
                    : syncStatus === 'syncing'
                      ? 'Syncing…'
                      : 'Sync failed'}
                </Text>
              </View>
              <Pressable onPress={handleSync} disabled={busy} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>Sync now</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await signOut();
                  router.back();
                }}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryText}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setMode('sign-in')}
                  style={[styles.toggle, mode === 'sign-in' && styles.toggleActive]}
                >
                  <Text style={styles.toggleText}>Sign in</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('sign-up')}
                  style={[styles.toggle, mode === 'sign-up' && styles.toggleActive]}
                >
                  <Text style={styles.toggleText}>Create account</Text>
                </Pressable>
              </View>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={handleSubmit} disabled={busy} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.subtitle, color: colors.text },
  cardBody: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  syncMeta: { ...typography.caption, color: colors.textMuted },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  toggleText: { ...typography.caption, color: colors.text },
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { ...typography.caption, color: colors.danger },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: { ...typography.subtitle, color: '#fff' },
  secondaryBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { ...typography.caption, color: colors.textMuted },
});
