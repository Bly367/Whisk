import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImportOption } from '../../components/ImportOption';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { ImportHistoryEntry, useImportHistoryStore } from '../../store/importHistoryStore';

export default function ImportScreen() {
  const history = useImportHistoryStore((state) => state.history);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Import"
          subtitle="Save recipes from anywhere in one tap."
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>From the web</Text>
          <ImportOption
            icon="link"
            title="Paste a link"
            subtitle="Instagram, TikTok, blogs, or any recipe URL"
            gradient={['#FF6B4A', '#FF8E53']}
            onPress={() => router.push('/import/url')}
          />
          <ImportOption
            icon="logo-instagram"
            title="Share from social apps"
            subtitle="Use Share To in Instagram, TikTok, or Facebook"
            gradient={['#833AB4', '#FD1D1D']}
            badge="MOBILE"
            onPress={() => router.push('/import/url')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Other ways</Text>
          <ImportOption
            icon="create"
            title="Add manually"
            subtitle="Type ingredients and steps yourself"
            gradient={['#2C5364', '#203A43']}
            onPress={() => router.push('/import/manual')}
          />
          <ImportOption
            icon="camera"
            title="From photo"
            subtitle="Snap a cookbook page or screenshot"
            gradient={['#11998e', '#38ef7d']}
            onPress={() => router.push('/import/photo')}
          />
          <ImportOption
            icon="sparkles"
            title="Generate with AI"
            subtitle="Describe what you want to cook"
            gradient={['#7C5CFF', '#B06CFF']}
            badge="SOON"
            onPress={() => router.push('/import/manual')}
          />
        </View>

        {history.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recent imports</Text>
            <View style={styles.historyCard}>
              {history.slice(0, 5).map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {historyTitle(entry)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {sourceLabel(entry)} · {new Date(entry.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyStatus,
                      entry.status === 'success' ? styles.historySuccess : styles.historyFailure,
                    ]}
                  >
                    {entry.status === 'success' ? 'Imported' : 'Failed'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function sourceLabel(entry: ImportHistoryEntry): string {
  if (entry.kind === 'image') return 'Photo';
  if (entry.source === 'url') return 'Website';
  return entry.source.charAt(0).toUpperCase() + entry.source.slice(1);
}

function historyTitle(entry: ImportHistoryEntry): string {
  if (entry.status === 'success') return entry.draftTitle || 'Imported recipe';
  if (entry.errorCode === 'auth_required') return 'Sign-in required';
  if (entry.errorCode === 'quota_exceeded') return 'Import limit reached';
  if (entry.errorCode === 'network') return 'Connection problem';
  return 'Import was not completed';
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  historyCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyCopy: { flex: 1, gap: spacing.xs },
  historyTitle: { ...typography.caption, color: colors.text },
  historyMeta: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  historyStatus: { ...typography.caption, fontSize: 11 },
  historySuccess: { color: colors.success },
  historyFailure: { color: colors.danger },
});
