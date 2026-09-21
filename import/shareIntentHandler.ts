import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useShareIntent } from 'expo-share-intent';

import { parseShareIntent } from '@/import/shareIntent';

/**
 * Hook to handle incoming share intents and navigate to import screen.
 * Call this in your root layout to enable OS share → Whisk.
 */
export function useShareIntentHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: __DEV__,
    resetOnBackground: true,
  });
  
  // Track if we're currently navigating to prevent double-push from rapid share events
  const isNavigating = useRef(false);

  useEffect(() => {
    if (hasShareIntent && shareIntent && !isNavigating.current) {
      const parsed = parseShareIntent(shareIntent);

      if (parsed) {
        // Mark as navigating to prevent double-push
        isNavigating.current = true;
        
        // Navigate to import/share with parsed data
        // We'll pass data via URL params and the screen will pick it up
        const params = new URLSearchParams();
        if (parsed.url) params.set('url', parsed.url);
        if (parsed.caption) params.set('caption', parsed.caption);

        // Navigate to share import screen
        router.push(`/import/share?${params.toString()}`);
        
        // Reset the share intent after navigation
        resetShareIntent();
        
        // Clear navigating flag after a short delay
        setTimeout(() => {
          isNavigating.current = false;
        }, 500);
      } else {
        // Invalid share intent, reset it
        resetShareIntent();
      }
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  return { hasShareIntent, shareIntent };
}
