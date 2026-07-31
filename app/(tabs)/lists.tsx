import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useRecipeStore } from '../../store/recipeStore';

export default function ListsScreen() {
  const getGroceryList = useRecipeStore((state) => state.getGroceryList);
  const toggleGroceryItem = useRecipeStore((state) => state.toggleGroceryItem);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);
  const user = useAuthStore((state) => state.user);
  const items = getGroceryList();
  const checkedCount = items.filter((item) => item.checked).length;

  const handleToggle = (id: string) => {
    toggleGroceryItem(id);
    if (user) void syncToCloud(user.id);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Grocery Lists"
        subtitle="Merged from recipes on your meal plan."
      />
      <View style={styles.content}>
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>This Week</Text>
          <Text style={styles.listMeta}>
            {items.length} items · {checkedCount} checked
          </Text>
          {items.length ? (
            items.map((item) => (
              <Pressable key={item.id} onPress={() => handleToggle(item.id)} style={styles.row}>
                <View style={[styles.checkbox, item.checked && styles.checkboxChecked]} />
                <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
                  {item.name}
                </Text>
                <Text style={styles.qty}>
                  {[item.amount, item.unit].filter(Boolean).join(' ')}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>
              Add recipes to your meal plan to generate a grocery list.
            </Text>
          )}
        </View>
        <Text style={styles.note}>
          Duplicate ingredients are merged. Tap to check items off while you shop.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  listTitle: { ...typography.subtitle, color: colors.text },
  listMeta: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.sm },
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
  itemName: { ...typography.body, color: colors.text, flex: 1 },
  itemChecked: { color: colors.textMuted, textDecorationLine: 'line-through' },
  qty: { ...typography.caption, color: colors.textSecondary },
  empty: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
