/**
 * Hook for managing IAP state in the profile UI.
 * Handles initialization, purchase, and restore flows.
 */

import { useCallback, useEffect, useState } from 'react';

import { createIAPService, createMockIAPService, type IAPService } from './iapService';

export type IAPHookState = {
  available: boolean;
  loading: boolean;
  purchasing: boolean;
  restoring: boolean;
  error: string | null;
  price: string | null;
};

export function useIAP(options: { useMockInDev?: boolean } = {}) {
  const [state, setState] = useState<IAPHookState>({
    available: false,
    loading: true,
    purchasing: false,
    restoring: false,
    error: null,
    price: null,
  });

  const [service] = useState<IAPService>(() => {
    if (__DEV__ && options.useMockInDev) {
      return createMockIAPService();
    }
    return createIAPService();
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      const result = await service.initialize();
      if (!mounted) return;

      if (!result.success) {
        setState((s) => ({
          ...s,
          loading: false,
          available: false,
          error: result.message,
        }));
        return;
      }

      const products = await service.getProducts();
      if (!mounted) return;

      setState((s) => ({
        ...s,
        loading: false,
        available: true,
        price: products[0]?.localizedPrice ?? null,
      }));
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [service]);

  const purchase = useCallback(
    async (productId: string): Promise<{ success: boolean; message: string }> => {
      setState((s) => ({ ...s, purchasing: true, error: null }));

      const result = await service.purchase(productId);

      setState((s) => ({ ...s, purchasing: false }));

      if (result.success) {
        return { success: true, message: 'Purchase successful' };
      }

      setState((s) => ({ ...s, error: result.message }));
      return { success: false, message: result.message };
    },
    [service]
  );

  const restore = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setState((s) => ({ ...s, restoring: true, error: null }));

    const result = await service.restorePurchases();

    setState((s) => ({ ...s, restoring: false }));

    if (result.success) {
      if (result.restored === 0) {
        return { success: true, message: 'No previous purchases found' };
      }
      return { success: true, message: `Restored ${result.restored} purchase(s)` };
    }

    setState((s) => ({ ...s, error: result.message }));
    return { success: false, message: result.message };
  }, [service]);

  return {
    ...state,
    purchase,
    restore,
  };
}
