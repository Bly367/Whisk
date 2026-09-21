/**
 * IAP service abstraction for one-time unlock purchases.
 * 
 * Wraps expo-iap for App Store and Play Store integration.
 * Provides mock implementation for dev/testing without native modules.
 */

import { IAP_PRODUCT_IDS } from '@/features/trust/iapConfig';

export type PurchaseErrorCode = 
  | 'user_cancelled' 
  | 'store_unavailable' 
  | 'already_owned'
  | 'unavailable'
  | 'unknown';

export type PurchaseResult =
  | {
      success: true;
      transactionId: string;
      productId: string;
    }
  | {
      success: false;
      error: PurchaseErrorCode;
      message: string;
    };

export type RestoreResult =
  | {
      success: true;
      restored: number;
      productIds: string[];
    }
  | {
      success: false;
      error: PurchaseErrorCode;
      message: string;
    };

export type InitResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: PurchaseErrorCode;
      message: string;
    };

export type IAPProduct = {
  productId: string;
  localizedPrice: string;
  price: number;
  currency: string;
  title?: string;
  description?: string;
};

export interface IAPService {
  initialize(): Promise<InitResult>;
  isInitialized(): boolean;
  getProducts(): Promise<IAPProduct[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  endConnection(): Promise<void>;
}

/**
 * Create a mock IAP service for dev/testing.
 * Simulates successful purchases without native store access.
 */
export function createMockIAPService(): IAPService & {
  simulateCancellation?: boolean;
  simulateError?: PurchaseErrorCode;
  hasPreviousPurchase?: boolean;
} {
  let initialized = false;
  const mock = {
    simulateCancellation: false,
    simulateError: undefined as PurchaseErrorCode | undefined,
    hasPreviousPurchase: false,

    async initialize(): Promise<InitResult> {
      initialized = true;
      return { success: true };
    },

    isInitialized(): boolean {
      return initialized;
    },

    async getProducts(): Promise<IAPProduct[]> {
      if (!initialized) {
        throw new Error('Must initialize before getting products');
      }
      return [
        {
          productId: IAP_PRODUCT_IDS.fullUnlock,
          localizedPrice: '$6.99',
          price: 6.99,
          currency: 'USD',
          title: 'Whisk Full Unlock',
          description: 'One-time unlock for unlimited imports and features',
        },
      ];
    },

    async purchase(productId: string): Promise<PurchaseResult> {
      if (!initialized) {
        return {
          success: false,
          error: 'unavailable',
          message: 'Store not initialized',
        };
      }

      if (mock.simulateCancellation) {
        return {
          success: false,
          error: 'user_cancelled',
          message: 'Purchase was cancelled',
        };
      }

      if (mock.simulateError) {
        const messages: Record<PurchaseErrorCode, string> = {
          user_cancelled: 'Purchase was cancelled',
          store_unavailable: 'App Store is not available',
          already_owned: 'You already own this item',
          unavailable: 'In-app purchases are not available',
          unknown: 'An unknown error occurred',
        };
        return {
          success: false,
          error: mock.simulateError,
          message: messages[mock.simulateError],
        };
      }

      return {
        success: true,
        transactionId: `mock_txn_${Date.now()}`,
        productId,
      };
    },

    async restorePurchases(): Promise<RestoreResult> {
      if (!initialized) {
        return {
          success: false,
          error: 'unavailable',
          message: 'Store not initialized',
        };
      }

      if (mock.hasPreviousPurchase) {
        return {
          success: true,
          restored: 1,
          productIds: [IAP_PRODUCT_IDS.fullUnlock],
        };
      }

      return {
        success: true,
        restored: 0,
        productIds: [],
      };
    },

    async endConnection(): Promise<void> {
      initialized = false;
    },
  };

  return mock;
}

/**
 * Create real IAP service using expo-iap.
 * Requires native modules (dev client or production build).
 */
export function createIAPService(): IAPService {
  let initialized = false;
  let iap: typeof import('expo-iap') | null = null;
  let purchaseListener: { remove: () => void } | null = null;
  let errorListener: { remove: () => void } | null = null;

  async function ensureIAP(): Promise<typeof import('expo-iap') | null> {
    if (iap) return iap;
    
    try {
      iap = await import('expo-iap');
      return iap;
    } catch (error) {
      console.warn('[IAP] Native modules not available:', error);
      return null;
    }
  }

  return {
    async initialize(): Promise<InitResult> {
      const expoIAP = await ensureIAP();
      if (!expoIAP) {
        return {
          success: false,
          error: 'unavailable',
          message: 'In-app purchases are not available (requires dev client or production build)',
        };
      }

      try {
        await expoIAP.initConnection();
        initialized = true;
        return { success: true };
      } catch (error) {
        console.error('[IAP] Init failed:', error);
        return {
          success: false,
          error: 'unknown',
          message: error instanceof Error ? error.message : 'Failed to initialize store',
        };
      }
    },

    isInitialized(): boolean {
      return initialized;
    },

    async getProducts(): Promise<IAPProduct[]> {
      const expoIAP = await ensureIAP();
      if (!expoIAP || !initialized) {
        return [];
      }

      try {
        const result = await expoIAP.fetchProducts({
          skus: [IAP_PRODUCT_IDS.fullUnlock],
          type: 'in-app',
        });
        
        if (!result || !Array.isArray(result)) {
          return [];
        }

        return result.map((p: any) => ({
          productId: p.productId || p.id,
          localizedPrice: p.localizedPrice || p.price,
          price: typeof p.price === 'number' ? p.price : parseFloat(p.price || '0'),
          currency: p.currency || 'USD',
          title: p.title,
          description: p.description,
        }));
      } catch (error) {
        console.error('[IAP] Failed to fetch products:', error);
        return [];
      }
    },

    async purchase(productId: string): Promise<PurchaseResult> {
      const expoIAP = await ensureIAP();
      if (!expoIAP || !initialized) {
        return {
          success: false,
          error: 'unavailable',
          message: 'Store is not available',
        };
      }

      return new Promise((resolve) => {
        let resolved = false;

        if (purchaseListener) {
          purchaseListener.remove();
        }
        if (errorListener) {
          errorListener.remove();
        }

        purchaseListener = expoIAP.purchaseUpdatedListener(async (purchase: any) => {
          if (resolved || purchase.productId !== productId) return;
          resolved = true;

          try {
            await expoIAP.finishTransaction({ purchase, isConsumable: false });
            resolve({
              success: true,
              transactionId: purchase.transactionId || purchase.id,
              productId: purchase.productId,
            });
          } catch (error) {
            console.error('[IAP] Failed to finish transaction:', error);
            resolve({
              success: false,
              error: 'unknown',
              message: 'Purchase completed but failed to finish transaction',
            });
          }
        });

        errorListener = expoIAP.purchaseErrorListener((error: any) => {
          if (resolved) return;
          resolved = true;

          const errorCode = error?.code || '';
          const errorMessage = error?.message || String(error);

          if (errorCode === 'E_USER_CANCELLED' || errorCode === 'UserCancelled') {
            resolve({
              success: false,
              error: 'user_cancelled',
              message: 'Purchase was cancelled',
            });
            return;
          }

          if (errorCode === 'E_ALREADY_OWNED' || errorMessage.includes('already')) {
            resolve({
              success: false,
              error: 'already_owned',
              message: 'You already own this item. Try restoring purchases instead.',
            });
            return;
          }

          if (errorCode === 'E_SERVICE_ERROR' || errorMessage.includes('unavailable')) {
            resolve({
              success: false,
              error: 'store_unavailable',
              message: 'App store is temporarily unavailable. Try again later.',
            });
            return;
          }

          resolve({
            success: false,
            error: 'unknown',
            message: errorMessage || 'An error occurred during purchase',
          });
        });

        expoIAP.requestPurchase({
          request: {
            apple: { sku: productId },
            google: { skus: [productId] },
          },
          type: 'in-app',
        }).catch((error: any) => {
          if (resolved) return;
          resolved = true;
          resolve({
            success: false,
            error: 'unknown',
            message: error?.message || 'Failed to initiate purchase',
          });
        });

        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          resolve({
            success: false,
            error: 'unknown',
            message: 'Purchase request timed out',
          });
        }, 60000);
      });
    },

