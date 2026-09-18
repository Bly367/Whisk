import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { SnackbarShell } from '@/components/ui/SnackbarShell';
import { Text } from '@/components/ui/Text';
import {
  getRepositories,
  reportLocalPersistFailure,
  reportLocalPersistSuccess,
  type GroceryItem,
  type GroceryListWithItems,
} from '@/data';
import { spacing } from '@/constants/tokens';
import { GeneratePreviewCard } from '@/features/shop/components/GeneratePreviewCard';
import { GroceryItemRow } from '@/features/shop/components/GroceryItemRow';
import { GroupModeToggle } from '@/features/shop/components/GroupModeToggle';
import {
  buildGroceryPreviewFromPlan,
  type GroceryGeneratePreview,
} from '@/features/shop/generateFromPlan';
import { completedItems, groupGroceryItems, type ShopGroupMode } from '@/features/shop/groupItems';
import { replaceGroceryListFromPreview, undoReplaceGroceryList } from '@/features/shop/replaceList';
import { unmergeGroceryItem } from '@/features/shop/unmerge';
import { useHouseholdGrocerySync } from '@/features/household/useHouseholdGrocerySync';
import { publishHouseholdGroceryUpsert } from '@/features/household/publishHouseholdGrocery';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

const UNDO_MS = 5000;

type UndoState =
  | { kind: 'complete'; itemId: string; name: string }
  | { kind: 'delete'; itemId: string; name: string }
  | {
      kind: 'replace';
      previousListId: string;
      newListId: string;
      previousName: string;
    }
  | null;

function loadActiveList(): GroceryListWithItems | null {
  const { grocery } = getRepositories();
  const lists = grocery.list();
  if (lists.length === 0) return null;
  return grocery.getById(lists[0].id);
}

function undoMessage(undo: NonNullable<UndoState>): string {
  switch (undo.kind) {
    case 'complete':
      return `Checked off ${undo.name}`;
    case 'delete':
      return `Removed ${undo.name}`;
    case 'replace':
      return `Replaced ${undo.previousName}`;
  }
}

