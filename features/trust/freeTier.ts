/**
 * Free-tier limits and plain-language monetization copy (W7).
 * Limits are shown before limited actions — never mid-cook or mid-import.
 */

export const FREE_TIER = {
  /** Weekly website/social/OCR imports on the free plan. */
  importsPerWeek: 5,
  /** Manual create is never limited. */
  unlimitedManualCreate: true,
  trialDays: 7,
  monthlyPriceLabel: '$4.99 per month',
  annualPriceLabel: '$39.99 per year',
  /** ISO-ish display helper for demos; real billing wires later. */
  cancelPathLabel: 'Cancel anytime in Account → Subscription',
} as const;

export type FreeTierUsage = {
  importsUsedThisWeek: number;
  weekStartIso: string;
  /** Simulated downgrade / limit-hit; saved recipes stay usable. */
  isDowngraded: boolean;
};

export type LimitGateResult =
  | { allowed: true; remaining: number }
  | {
      allowed: false;
      remaining: 0;
      reason: 'import_limit';
      message: string;
    };

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

export function describeImportLimit(usage: FreeTierUsage): string {
  const remaining = importsRemaining(usage);
  if (usage.isDowngraded) {
    return `You're on the free plan (${FREE_TIER.importsPerWeek} imports per week). Saved recipes stay on this device and can still be exported.`;
  }
  if (remaining === 0) {
    return `You've used all ${FREE_TIER.importsPerWeek} free imports this week. Saved recipes stay viewable and exportable. Upgrade before starting another import.`;
  }
  return `Free plan: ${remaining} of ${FREE_TIER.importsPerWeek} imports left this week. Limits are shown before you start — never while you cook.`;
}

export function describeTrialOffer(renewalDateLabel: string): string {
  return `${FREE_TIER.trialDays}-day trial, then ${FREE_TIER.monthlyPriceLabel} (or ${FREE_TIER.annualPriceLabel}). Renews on ${renewalDateLabel}. ${FREE_TIER.cancelPathLabel}.`;
}

/**
 * Gate a limited import action. Call before navigation into an import flow.
 * Manual create must not use this gate.
 */
export function gateImportAction(usage: FreeTierUsage): LimitGateResult {
  const remaining = importsRemaining(usage);
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      reason: 'import_limit',
      message: describeImportLimit(usage),
    };
  }
  return { allowed: true, remaining };
}

/** Actions that must never show an upgrade interrupt. */
export const NO_UPGRADE_INTERRUPT_CONTEXTS = ['cook_mode', 'unfinished_import'] as const;

export type NoUpgradeContext = (typeof NO_UPGRADE_INTERRUPT_CONTEXTS)[number];

export function mayShowUpgradePrompt(context: string): boolean {
  return !(NO_UPGRADE_INTERRUPT_CONTEXTS as readonly string[]).includes(context);
}
