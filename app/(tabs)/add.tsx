import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const SOURCES = [
  {
    id: 'link',
    label: 'Paste a link',
    hint: 'From a recipe site',
    href: '/import/url',
  },
  {
    id: 'social',
    label: 'Import from social',
    hint: 'Share sheet or saved post',
    href: '/import/share',
  },
  {
    id: 'scan',
    label: 'Scan a photo',
    hint: 'Cookbook page or screenshot',
    href: '/import/ocr',
  },
  {
    id: 'manual',
    label: 'Create manually',
    hint: 'Type it in yourself',
    href: '/import/manual',
  },
] as const;

export default function AddScreen() {
  const { colors } = useTheme();

  return (
    <Screen testID="screen-add" showSyncStatus={false}>
      <PlaceholderHero
        title="Add a recipe"
        body="Bring one in from a link, a share, a photo, or scratch. You’ll review it before it’s saved."
      />
      <View style={styles.list}>
        {SOURCES.map((source) => (
          <View
            key={source.id}
            style={[
              styles.row,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.rowCopy}>
              <Text variant="headline">{source.label}</Text>
              <Text variant="caption" tone="secondary">
                {source.hint}
              </Text>
            </View>
            <Button
              label="Start"
              variant="secondary"
              testID={`add-source-${source.id}`}
              accessibilityHint={`Open ${source.label}`}
              onPress={() => router.push(source.href)}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    minHeight: 72,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
