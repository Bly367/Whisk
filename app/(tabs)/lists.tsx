import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';

const sampleItems = [
  { name: 'Salmon fillets', qty: '2', checked: false },
  { name: 'Honey', qty: '3 tbsp', checked: false },
  { name: 'Garlic', qty: '4 cloves', checked: true },
  { name: 'Baby potatoes', qty: '1 lb', checked: false },
  { name: 'Greek yogurt', qty: '1 cup', checked: false },
];

export default function ListsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Grocery Lists"
        subtitle="Auto-generated from your meal plan."
      />
      <View style={styles.content}>
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>This Week</Text>
          <Text style={styles.listMeta}>5 items · merged duplicates</Text>
          {sampleItems.map((item) => (
            <View key={item.name} style={styles.row}>
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]} />
              <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
                {item.name}
              </Text>
              <Text style={styles.qty}>{item.qty}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Smart grocery lists will sync with your meal plan once planning is live.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  listTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  listMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  itemName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  itemChecked: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  qty: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
