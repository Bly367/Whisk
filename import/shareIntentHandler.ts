import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useShareIntentContext } from 'expo-share-intent';

import { parseShareIntent } from '@/import/shareIntent';
import { setSharePayload } from '@/import/sharePayload';

/**
 * Hook to handle incoming share intents and navigate to import screen.
 * Call this in your root layout to enable OS share → Whisk.
 */
export function useShareIntentHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  // Track if we're currently navigating to prevent double-push from rapid share events
  const isNavigating = useRef(false);

  useEffect(() => {
    if (hasShareIntent && shareIntent && !isNavigating.current) {
      // Log raw share intent keys in dev to help diagnose URL-only shares
      if (__DEV__) {
        console.log('[Share] Received share intent with keys:', {
          hasText: !!shareIntent.text,
          hasWebUrl: !!shareIntent.webUrl,
          hasFiles: !!shareIntent.files,
          hasMeta: !!shareIntent.meta,
          type: shareIntent.type,
          textLength: shareIntent.text?.length || 0,
          textPreview: shareIntent.text?.slice(0, 100),
          filesCount: shareIntent.files?.length || 0,
        });
      }

      const parsed = parseShareIntent(shareIntent);

      if (parsed) {
        // Mark as navigating to prevent double-push
        isNavigating.current = true;

        // Store parsed data in memory instead of query params
        // This prevents long captions from being truncated/encoded poorly
        // and handles video/image file paths that can't go in URLs
        setSharePayload(parsed);

        // Navigate to share import screen without query params
        if (pathname !== '/import/share') router.navigate('/import/share');

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
  }, [hasShareIntent, shareIntent, resetShareIntent, router, pathname]);

  return { hasShareIntent, shareIntent };
}
