/**
 * P2-W8 — hands-free cook step navigation (pure boundaries + Reduce Motion feedback).
 */

export type CookNavAction = 'next' | 'back';

export type CookNavResult = {
  stepIndex: number;
  didChange: boolean;
  /** True when the action could not move (first/last step). */
  atBoundary: boolean;
};

export function clampStepIndex(stepIndex: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  if (stepIndex < 0) return 0;
  if (stepIndex > totalSteps - 1) return totalSteps - 1;
  return stepIndex;
}

export function navigateCookStep(input: {
  stepIndex: number;
  totalSteps: number;
  action: CookNavAction;
}): CookNavResult {
  const current = clampStepIndex(input.stepIndex, input.totalSteps);
  if (input.totalSteps <= 0) {
    return { stepIndex: 0, didChange: false, atBoundary: true };
  }

  if (input.action === 'next') {
    if (current >= input.totalSteps - 1) {
      return { stepIndex: current, didChange: false, atBoundary: true };
    }
    return { stepIndex: current + 1, didChange: true, atBoundary: false };
  }

  if (current <= 0) {
    return { stepIndex: 0, didChange: false, atBoundary: true };
  }
  return { stepIndex: current - 1, didChange: true, atBoundary: false };
}

export type HandsFreeNavFeedback = {
  /** Live-region / accessibility announcement for the new step. */
  announce: boolean;
  /** Visual transition (skipped when Reduce Motion is on). */
  animateTransition: boolean;
};

export function handsFreeNavFeedback(input: {
  reduceMotion: boolean;
  didChange: boolean;
}): HandsFreeNavFeedback {
  if (!input.didChange) {
    return { announce: false, animateTransition: false };
  }
  return {
    announce: true,
    animateTransition: !input.reduceMotion,
  };
}
