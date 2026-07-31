import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../constants/theme';
import { isSyncAvailable } from '../services/sync/recipeSync';
import { analytics } from '../services/observability/analytics';
import { useAuthStore } from '../store/authStore';
import { useRecipeStore } from '../store/recipeStore';

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const configured = useAuthStore((state) => state.configured);
  const loading = useAuthStore((state) => state.loading);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const signOut = useAuthStore((state) => state.signOut);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);
  const syncStatus = useRecipeStore((state) => state.syncStatus);
  const syncPending = useRecipeStore((state) => state.syncPending);
  const recipes = useRecipeStore((state) => state.recipes);
  const folders = useRecipeStore((state) => state.folders);
  const mealPlan = useRecipeStore((state) => state.mealPlan);
  const groceryCheckedIds = useRecipeStore((state) => state.groceryCheckedIds);
  const manualGroceryItems = useRecipeStore((state) => state.manualGroceryItems);

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const syncLabel = useMemo(() => {
    if (syncStatus === 'syncing') return 'Syncing…';
    if (syncStatus === 'error') return 'Sync failed — tap Sync now';
    if (syncPending) return 'Pending changes';
    return 'Synced';
  }, [syncPending, syncStatus]);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result =
      mode === 'sign-in'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    if (result) setError(result);
    else if (mode === 'sign-up') {
      setMessage('Account created. Check your email if confirmation is required.');
    }
    setBusy(false);
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email above to reset your password.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await resetPassword(email.trim());
    if (result) setError(result);
    else setMessage('Password reset email sent if that account exists.');
    setBusy(false);
  };

  const handleSync = async () => {
    if (!user) return;
    setBusy(true);
    await syncToCloud(user.id);
    setBusy(false);
  };

  const handleExport = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      recipes,
      folders,
      mealPlan,
      groceryCheckedIds,
      manualGroceryItems,
    };
    const body = JSON.stringify(payload, null, 2);
    analytics.track('export_library', { recipes: recipes.length });
    try {
      await Share.share({
        title: 'Whisk library export',
        message: body,
      });
    } catch {
      setError('Could not share the export file.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete account?',
      'This removes your cloud recipes, folders, meal plan, grocery state, and images for this account. Local copies on other devices may remain until you clear them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              const result = await deleteAccount();
              setBusy(false);
              if (result) setError(result);
              else router.replace('/(tabs)');
            })();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading account" />
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
                migrations in supabase/migrations.
              </Text>
            </View>
          ) : user ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Signed in</Text>
                <Text style={styles.cardBody}>{user.email}</Text>
                <Text
                  style={styles.syncMeta}
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`Sync status ${syncLabel}`}
                >
                  Sync status: {syncLabel}
                </Text>
              </View>
              <Pressable
                onPress={handleSync}
                disabled={busy}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Sync now"
              >
                <Text style={styles.primaryText}>Sync now</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleExport()}
                style={styles.secondaryOutline}
                accessibilityRole="button"
                accessibilityLabel="Export library"
              >
                <Text style={styles.secondaryOutlineText}>Export library (JSON)</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await signOut();
                  router.back();
                }}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text style={styles.secondaryText}>Sign out</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={styles.dangerBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <Text style={styles.dangerText}>Delete account</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setMode('sign-in')}
                  style={[styles.toggle, mode === 'sign-in' && styles.toggleActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'sign-in' }}
                >
                  <Text style={styles.toggleText}>Sign in</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('sign-up')}
                  style={[styles.toggle, mode === 'sign-up' && styles.toggleActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'sign-up' }}
                >
                  <Text style={styles.toggleText}>Create account</Text>
                </Pressable>
              </View>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <Pressable
                onPress={handleSubmit}
                disabled={busy}
                style={styles.primaryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
              </Pressable>
              <Pressable onPress={() => void handleReset()} disabled={busy} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Forgot password?</Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => void Linking.openURL('https://github.com/Bly367/Whisk/blob/master/docs/PRIVACY.md')}
            style={styles.secondaryBtn}
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
          >
            <Text style={styles.secondaryText}>Privacy policy</Text>
          </Pressable>
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
        accessibilityLabel={label}
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
  message: { ...typography.caption, color: colors.success },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: { ...typography.subtitle, color: '#fff' },
  secondaryOutline: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryOutlineText: { ...typography.subtitle, color: colors.text },
  secondaryBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { ...typography.caption, color: colors.textMuted },
  dangerBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  dangerText: { ...typography.caption, color: colors.danger },
});
