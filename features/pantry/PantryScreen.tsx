import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/tokens';
import {
  getRepositories,
  reportLocalPersistFailure,
  type PantryItem,
} from '@/data';
import { PantryItemRow } from '@/features/pantry/components/PantryItemRow';
import { useTheme } from '@/theme/ThemeProvider';

type Draft = {
  id: string | null;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  quantity: '',
  unit: '',
  notes: '',
};

function loadItems(includeDepleted: boolean): PantryItem[] {
  return getRepositories().pantry.list({ includeDepleted });
}

export function PantryScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [showDepleted, setShowDepleted] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      setItems(loadItems(showDepleted));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pantry');
    }
  }, [showDepleted]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetDraft = () => setDraft(EMPTY_DRAFT);

  const handleSave = () => {
    setError(null);
    setMessage(null);
    const name = draft.name.trim();
    if (!name) {
      setError('Add a name before saving.');
      return;
    }
    try {
      const { pantry } = getRepositories();
      const payload = {
        name,
        quantity: draft.quantity.trim() || null,
        unit: draft.unit.trim() || null,
        notes: draft.notes.trim() || null,
      };
      if (draft.id) {
        pantry.update(draft.id, payload);
        setMessage(`Updated ${name}. Saved on this device.`);
      } else {
        pantry.create(payload);
        setMessage(`Added ${name}. Saved on this device.`);
      }
      resetDraft();
      refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not save pantry item';
      reportLocalPersistFailure(text);
      setError(text);
    }
  };

  const handleConsume = (item: PantryItem) => {
    setError(null);
    try {
      getRepositories().pantry.consume(item.id);
      setMessage(`Marked ${item.name} as used up.`);
      refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not update pantry item';
      reportLocalPersistFailure(text);
      setError(text);
    }
  };

  const handleDelete = (item: PantryItem) => {
    setError(null);
    try {
      getRepositories().pantry.softDelete(item.id);
      setMessage(`Removed ${item.name}.`);
      if (draft.id === item.id) resetDraft();
      refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not delete pantry item';
      reportLocalPersistFailure(text);
      setError(text);
    }
  };

  const handleEdit = (item: PantryItem) => {
    setDraft({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? '',
      unit: item.unit ?? '',
      notes: item.notes ?? '',
    });
    setMessage(null);
    setError(null);
  };

  return (
    <Screen testID="screen-pantry">
      <Text variant="title1">Pantry</Text>
      <Text variant="body" tone="secondary">
        Track what you have on hand. Recipes can rank or filter by pantry coverage — always with
        clear labels, never silently.
      </Text>

      <View
        style={[styles.form, { backgroundColor: colors.sunken, borderColor: colors.border }]}
        testID="pantry-form"
      >
        <Text variant="headline">{draft.id ? 'Edit item' : 'Add item'}</Text>
        <Field
          label="Name"
          value={draft.name}
          onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
          placeholder="Eggs, oats, olive oil…"
          testID="pantry-name"
        />
        <View style={styles.qtyRow}>
          <View style={styles.qtyField}>
            <Field
              label="Quantity"
              value={draft.quantity}
              onChangeText={(quantity) => setDraft((d) => ({ ...d, quantity }))}
              placeholder="12"
              testID="pantry-quantity"
            />
          </View>
          <View style={styles.qtyField}>
            <Field
              label="Unit"
              value={draft.unit}
              onChangeText={(unit) => setDraft((d) => ({ ...d, unit }))}
              placeholder="count"
              testID="pantry-unit"
            />
          </View>
        </View>
        <Field
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
          placeholder="Optional"
          testID="pantry-notes"
        />
        <View style={styles.formActions}>
          <Button
            label={draft.id ? 'Save changes' : 'Add to pantry'}
            onPress={handleSave}
            testID="pantry-save"
          />
          {draft.id ? (
            <Button label="Cancel edit" variant="secondary" onPress={resetDraft} />
          ) : null}
        </View>
      </View>

      {error ? (
        <Text variant="callout" tone="error" testID="pantry-error">
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text variant="callout" tone="success" testID="pantry-message">
          {message}
        </Text>
      ) : null}

      <View style={styles.listHeader}>
        <Text variant="headline">On hand</Text>
        <Button
          label={showDepleted ? 'Hide used up' : 'Show used up'}
          variant="secondary"
          onPress={() => setShowDepleted((v) => !v)}
          testID="pantry-toggle-depleted"
        />
      </View>

      {items.length === 0 ? (
        <View style={styles.empty} testID="pantry-empty">
          <Text variant="body" tone="secondary">
            Your pantry is empty. Add staples here, then use Boost or Filter on Recipes to cook with
            what you have.
          </Text>
        </View>
      ) : (
        <View style={styles.list} testID="pantry-list">
          {items.map((item) => (
            <PantryItemRow
              key={item.id}
              item={item}
              onConsume={handleConsume}
              onEdit={handleEdit}
              onDelete={handleDelete}
              testID={`pantry-item-${item.id}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  qtyRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  qtyField: {
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    gap: spacing.sm,
  },
});