export function ShopScreen() {
  const { colors } = useTheme();
  const [list, setList] = useState<GroceryListWithItems | null>(null);
  const [groupMode, setGroupMode] = useState<ShopGroupMode>('aisle');
  const [preview, setPreview] = useState<GroceryGeneratePreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setList(loadActiveList());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useHouseholdGrocerySync({
    listId: list?.id ?? null,
    householdId: list?.householdId ?? null,
    onApplied: refresh,
  });

  const clearUndoTimer = () => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  };

  const showUndo = (next: UndoState) => {
    clearUndoTimer();
    setUndo(next);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };

  const handleStartGenerate = () => {
    setEmptyReason(null);
    try {
      const repos = getRepositories();
      const next = buildGroceryPreviewFromPlan(repos);
      if (!next) {
        setEmptyReason('Add recipes to this week’s plan first, then generate a list here.');
        setPreview(null);
        return;
      }
      setPreview(next);
    } catch (error) {
      reportLocalPersistFailure(
        error instanceof Error ? error.message : 'Could not read meal plan',
      );
    }
  };

  const handleConfirmGenerate = () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const { grocery } = getRepositories();
      // Create first, then retire prior list — never soft-delete before create.
      const { created, replacedListId, replacedListName } = replaceGroceryListFromPreview(
        grocery,
        preview,
        list,
      );
      reportLocalPersistSuccess();
      setList(created);
      setPreview(null);
      setCompletedOpen(false);
      if (replacedListId && replacedListName) {
        showUndo({
          kind: 'replace',
          previousListId: replacedListId,
          newListId: created.id,
          previousName: replacedListName,
        });
      } else {
        setUndo(null);
        clearUndoTimer();
      }
    } catch (error) {
      // Prior list untouched if create threw
      reportLocalPersistFailure(
        error instanceof Error ? error.message : 'Could not save grocery list',
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleToggleComplete = (item: GroceryItem) => {
    try {
      const { grocery } = getRepositories();
      const nextCompleted = !item.isCompleted;
      const updated = grocery.setCompleted(item.id, nextCompleted);
      reportLocalPersistSuccess();
      if (nextCompleted) {
        showUndo({ kind: 'complete', itemId: item.id, name: item.name });
      } else {
        clearUndoTimer();
        setUndo(null);
      }
      refresh();
      void publishHouseholdGroceryUpsert({
        householdId: list?.householdId,
        listId: item.listId,
        item: updated,
      });
    } catch (error) {
      reportLocalPersistFailure(error instanceof Error ? error.message : 'Could not update item');
    }
  };

  const handleDeleteItem = (item: GroceryItem) => {
    try {
      const { grocery } = getRepositories();
      grocery.softDeleteItem(item.id);
      reportLocalPersistSuccess();
      showUndo({ kind: 'delete', itemId: item.id, name: item.name });
      refresh();
      void publishHouseholdGroceryUpsert({
        householdId: list?.householdId,
        listId: item.listId,
        item,
        deleted: true,
      });
    } catch (error) {
      reportLocalPersistFailure(error instanceof Error ? error.message : 'Could not remove item');
    }
  };

  const handleUndo = () => {
    if (!undo) return;
    try {
      const { grocery } = getRepositories();
      if (undo.kind === 'complete') {
        grocery.setCompleted(undo.itemId, false);
        reportLocalPersistSuccess();
        refresh();
      } else if (undo.kind === 'delete') {
        grocery.restoreItem(undo.itemId);
        reportLocalPersistSuccess();
        refresh();
      } else {
        const restored = undoReplaceGroceryList(grocery, {
          newListId: undo.newListId,
          previousListId: undo.previousListId,
        });
        reportLocalPersistSuccess();
        setList(restored);
      }
      clearUndoTimer();
      setUndo(null);
    } catch (error) {
      reportLocalPersistFailure(error instanceof Error ? error.message : 'Could not undo');
    }
  };

  const handleUnmerge = (item: GroceryItem) => {
    if (!list) return;
    try {
      const { grocery } = getRepositories();
      const next = unmergeGroceryItem(grocery, list, item);
      setList(next);
    } catch {
      // failure already reported
    }
  };

  const activeGroups = list ? groupGroceryItems(list.items, groupMode) : [];
  const done = list ? completedItems(list.items) : [];

  return (
    <Screen testID="screen-shop" scroll>
      <View style={styles.header}>
        <Text variant="title1">Shop</Text>
        <Text variant="body" tone="secondary">
          One list from your plan — merged quantities, aisle groups, and undo.
        </Text>
      </View>

      {preview ? (
        <GeneratePreviewCard
          preview={preview}
          onConfirm={handleConfirmGenerate}
          onCancel={() => setPreview(null)}
          confirming={confirming}
        />
      ) : null}

      {!list && !preview ? (
        <PlaceholderHero
          title="Grocery list"
          body={
            emptyReason ??
            'Turn this week’s meals into one list with careful merges and recipe provenance.'
          }
          actionLabel="Generate from plan"
          actionTestID="shop-generate"
          onAction={handleStartGenerate}
        />
      ) : null}

      {list && !preview ? (
        <>
          <View style={styles.toolbar}>
            <Text variant="headline">{list.name}</Text>
            <GroupModeToggle mode={groupMode} onChange={setGroupMode} />
            <Button
              label="Generate from plan"
              variant="secondary"
              onPress={handleStartGenerate}
              testID="shop-generate-again"
            />
          </View>

          {activeGroups.map((group) => (
            <View key={group.key} style={styles.section} testID={`shop-aisle-${group.key}`}>
              <Text variant="callout" tone="secondary">
                {group.title}
              </Text>
              {group.items.map((item) => (
                <GroceryItemRow
                  key={item.id}
                  item={item}
                  onToggleComplete={handleToggleComplete}
                  onUnmerge={handleUnmerge}
                  onDelete={handleDeleteItem}
                  testID={`shop-item-${item.id}`}
                />
              ))}
            </View>
          ))}

          {activeGroups.length === 0 && done.length === 0 ? (
            <Text variant="body" tone="secondary">
              This list is empty.
            </Text>
          ) : null}

          {done.length > 0 ? (
            <View style={styles.section}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: completedOpen }}
                accessibilityLabel={`Completed, ${done.length} items`}
                hitSlop={hitSlop}
                onPress={() => setCompletedOpen((v) => !v)}
                testID="shop-completed-toggle"
                style={({ pressed }) => [
                  ensureMinTouchTarget(styles.completedHeader),
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text variant="headline">
                  Completed ({done.length}) {completedOpen ? '▾' : '▸'}
                </Text>
              </Pressable>
              {completedOpen
                ? done.map((item) => (
                    <GroceryItemRow
                      key={item.id}
                      item={item}
                      onToggleComplete={handleToggleComplete}
                      onDelete={handleDeleteItem}
                      testID={`shop-done-${item.id}`}
                    />
                  ))
                : null}
            </View>
          ) : null}
        </>
      ) : null}

      {undo ? (
        <View
          style={[styles.snackbarSlot, { backgroundColor: colors.canvas }]}
          pointerEvents="box-none"
        >
          <SnackbarShell
            message={undoMessage(undo)}
            actionLabel="Undo"
            onAction={handleUndo}
            testID="shop-undo-snackbar"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  toolbar: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  completedHeader: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  snackbarSlot: {
    marginTop: spacing.md,
  },
});
