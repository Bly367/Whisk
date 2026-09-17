import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={[styles.container, { backgroundColor: colors.canvas }]}>
        <Text variant="title2">This screen doesn’t exist</Text>
        <Text variant="body" tone="secondary">
          Head back to Home and keep cooking.
        </Text>
        <Link href="/" style={styles.link} testID="not-found-home">
          <Text variant="callout" tone="info">
            Go to Home
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  link: {
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
