import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';

export default function ShopScreen() {
  return (
    <Screen testID="screen-shop">
      <PlaceholderHero
        title="Grocery list"
        body="One list from your plan — merged quantities, aisle groups, and undo when you check something off."
      />
    </Screen>
  );
}
