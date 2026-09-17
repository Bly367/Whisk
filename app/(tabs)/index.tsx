import { router } from 'expo-router';

import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';

export default function HomeScreen() {
  return (
    <Screen testID="screen-home">
      <PlaceholderHero
        title="Good to see you"
        body="Pick up where you left off — save a recipe, finish a plan, or open tonight’s list."
        actionLabel="Add a recipe"
        actionTestID="home-add-recipe"
        onAction={() => router.push('/add')}
      />
    </Screen>
  );
}
