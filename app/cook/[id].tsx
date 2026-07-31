import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useRecipeStore } from '../../store/recipeStore';

export default function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const [stepIndex, setStepIndex] = useState(0);

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.text}>Recipe not found</Text>
      </SafeAreaView>
    );
  }

  const step = recipe.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === recipe.steps.length - 1;

  return (
    <LinearGradient
      colors={[colors.bg, '#14101A', colors.bg]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.recipeName} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.progress}>
          {recipe.steps.map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]}
            />
          ))}
        </View>

        <View style={styles.stepArea}>
          <Text style={styles.stepLabel}>
            Step {stepIndex + 1} of {recipe.steps.length}
          </Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>

        <View style={styles.nav}>
          <Pressable
            onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={isFirst ? colors.textMuted : colors.text} />
            <Text style={[styles.navText, isFirst && styles.navTextDisabled]}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (isLast) router.back();
              else setStepIndex((i) => i + 1);
            }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextText}>{isLast ? 'Done' : 'Next Step'}</Text>
            <Ionicons name={isLast ? 'checkmark' : 'chevron-forward'} size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  text: {
    color: colors.text,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.xl,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.accent,
  },
  stepArea: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  stepLabel: {
    ...typography.label,
    color: colors.accent,
  },
  stepText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: spacing.md,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navText: {
    ...typography.subtitle,
    color: colors.text,
  },
  navTextDisabled: {
    color: colors.textMuted,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  nextText: {
    ...typography.subtitle,
    color: '#fff',
  },
});
