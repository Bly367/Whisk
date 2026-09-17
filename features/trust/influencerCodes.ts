/**
 * Influencer promo codes and admin unlock codes.
 *
 * Discount codes drop the one-time unlock price (default $6.99 → $4.99).
 * Admin codes grant influencers unlimited access without payment.
 *
 * Add new influencers by appending to INFLUENCER_CODE_REGISTRY — no UI changes required.
 */

import { PAYMENT, type Entitlement, type UnlockPricing } from '@/features/trust/freeTier';

export type InfluencerCodeKind = 'discount' | 'admin';

export type InfluencerCodeDefinition = {
  /** Display / storage form; matching is case-insensitive. */
  code: string;
  /** Stable id for analytics / attribution. */
  influencerId: string;
  kind: InfluencerCodeKind;
  /**
   * Discount codes only: one-time price in cents after redeem.
   * Defaults to PAYMENT.discountedPriceCents ($4.99).
   */
  discountedPriceCents?: number;
};

/**
 * Extensible registry. Give each influencer their own discount and/or admin code.
 * Keep codes unique across kinds.
 */
export const INFLUENCER_CODE_REGISTRY: readonly InfluencerCodeDefinition[] = [
  {
    code: 'WHISK499',
    influencerId: 'demo',
    kind: 'discount',
    discountedPriceCents: PAYMENT.discountedPriceCents,
  },
  {
    code: 'WHISK-ADMIN-DEMO',
    influencerId: 'demo',
    kind: 'admin',
  },
] as const;

export type RedeemCodeResult =
  | {
      ok: true;
      kind: 'discount';
      definition: InfluencerCodeDefinition;
      pricing: UnlockPricing;
      message: string;
    }
  | {
      ok: true;
      kind: 'admin';
      definition: InfluencerCodeDefinition;
      entitlement: Extract<Entitlement, 'admin'>;
      message: string;
    }
  | {
      ok: false;
      reason: 'empty' | 'unknown' | 'already_admin';
      message: string;
    };

export function normalizeInfluencerCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function findInfluencerCode(raw: string): InfluencerCodeDefinition | null {
  const normalized = normalizeInfluencerCode(raw);
  if (!normalized) return null;
  return (
    INFLUENCER_CODE_REGISTRY.find((entry) => normalizeInfluencerCode(entry.code) === normalized) ??
    null
  );
}

export function pricingForDiscountCode(definition: InfluencerCodeDefinition | null): UnlockPricing {
  if (!definition || definition.kind !== 'discount') {
    return {
      priceCents: PAYMENT.oneTimePriceCents,
      priceLabel: PAYMENT.oneTimePriceLabel,
      isDiscounted: false,
      influencerCode: null,
      influencerId: null,
    };
  }
  const priceCents = definition.discountedPriceCents ?? PAYMENT.discountedPriceCents;
  return {
    priceCents,
    priceLabel: formatUsdFromCents(priceCents),
    isDiscounted: true,
    influencerCode: definition.code,
    influencerId: definition.influencerId,
  };
}

export function formatUsdFromCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Validate and describe redeeming a code. Does not mutate session state —
 * call sessionStore.applyInfluencerCode after a successful result.
 */
export function redeemInfluencerCode(
  raw: string,
  options: { currentEntitlement?: Entitlement } = {},
): RedeemCodeResult {
  const normalized = normalizeInfluencerCode(raw);
  if (!normalized) {
    return {
      ok: false,
      reason: 'empty',
      message: 'Enter an influencer or admin code.',
    };
  }

  const definition = findInfluencerCode(normalized);
  if (!definition) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'That code isn’t recognized. Check the spelling and try again.',
    };
  }

  if (definition.kind === 'admin') {
    if (options.currentEntitlement === 'admin') {
      return {
        ok: false,
        reason: 'already_admin',
        message: 'Admin access is already active on this device.',
      };
    }
    return {
      ok: true,
      kind: 'admin',
      definition,
      entitlement: 'admin',
      message: `Admin code applied for ${definition.influencerId}. All features are unlocked on this device.`,
    };
  }

  const pricing = pricingForDiscountCode(definition);
  return {
    ok: true,
    kind: 'discount',
    definition,
    pricing,
    message: `Influencer code applied. Unlock is ${pricing.priceLabel} one time (was ${PAYMENT.oneTimePriceLabel}).`,
  };
}
