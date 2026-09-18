/**
 * P2-W8 — hands-free step navigation boundaries (test-first).
 * These tests intentionally fail until cookStepNavigation lands.
 */
import {
  clampStepIndex,
  handsFreeNavFeedback,
  navigateCookStep,
} from '@/features/cook/cookStepNavigation';

describe('cook step navigation (P2-W8)', () => {
  it('clamps step index to [0, totalSteps - 1]', () => {
    expect(clampStepIndex(-1, 5)).toBe(0);
    expect(clampStepIndex(0, 5)).toBe(0);
    expect(clampStepIndex(4, 5)).toBe(4);
    expect(clampStepIndex(99, 5)).toBe(4);
  });

  it('returns 0 when there are no steps', () => {
    expect(clampStepIndex(3, 0)).toBe(0);
    expect(clampStepIndex(-2, 0)).toBe(0);
  });

  it('next advances until last step then stays put (finish is separate)', () => {
    expect(navigateCookStep({ stepIndex: 0, totalSteps: 3, action: 'next' })).toEqual({
      stepIndex: 1,
      didChange: true,
      atBoundary: false,
    });
    expect(navigateCookStep({ stepIndex: 2, totalSteps: 3, action: 'next' })).toEqual({
      stepIndex: 2,
      didChange: false,
      atBoundary: true,
    });
  });

  it('back retreats until first step then stays put', () => {
    expect(navigateCookStep({ stepIndex: 2, totalSteps: 3, action: 'back' })).toEqual({
      stepIndex: 1,
      didChange: true,
      atBoundary: false,
    });
    expect(navigateCookStep({ stepIndex: 0, totalSteps: 3, action: 'back' })).toEqual({
      stepIndex: 0,
      didChange: false,
      atBoundary: true,
    });
  });

  it('hands-free feedback skips animation when Reduce Motion is on', () => {
    expect(handsFreeNavFeedback({ reduceMotion: false, didChange: true })).toEqual({
      announce: true,
      animateTransition: true,
    });
    expect(handsFreeNavFeedback({ reduceMotion: true, didChange: true })).toEqual({
      announce: true,
      animateTransition: false,
    });
    expect(handsFreeNavFeedback({ reduceMotion: false, didChange: false })).toEqual({
      announce: false,
      animateTransition: false,
    });
  });
});
