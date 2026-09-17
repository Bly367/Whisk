import {
  currentWeekStartIso,
  defaultUnlockPricing,
  describeImportLimit,
  describeUnlockOffer,
  FREE_TIER,
  gateImportAction,
  hasUnlimitedAccess,
  mayShowUpgradePrompt,
  PAYMENT,
} from '@/features/trust/freeTier';
import {
  findInfluencerCode,
  pricingForDiscountCode,
  redeemInfluencerCode,
} from '@/features/trust/influencerCodes';

describe('free tier limits', () => {
  const week = currentWeekStartIso();

  it('allows imports while under the weekly cap', () => {
    const gate = gateImportAction({
      importsUsedThisWeek: 2,
      weekStartIso: week,
      isDowngraded: false,
    });
    expect(gate.allowed).toBe(true);
    if (gate.allowed) {
      expect(gate.remaining).toBe(FREE_TIER.importsPerWeek - 2);
      expect(gate.unlimited).toBe(false);
    }
  });

  it('blocks when at limit and explains before the action', () => {
    const usage = {
      importsUsedThisWeek: FREE_TIER.importsPerWeek,
      weekStartIso: week,
      isDowngraded: false,
    };
    const gate = gateImportAction(usage);
    expect(gate.allowed).toBe(false);
    expect(describeImportLimit(usage)).toMatch(/before starting another import/i);
  });

  it('never allows upgrade interrupts mid-cook or mid-import', () => {
    expect(mayShowUpgradePrompt('cook_mode')).toBe(false);
    expect(mayShowUpgradePrompt('unfinished_import')).toBe(false);
    expect(mayShowUpgradePrompt('add_boundary')).toBe(true);
  });

  it('describes a one-time unlock price in plain language', () => {
    const copy = describeUnlockOffer();
    expect(copy).toContain(PAYMENT.oneTimePriceLabel);
    expect(copy.toLowerCase()).toContain('one-time');
    expect(copy.toLowerCase()).toContain('no subscription');
    expect(copy).toContain(PAYMENT.discountedPriceLabel);
  });

  it('reflects influencer discount pricing in unlock copy', () => {
    const pricing = pricingForDiscountCode(findInfluencerCode('WHISK499'));
    const copy = describeUnlockOffer(pricing);
    expect(copy).toContain(PAYMENT.discountedPriceLabel);
    expect(copy).toContain('WHISK499');
    expect(copy).toContain(PAYMENT.oneTimePriceLabel);
  });

  it('skips import limits when entitlement is unlocked or admin', () => {
    const usage = {
      importsUsedThisWeek: FREE_TIER.importsPerWeek,
      weekStartIso: week,
      isDowngraded: false,
    };
    expect(hasUnlimitedAccess('unlocked')).toBe(true);
    expect(hasUnlimitedAccess('admin')).toBe(true);
    expect(gateImportAction(usage, 'unlocked').allowed).toBe(true);
    expect(gateImportAction(usage, 'admin').allowed).toBe(true);
    expect(describeImportLimit(usage, 'admin')).toMatch(/admin unlock/i);
  });
});

describe('influencer and admin codes', () => {
  it('redeems a discount code to lower the one-time price to $4.99', () => {
    const result = redeemInfluencerCode('whisk499');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'discount') {
      expect(result.pricing.priceCents).toBe(PAYMENT.discountedPriceCents);
      expect(result.pricing.priceLabel).toBe(PAYMENT.discountedPriceLabel);
      expect(result.pricing.isDiscounted).toBe(true);
    }
  });

  it('redeems an admin code for free full access', () => {
    const result = redeemInfluencerCode('WHISK-ADMIN-DEMO');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'admin') {
      expect(result.entitlement).toBe('admin');
    }
  });

  it('rejects unknown codes', () => {
    const result = redeemInfluencerCode('NOT-A-REAL-CODE');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown');
    }
  });

  it('defaults pricing to $6.99 without a discount code', () => {
    expect(defaultUnlockPricing().priceLabel).toBe('$6.99');
    expect(pricingForDiscountCode(null).priceCents).toBe(699);
  });
});
