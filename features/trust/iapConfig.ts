/**
 * In-App Purchase configuration for one-time unlock.
 * 
 * Product IDs must be configured in App Store Connect and Google Play Console.
 * These are placeholder values — replace with your actual product IDs before release.
 */

export const IAP_PRODUCT_IDS = {
  /** Base one-time unlock ($6.99) — single SKU for both platforms */
  fullUnlock: __DEV__ 
    ? 'app.whisk.unlock.onetime.dev' 
    : 'app.whisk.unlock.onetime',
  
  /**
   * Optional: discounted unlock SKU if you want separate products.
   * If null, handle influencer discount via promo codes in the store.
   * Currently null — using single SKU + promo codes approach.
   */
  discountedUnlock: null as string | null,
} as const;

/**
 * Whether IAP is available in the current environment.
 * False in web/Expo Go; true in dev client and production.
 * 
 * Note: Actual availability check is handled by iapService.initialize()
 */
export function isIAPAvailable(): boolean {
  // Dynamic check is implemented in iapService.initialize()
  // This is a placeholder for potential future static checks
  return true;
}
