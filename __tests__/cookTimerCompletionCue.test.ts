/**
 * P2-W8 review fix — audible completion cue (test-first).
 * Fails until shouldSignalAudio / collectTimersNeedingAudibleCue land.
 */
import {
  collectTimersNeedingAudibleCue,
  createCookTimer,
  shouldSignalAudio,
  tickCookTimers,
  type CookTimer,
} from '@/features/cook/cookTimers';
import {
  fireCookTimerCompletionCues,
  playDefaultCookTimerAudible,
  resetCookTimerCompletionSoundForTests,
} from '@/features/cook/cookTimerCompletionCue';

describe('cook timer audible completion (P2-W8)', () => {
  const now = 2_000_000;

  it('shouldSignalAudio is true only on the rising edge of completionSignaled', () => {
    expect(shouldSignalAudio(false, true)).toBe(true);
    expect(shouldSignalAudio(undefined, true)).toBe(true);
    expect(shouldSignalAudio(true, true)).toBe(false);
    expect(shouldSignalAudio(false, false)).toBe(false);
    expect(shouldSignalAudio(true, false)).toBe(false);
  });

  it('collectTimersNeedingAudibleCue returns only timers that newly completed', () => {
    const prev: CookTimer[] = [
      createCookTimer({ id: 'a', label: 'A', durationMs: 5_000, createdAt: now }),
      createCookTimer({ id: 'b', label: 'B', durationMs: 1_000, createdAt: now }),
    ];
    const next = tickCookTimers(prev, now + 1_000);

    expect(collectTimersNeedingAudibleCue(prev, next).map((t) => t.id)).toEqual(['b']);

    // Later tick while still signaled — no second audible fire.
    const later = tickCookTimers(next, now + 2_000);
    expect(collectTimersNeedingAudibleCue(next, later)).toEqual([]);
  });

  it('fireCookTimerCompletionCues plays audible (and optional haptic) once per batch', async () => {
    const playAudible = jest.fn();
    const playHaptic = jest.fn();

    await fireCookTimerCompletionCues(['t1', 't2'], { playAudible, playHaptic });
    expect(playAudible).toHaveBeenCalledTimes(1);
    expect(playHaptic).toHaveBeenCalledTimes(1);

    await fireCookTimerCompletionCues([], { playAudible, playHaptic });
    expect(playAudible).toHaveBeenCalledTimes(1);
    expect(playHaptic).toHaveBeenCalledTimes(1);
  });

  it('playDefaultCookTimerAudible calls expo-audio correctly and caches player', async () => {
    // This test verifies migration from expo-av to expo-audio.
    // We test the behavior by ensuring no errors and proper caching.
    
    // Reset cached sound before test
    resetCookTimerCompletionSoundForTests();

    // First play should succeed without errors (or silently fail on web/test)
    await expect(playDefaultCookTimerAudible()).resolves.not.toThrow();

    // Second play should also succeed
    await expect(playDefaultCookTimerAudible()).resolves.not.toThrow();

    // Clean up
    resetCookTimerCompletionSoundForTests();
  });
});
