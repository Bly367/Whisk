/**
 * IAP service tests (test-first).
 * 
 * These tests define the expected behavior before implementation.
 * Run to see RED, then implement the service to make them GREEN.
 */

import { IAP_PRODUCT_IDS } from '@/features/trust/iapConfig';
import {
  type IAPService,
  createIAPService,
  createMockIAPService,
} from '@/features/trust/iapService';

describe('IAP service (mock implementation)', () => {
  let service: IAPService;

  beforeEach(() => {
    service = createMockIAPService();
  });

  it('initializes connection successfully', async () => {
    const result = await service.initialize();
    expect(result.success).toBe(true);
    expect(service.isInitialized()).toBe(true);
  });

  it('returns available products with correct pricing', async () => {
    await service.initialize();
    const products = await service.getProducts();
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe(IAP_PRODUCT_IDS.fullUnlock);
    expect(products[0].localizedPrice).toMatch(/\$6\.99/);
  });

  it('successfully purchases and returns transaction', async () => {
    await service.initialize();
    const result = await service.purchase(IAP_PRODUCT_IDS.fullUnlock);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transactionId).toBeTruthy();
      expect(result.productId).toBe(IAP_PRODUCT_IDS.fullUnlock);
    }
  });

  it('handles user cancellation gracefully', async () => {
    await service.initialize();
    const mockService = service as ReturnType<typeof createMockIAPService>;
    mockService.simulateCancellation = true;
    
    const result = await service.purchase(IAP_PRODUCT_IDS.fullUnlock);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('user_cancelled');
      expect(result.message).toMatch(/cancel/i);
    }
  });

  it('handles store errors with clear messages', async () => {
    await service.initialize();
    const mockService = service as ReturnType<typeof createMockIAPService>;
    mockService.simulateError = 'store_unavailable';
    
    const result = await service.purchase(IAP_PRODUCT_IDS.fullUnlock);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('store_unavailable');
      expect(result.message).toBeTruthy();
    }
  });

  it('restores previous purchases successfully', async () => {
    await service.initialize();
    const mockService = service as ReturnType<typeof createMockIAPService>;
    mockService.hasPreviousPurchase = true;
    
    const result = await service.restorePurchases();
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.restored).toBeGreaterThan(0);
      expect(result.productIds).toContain(IAP_PRODUCT_IDS.fullUnlock);
    }
  });

  it('returns empty result when no purchases to restore', async () => {
    await service.initialize();
    const result = await service.restorePurchases();
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.restored).toBe(0);
      expect(result.productIds).toHaveLength(0);
    }
  });

  it('handles already-owned purchases', async () => {
    await service.initialize();
    const mockService = service as ReturnType<typeof createMockIAPService>;
    mockService.simulateError = 'already_owned';
    
    const result = await service.purchase(IAP_PRODUCT_IDS.fullUnlock);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('already_owned');
      expect(result.message).toMatch(/already/i);
    }
  });

  it('cleans up connection on end', async () => {
    await service.initialize();
    expect(service.isInitialized()).toBe(true);
    
    await service.endConnection();
    expect(service.isInitialized()).toBe(false);
  });
});

describe('IAP service availability', () => {
  it('provides mock service for testing', () => {
    const mock = createMockIAPService();
    expect(mock).toBeDefined();
    expect(typeof mock.purchase).toBe('function');
  });

  it('real service requires native modules', async () => {
    // Real service creation will throw or return unavailable state
    // in web/Expo Go environments
    const service = createIAPService();
    const initResult = await service.initialize();
    
    // In test environment (Jest), we expect either:
    // - success: false with 'unavailable' error, OR
    // - success: true if running in an environment with native modules
    if (!initResult.success) {
      expect(initResult.error).toBe('unavailable');
    }
  });
});
