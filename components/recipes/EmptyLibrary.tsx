import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type EmptyLibraryProps = {
  onAdd: () => void;
};

/**
 * Empty recipe library — chick guide + one primary CTA.
 */
export function EmptyLibrary({ onAdd }: EmptyLibraryProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap} testID="recipes-empty">
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[
          styles.chick,
          {
            backgroundColor: colors.brand.chick,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.eye, { backgroundColor: colors.textPrimary }]} />
        <View style={[styles.eye, styles.eyeRight, { backgroundColor: colors.textPrimary }]} />
        <View style={[styles.beak, { backgroundColor: colors.brand.yolkPressed }]} />
      </View>
      <Text variant="title2">No recipes yet</Text>
      <Text variant="body" tone="secondary" style={styles.body}>
        Save your first recipe and it’ll show up here, ready to search, plan, and cook.
      </Text>
      <Button
        label="Add your first recipe"
        onPress={onAdd}
        testID="recipes-empty-cta"
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  chick: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  eye: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    top: 22,
    left: 18,
  },
  eyeRight: {
    left: 40,
  },
  beak: {
    position: 'absolute',
    width: 12,
    height: 8,
    borderRadius: 2,
    top: 34,
    left: 26,
  },
  body: {
    maxWidth: 320,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});
