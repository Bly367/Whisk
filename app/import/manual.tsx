import { router } from 'expo-router';
import { useState } from 'react';
import {
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
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useRecipeStore } from '../../store/recipeStore';

export default function ManualImportScreen() {
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const [title, setTitle] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;

    const ingredients = ingredientsText
      .split('\n')
      .filter(Boolean)
      .map((line, i) => ({
        id: `ing-${i}`,
        amount: '',
        unit: '',
        name: line.trim(),
      }));

    const steps = stepsText.split('\n').filter(Boolean).map((s) => s.trim());

    const id = addRecipe({
      title: title.trim(),
      imageGradient: ['#1A1A2E', '#7C5CFF'],
      source: 'manual',
      folderIds: [],
      servings: 2,
      ingredients,
      steps: steps.length ? steps : ['Add cooking steps'],
      tags: ['manual'],
    });

    router.replace(`/recipe/${id}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title="Add manually"
          subtitle="Type it in — organize later."
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Recipe name" value={title} onChangeText={setTitle} placeholder="Honey Garlic Salmon" />
          <Field
            label="Ingredients (one per line)"
            value={ingredientsText}
            onChangeText={setIngredientsText}
            placeholder={'2 salmon fillets\n3 tbsp honey\n4 cloves garlic'}
            multiline
          />
          <Field
            label="Steps (one per line)"
            value={stepsText}
            onChangeText={setStepsText}
            placeholder={'Pat salmon dry...\nSear skin-side down...'}
            multiline
          />

          <Pressable
            onPress={handleSave}
            disabled={!title.trim()}
            style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveText}>Save Recipe</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMulti]}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMulti: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    ...typography.subtitle,
    color: '#fff',
  },
});
