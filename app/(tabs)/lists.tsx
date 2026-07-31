import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useRecipeStore } from '../../store/recipeStore';

export default function ListsScreen() {
  const getGroceryList = useRecipeStore((state) => state.getGroceryList);
  const toggleGroceryItem = useRecipeStore((state) => state.toggleGroceryItem);
  const addManualGroceryItem = useRecipeStore((state) => state.addManualGroceryItem);
  const deleteManualGroceryItem = useRecipeStore((state) => state.deleteManualGroceryItem);
  const [newItem, setNewItem] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const items = getGroceryList();
  const checkedCount = items.filter((item) => item.checked).length;

  const addItem = () => {
    if (!newItem.trim()) return;
    addManualGroceryItem(newItem.trim(), amount.trim() || undefined, unit.trim() || undefined);
    setNewItem('');
    setAmount('');
    setUnit('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Grocery Lists"
        subtitle="Merged and scaled from your meal plan."
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.addBlock}>
          <View style={styles.addRow}>
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={addItem}
              placeholder="Add grocery item"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              returnKeyType="done"
              accessibilityLabel="New grocery item"
            />
            <Pressable
              onPress={addItem}
              disabled={!newItem.trim()}
              style={[styles.addButton, !newItem.trim() && styles.disabled]}
              accessibilityLabel="Add grocery item"
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.qtyRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.qtyInput]}
              accessibilityLabel="Amount"
            />
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="Unit"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.qtyInput]}
              accessibilityLabel="Unit"
            />
          </View>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Planned meals</Text>
          <Text style={styles.listMeta}>
            {items.length} items · {checkedCount} checked
          </Text>
          {items.length ? (
            items.map((item) => {
              const manual = item.id.startsWith('manual-');
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleGroceryItem(item.id)}
                  onLongPress={() => {
                    if (manual) deleteManualGroceryItem(item.id);
                  }}
                  style={styles.row}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}
                  accessibilityLabel={`${item.name}, ${[item.amount, item.unit]
                    .filter(Boolean)
                    .join(' ')}`}
                >
                  <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                    {item.checked ? (
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    ) : null}
                  </View>
                  <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
                    {item.name}
                  </Text>
                  {manual ? <Text style={styles.manualBadge}>Manual</Text> : null}
                  <Text style={styles.qty}>
                    {[item.amount, item.unit].filter(Boolean).join(' ')}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.empty}>
              Plan recipes or add an item above to start your grocery list.
            </Text>
          )}
        </View>
        <Text style={styles.note}>
          Compatible quantities are combined automatically. Long-press a manual item to delete it.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  addBlock: { gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  qtyRow: { flexDirection: 'row', gap: spacing.sm },
  qtyInput: { flex: 1 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  itemName: { ...typography.body, color: colors.text, flex: 1 },
  itemChecked: { color: colors.textMuted, textDecorationLine: 'line-through' },
  manualBadge: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 8,
  },
  qty: { ...typography.caption, color: colors.textSecondary },
  empty: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
