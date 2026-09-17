import {
  currentWeekStartIso,
  describeImportLimit,
  describeTrialOffer,
  FREE_TIER,
  gateImportAction,
  mayShowUpgradePrompt,
} from '@/features/trust/freeTier';

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

  it('describes trial length, price, and cancel path in plain language', () => {
    const copy = describeTrialOffer('October 1, 2026');
    expect(copy).toContain(`${FREE_TIER.trialDays}-day trial`);
    expect(copy).toContain(FREE_TIER.monthlyPriceLabel);
    expect(copy).toContain('October 1, 2026');
    expect(copy.toLowerCase()).toContain('cancel');
  });
});
