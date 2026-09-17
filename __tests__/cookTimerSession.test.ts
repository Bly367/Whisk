/**
 * P2-W8 — cook timer session store (multiple concurrent timers).
 */
import { useCookTimerSession } from '@/features/cook/cookTimerSession';

describe('cook timer session store (P2-W8)', () => {
  beforeEach(() => {
    useCookTimerSession.setState({ recipeId: null, timers: [] });
  });

  it('holds multiple running timers for one cook session', () => {
    const store = useCookTimerSession.getState();
    store.beginSession('recipe-1');
    const now = 5_000;
    store.addTimer({ label: 'Boil', durationMs: 10_000, nowMs: now });
    store.addTimer({ label: 'Rest', durationMs: 2_000, nowMs: now });

    expect(useCookTimerSession.getState().timers).toHaveLength(2);
    store.tick(now + 2_000);
    const timers = useCookTimerSession.getState().timers;
    expect(timers.find((t) => t.label === 'Rest')?.status).toBe('completed');
    expect(timers.find((t) => t.label === 'Boil')?.status).toBe('running');
    expect(timers.find((t) => t.label === 'Rest')?.completionSignaled).toBe(true);
  });

  it('clears timers when switching recipes', () => {
    const store = useCookTimerSession.getState();
    store.beginSession('a');
    store.addTimer({ label: 'A', durationMs: 1000, nowMs: 0 });
    store.beginSession('b');
    expect(useCookTimerSession.getState().timers).toHaveLength(0);
    expect(useCookTimerSession.getState().recipeId).toBe('b');
  });

  it('acknowledgeCompletion clears completion signal', () => {
    const store = useCookTimerSession.getState();
    store.beginSession('r');
    const id = store.addTimer({ label: 'Done soon', durationMs: 100, nowMs: 0 });
    store.tick(100);
    expect(useCookTimerSession.getState().timers[0].completionSignaled).toBe(true);
    store.acknowledgeCompletion(id);
    expect(useCookTimerSession.getState().timers[0].completionSignaled).toBe(false);
  });
});
