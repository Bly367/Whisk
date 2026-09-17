import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';

export default function PlanScreen() {
  return (
    <Screen testID="screen-plan">
      <PlaceholderHero
        title="This week’s plan"
        body="Lay out breakfast, lunch, and dinner when you’re ready. Empty slots are fine — no pressure to fill every one."
        actionLabel="Create grocery list"
        actionTestID="plan-create-grocery"
        onAction={() => undefined}
      />
    </Screen>
  );
}
