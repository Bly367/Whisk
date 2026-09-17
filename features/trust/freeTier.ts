/**
 * Free-tier limits and plain-language monetization copy (W7).
 * Limits are shown before limited actions — never mid-cook or mid-import.
 *
 * Unlock is a one-time purchase (not a subscription). Influencer discount codes
 * and admin unlock codes live in `influencerCodes.ts`.
 */

export const FREE_TIER = {
  /** Weekly website/social/OCR imports on the free plan. */
  importsPerWeek: 5,
  /** Manual create is never limited. */
  unlimitedManualCreate: true,
} as const;

/** One-time unlock pricing (default and discounted via influencer codes). */
export const PAYMENT = {
  oneTimePriceCents: 699,
  oneTimePriceLabel: '$6.99',
  discountedPriceCents: 499,
  discountedPriceLabel: '$4.99',
  /** Where users manage purchase / restore later when billing is wired. */
  managePathLabel: 'Manage unlock in Account → Unlock',
} as const;

export type Entitlement = 'free' | 'unlocked' | 'admin';

export type UnlockPricing = {
  priceCents: number;
  priceLabel: string;
  isDiscounted: boolean;
  influencerCode: string | null;
  influencerId: string | null;
};

export type FreeTierUsage = {
  importsUsedThisWeek: number;
  weekStartIso: string;
  /** Simulated downgrade / limit-hit; saved recipes stay usable. */
  isDowngraded: boolean;
};

export type LimitGateResult =
  | { allowed: true; remaining: number; unlimited: boolean }
  | {
      allowed: false;
      remaining: 0;
      unlimited: false;
      reason: 'import_limit';
      message: string;
    };

export function defaultUnlockPricing(): UnlockPricing {
  return {
    priceCents: PAYMENT.oneTimePriceCents,
    priceLabel: PAYMENT.oneTimePriceLabel,
    isDiscounted: false,
    influencerCode: null,
    influencerId: null,
  };
}

export function hasUnlimitedAccess(entitlement: Entitlement): boolean {
  return entitlement === 'unlocked' || entitlement === 'admin';
}

/** Start of the current UTC week (Monday) as YYYY-MM-DD. */
export function currentWeekStartIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function importsRemaining(usage: FreeTierUsage): number {
  return Math.max(0, FREE_TIER.importsPerWeek - usage.importsUsedThisWeek);
}

export function describeImportLimit(
  usage: FreeTierUsage,
  entitlement: Entitlement = 'free',
): string {
  if (hasUnlimitedAccess(entitlement)) {
    if (entitlement === 'admin') {
      return 'Admin unlock is active — imports and all features are unlimited on this device.';
    }
    return 'Unlocked — imports and all features are unlimited on this device.';
  }
  const remaining = importsRemaining(usage);
  if (usage.isDowngraded) {
    return `You're on the free plan (${FREE_TIER.importsPerWeek} imports per week). Saved recipes stay on this device and can still be exported.`;
  }
  if (remaining === 0) {
    return `You've used all ${FREE_TIER.importsPerWeek} free imports this week. Saved recipes stay viewable and exportable. Unlock before starting another import.`;
  }
  return `Free plan: ${remaining} of ${FREE_TIER.importsPerWeek} imports left this week. Limits are shown before you start — never while you cook.`;
}

/** Plain-language one-time unlock offer (optionally after an influencer discount code). */
export function describeUnlockOffer(pricing: UnlockPricing = defaultUnlockPricing()): string {
  if (pricing.isDiscounted && pricing.influencerCode) {
    return `One-time unlock for ${pricing.priceLabel} (influencer code ${pricing.influencerCode}; usually ${PAYMENT.oneTimePriceLabel}). Pay once — no subscription. ${PAYMENT.managePathLabel}.`;
  }
  return `One-time unlock for ${PAYMENT.oneTimePriceLabel}. Pay once — no subscription. Influencer codes can lower the price to ${PAYMENT.discountedPriceLabel}. ${PAYMENT.managePathLabel}.`;
}

/** @deprecated Use describeUnlockOffer — kept name for call-site clarity during migration. */
export function describeTrialOffer(pricing?: UnlockPricing): string {
  return describeUnlockOffer(pricing ?? defaultUnlockPricing());
}

/**
 * Gate a limited import action. Call before navigation into an import flow.
 * Manual create must not use this gate.
 */
export function gateImportAction(
  usage: FreeTierUsage,
  entitlement: Entitlement = 'free',
): LimitGateResult {
  if (hasUnlimitedAccess(entitlement)) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, unlimited: true };
  }
  const remaining = importsRemaining(usage);
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      unlimited: false,
      reason: 'import_limit',
      message: describeImportLimit(usage, entitlement),
    };
  }
  return { allowed: true, remaining, unlimited: false };
}

/** Actions that must never show an upgrade interrupt. */
export const NO_UPGRADE_INTERRUPT_CONTEXTS = ['cook_mode', 'unfinished_import'] as const;

export type NoUpgradeContext = (typeof NO_UPGRADE_INTERRUPT_CONTEXTS)[number];

export function mayShowUpgradePrompt(context: string): boolean {
  return !(NO_UPGRADE_INTERRUPT_CONTEXTS as readonly string[]).includes(context);
}
