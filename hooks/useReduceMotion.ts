import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Respects the OS Reduce Motion setting.
 * Use to skip or shorten non-essential animations.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setReduceMotion(enabled);
      },
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

/** Duration helper: returns 0 when Reduce Motion is on. */
export function motionDuration(ms: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : ms;
}
