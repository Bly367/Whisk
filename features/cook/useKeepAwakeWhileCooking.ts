import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const COOK_KEEP_AWAKE_TAG = 'whisk-cook-mode';

/**
 * Prevents screen lock while cook mode is active.
 * Deactivates on unmount so normal screens can sleep again.
 */
export function useKeepAwakeWhileCooking(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    activateKeepAwakeAsync(COOK_KEEP_AWAKE_TAG).catch(() => {
      // Web / unsupported environments: cook mode still works without keep-awake.
    });

    return () => {
      if (!active) return;
      active = false;
      deactivateKeepAwake(COOK_KEEP_AWAKE_TAG);
    };
  }, [enabled]);
}

export { COOK_KEEP_AWAKE_TAG };
