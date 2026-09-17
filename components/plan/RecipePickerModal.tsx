import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { RecipeListItem } from '@/data/contracts';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type RecipePickerTab = 'search' | 'recent' | 'favorites';

export type RecipePickerModalProps = {
  visible: boolean;
  title: string;
  recipes: RecipeListItem[];
  onClose: () => void;
  onSelect: (recipe: RecipeListItem) => void;
  testID?: string;
};

export function RecipePickerModal({
  visible,
  title,
  recipes,
  onClose,
  onSelect,
  testID = 'recipe-picker',
}: RecipePickerModalProps) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<RecipePickerTab>('search');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = recipes;
    if (tab === 'favorites') {
      list = list.filter((r) => r.isFavorite);
    } else if (tab === 'recent') {
      list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20);
    }
    if (tab === 'search' && q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.ingredientNames.some((n) => n.toLowerCase().includes(q)) ||
          r.tagNames.some((n) => n.toLowerCase().includes(q)),
      );
    }
    if (tab === 'search' && !q) {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [recipes, tab, query]);

  const handleClose = useCallback(() => {
    setQuery('');
    setTab('search');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          testID={testID}
        >
          <Text variant="title2">{title}</Text>
          <Text variant="caption" tone="secondary">
            Pick from your library — search, recent, or favorites.
          </Text>

          <View style={styles.tabs}>
            {(
              [
                ['search', 'Search'],
                ['recent', 'Recent'],
                ['favorites', 'Favorites'],
              ] as const
            ).map(([key, label]) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  hitSlop={hitSlop}
                  testID={`${testID}-tab-${key}`}
                  onPress={() => setTab(key)}
                  style={({ pressed }) => [
                    ensureMinTouchTarget(styles.tab),
                    {
                      backgroundColor: active ? colors.brand.yolkSoft : colors.sunken,
                      borderColor: active ? colors.brand.yolk : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    variant="callout"
                    style={{ color: colors.textPrimary }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'search' ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search recipes or ingredients"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Search recipes or ingredients"
              testID={`${testID}-search`}
              style={[
                styles.input,
                {
                  backgroundColor: colors.sunken,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text variant="body" tone="secondary">
                  {tab === 'favorites'
                    ? 'No favorites yet. Star recipes in your library first.'
                    : recipes.length === 0
                      ? 'No recipes saved yet. Add one from the Add tab, then come back.'
                      : 'No matches. Try another search.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.title}`}
                hitSlop={hitSlop}
                testID={`${testID}-recipe-${item.id}`}
                onPress={() => {
                  onSelect(item);
                  handleClose();
                }}
                style={({ pressed }) => [
                  ensureMinTouchTarget(styles.row),
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.sunken : colors.canvas,
                  },
                ]}
              >
                <View style={styles.rowText}>
                  <Text variant="headline" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {item.isFavorite ? 'Favorite · ' : ''}
                    {item.ingredientNames.slice(0, 3).join(', ') || 'No ingredients listed'}
                  </Text>
                </View>
              </Pressable>
            )}
          />

          <Button
            label="Cancel"
            variant="secondary"
            onPress={handleClose}
            testID={`${testID}-cancel`}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  list: {
    flexGrow: 0,
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  empty: {
    paddingVertical: spacing.xl,
  },
});
