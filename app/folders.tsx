import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useRecipeStore } from '../store/recipeStore';

const defaultColor = '#FF6B4A';

export default function FolderManagementScreen() {
  const folders = useRecipeStore((state) => state.folders);
  const addFolder = useRecipeStore((state) => state.addFolder);
  const updateFolder = useRecipeStore((state) => state.updateFolder);
  const deleteFolder = useRecipeStore((state) => state.deleteFolder);
  const getRecipesByFolder = useRecipeStore((state) => state.getRecipesByFolder);
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍽️');
  const [color, setColor] = useState(defaultColor);

  const reset = () => {
    setEditingId(undefined);
    setName('');
    setEmoji('🍽️');
    setColor(defaultColor);
  };

  const save = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (editingId) {
      updateFolder(editingId, {
        name: cleanName,
        emoji: emoji.trim() || '🍽️',
        color: color.trim() || defaultColor,
      });
    } else {
      addFolder(cleanName, emoji.trim() || '🍽️', color.trim() || defaultColor);
    }
    reset();
  };

  const confirmDelete = (id: string, folderName: string) => {
    Alert.alert(
      'Delete folder?',
      `Recipes in "${folderName}" will stay in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title="Folders"
          subtitle="Create collections for your recipe library."
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.inlineFields}>
              <TextInput
                value={emoji}
                onChangeText={setEmoji}
                style={[styles.input, styles.emojiInput]}
                maxLength={4}
                accessibilityLabel="Folder emoji"
              />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Folder name"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.nameInput]}
                accessibilityLabel="Folder name"
              />
            </View>
            <TextInput
              value={color}
              onChangeText={setColor}
              placeholder="#FF6B4A"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="characters"
              accessibilityLabel="Folder color"
            />
            <View style={styles.formActions}>
              {editingId ? (
                <Pressable onPress={reset} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={save}
                disabled={!name.trim()}
                style={[styles.saveButton, !name.trim() && styles.disabled]}
              >
                <Text style={styles.saveText}>{editingId ? 'Save folder' : 'Add folder'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.list}>
            {folders.map((folder) => (
              <View key={folder.id} style={styles.row}>
                <View style={[styles.folderIcon, { backgroundColor: folder.color }]}>
                  <Text style={styles.emoji}>{folder.emoji}</Text>
                </View>
                <View style={styles.folderCopy}>
                  <Text style={styles.folderName}>{folder.name}</Text>
                  <Text style={styles.folderMeta}>
                    {getRecipesByFolder(folder.id).length} recipes
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingId(folder.id);
                    setName(folder.name);
                    setEmoji(folder.emoji);
                    setColor(folder.color);
                  }}
                  style={styles.iconButton}
                  accessibilityLabel={`Edit ${folder.name}`}
                >
                  <Ionicons name="create-outline" size={19} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(folder.id, folder.name)}
                  style={styles.iconButton}
                  accessibilityLabel={`Delete ${folder.name}`}
                >
                  <Ionicons name="trash-outline" size={19} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  inlineFields: { flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  emojiInput: { width: 68, textAlign: 'center' },
  nameInput: { flex: 1 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  cancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cancelText: { ...typography.caption, color: colors.textMuted },
  disabled: { opacity: 0.45 },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  folderIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  folderCopy: { flex: 1 },
  folderName: { ...typography.subtitle, color: colors.text },
  folderMeta: { ...typography.caption, color: colors.textMuted },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
