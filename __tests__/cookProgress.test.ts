import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCookProgressStore } from '@/features/cook/cookProgressStore';

describe('cook progress persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useCookProgressStore.setState({ byRecipeId: {}, hydrated: false });
  });

  it('persists step index across hydrate (survives relaunch)', async () => {
    await useCookProgressStore.getState().setStep('recipe-a', 2);
    useCookProgressStore.setState({ byRecipeId: {}, hydrated: false });

    await useCookProgressStore.getState().hydrate();
    const progress = useCookProgressStore.getState().getProgress('recipe-a');
    expect(progress?.stepIndex).toBe(2);
  });

  it('clears progress when cook finishes', async () => {
    await useCookProgressStore.getState().setStep('recipe-a', 1);
    await useCookProgressStore.getState().clearProgress('recipe-a');
    expect(useCookProgressStore.getState().getProgress('recipe-a')).toBeNull();
  });
});
