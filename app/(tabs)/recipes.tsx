import { router } from 'expo-router';

import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';

export default function RecipesScreen() {
  return (
    <Screen testID="screen-recipes">
      <PlaceholderHero
        title="Your recipes"
        body="Everything you save lands here — searchable by title, ingredient, or tag."
        actionLabel="Add your first recipe"
        actionTestID="recipes-empty-cta"
        onAction={() => router.push('/add')}
      />
    </Screen>
  );
}