    async restorePurchases(): Promise<RestoreResult> {
      const expoIAP = await ensureIAP();
      if (!expoIAP || !initialized) {
        return {
          success: false,
          error: 'unavailable',
          message: 'Store is not available',
        };
      }

      try {
        await expoIAP.getAvailablePurchases();
        
        const purchases: any[] = [];
        const validPurchases = purchases.filter(
          (p: any) => p.productId === IAP_PRODUCT_IDS.fullUnlock
        );

        for (const purchase of validPurchases) {
          await expoIAP.finishTransaction({ purchase, isConsumable: false });
        }

        return {
          success: true,
          restored: validPurchases.length,
          productIds: validPurchases.map((p: any) => p.productId),
        };
      } catch (error) {
        console.error('[IAP] Restore failed:', error);
        return {
          success: false,
          error: 'unknown',
          message: error instanceof Error ? error.message : 'Failed to restore purchases',
        };
      }
    },

    async endConnection(): Promise<void> {
      const expoIAP = await ensureIAP();
      if (expoIAP) {
        try {
          if (purchaseListener) {
            purchaseListener.remove();
            purchaseListener = null;
          }
          if (errorListener) {
            errorListener.remove();
            errorListener = null;
          }
          await expoIAP.endConnection();
        } catch (error) {
          console.warn('[IAP] Error ending connection:', error);
        }
      }
      initialized = false;
    },
  };
}
