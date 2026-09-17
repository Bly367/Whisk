import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/tokens';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export default function HomeScreen() {
  const reduceMotion = useReduceMotion();

  return (
    <Screen testID="screen-home">
      <PlaceholderHero
        title="Good to see you"
        body="Pick up where you left off — save a recipe, finish a plan, or open tonight’s list."
        actionLabel="Add a recipe"
        actionTestID="home-add-recipe"
        onAction={() => router.push('/add')}
      />
      <View style={styles.note}>
        <Text variant="caption" tone="secondary">
          {reduceMotion
            ? 'Reduce Motion is on — animations stay brief.'
            : 'Motion stays subtle and useful.'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: spacing.xs,
  },
});
