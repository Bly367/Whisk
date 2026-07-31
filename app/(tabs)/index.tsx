import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FolderPill } from '../../components/FolderPill';
import { RecipeCard } from '../../components/RecipeCard';
import { SearchBar } from '../../components/SearchBar';
import { colors, spacing, typography } from '../../constants/theme';
import { useRecipeStore } from '../../store/recipeStore';

export default function LibraryScreen() {
  const [query, setQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const recipes = useRecipeStore((s) => s.recipes);
  const folders = useRecipeStore((s) => s.folders);
  const searchRecipes = useRecipeStore((s) => s.searchRecipes);
  const getRecipesByFolder = useRecipeStore((s) => s.getRecipesByFolder);

  const filtered = useMemo(() => {
    let list = searchRecipes(query);
    if (selectedFolder) list = list.filter((r) => r.folderIds.includes(selectedFolder));
    return list;
  }, [query, selectedFolder, recipes, searchRecipes, getRecipesByFolder]);

  const featured = filtered[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.brand}>Whisk</Text>
              <Text style={styles.tagline}>Your recipes, everywhere.</Text>
            </View>
            <Pressable onPress={() => router.push('/account')} style={styles.accountBtn}>
              <Ionicons name="person-circle-outline" size={28} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <SearchBar value={query} onChangeText={setQuery} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folderRow}
        >
          <FolderPill
            emoji="✨"
            name="All"
            color={colors.accent}
            count={recipes.length}
            selected={!selectedFolder}
            onPress={() => setSelectedFolder(null)}
          />
          {folders.map((folder) => (
            <FolderPill
              key={folder.id}
              emoji={folder.emoji}
              name={folder.name}
              color={folder.color}
              count={getRecipesByFolder(folder.id).length}
              selected={selectedFolder === folder.id}
              onPress={() =>
                setSelectedFolder(selectedFolder === folder.id ? null : folder.id)
              }
            />
          ))}
          <Pressable onPress={() => router.push('/folders')} style={styles.manageFolders}>
            <Ionicons name="settings-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.manageFoldersText}>Manage</Text>
          </Pressable>
        </ScrollView>

        {featured ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured</Text>
            <RecipeCard
              recipe={featured}
              variant="hero"
              onPress={() => router.push(`/recipe/${featured.id}`)}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedFolder
              ? folders.find((f) => f.id === selectedFolder)?.name ?? 'Recipes'
              : 'All Recipes'}{' '}
            <Text style={styles.count}>({filtered.length})</Text>
          </Text>
          <FlatList
            data={filtered.slice(featured ? 1 : 0)}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              <Text style={styles.empty}>No recipes yet. Tap Import to add your first one.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.gridItem}>
                <RecipeCard
                  recipe={item}
                  onPress={() => router.push(`/recipe/${item.id}`)}
                />
              </View>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  accountBtn: {
    padding: spacing.xs,
  },
  brand: {
    ...typography.hero,
    color: colors.text,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
  },
  folderRow: {
    paddingVertical: spacing.xs,
  },
  manageFolders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  manageFoldersText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  count: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  grid: {
    gap: spacing.md,
  },
  gridRow: {
    gap: spacing.md,
  },
  gridItem: {
    flex: 1,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
