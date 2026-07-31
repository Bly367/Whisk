import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { ImportStatus } from '../types/recipe';

const labels: Partial<Record<ImportStatus, string>> = {
  resolving: 'Resolving link',
  extracting: 'Extracting recipe',
  structuring: 'Structuring ingredients and steps',
};

export function ImportProgress({ status }: { status: ImportStatus }) {
  return (
    <View style={styles.card}>
      <ActivityIndicator color={colors.accent} />
      <View style={styles.copy}>
        <Text style={styles.title}>{labels[status] ?? 'Preparing import'}</Text>
        <Text style={styles.subtitle}>This usually takes a few seconds.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  copy: { flex: 1, gap: spacing.xs },
  title: { ...typography.subtitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
});
