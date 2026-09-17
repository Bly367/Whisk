/**
 * P2-W8 — multi-timer concurrency + completion feedback (test-first).
 * These tests intentionally fail until cookTimers / cookSessionStore land.
 */
import {
  acknowledgeTimerCompletion,
  createCookTimer,
  tickCookTimers,
  type CookTimer,
} from '@/features/cook/cookTimers';

describe('cook multi-timers (P2-W8)', () => {
  const now = 1_000_000;

  it('supports multiple concurrent timers in one cook session', () => {
    const pasta = createCookTimer({
      id: 't1',
      label: 'Pasta',
      durationMs: 10_000,
      createdAt: now,
    });
    const sauce = createCookTimer({
      id: 't2',
      label: 'Sauce',
      durationMs: 5_000,
      createdAt: now,
    });

    expect(pasta.status).toBe('running');
    expect(sauce.status).toBe('running');

    const after4s = tickCookTimers([pasta, sauce], now + 4_000);
    expect(after4s.find((t) => t.id === 't1')?.remainingMs).toBe(6_000);
    expect(after4s.find((t) => t.id === 't2')?.remainingMs).toBe(1_000);
    expect(after4s.every((t) => t.status === 'running')).toBe(true);
  });

  it('marks only the finished timer complete while others keep running', () => {
    const timers: CookTimer[] = [
      createCookTimer({ id: 'a', label: 'A', durationMs: 8_000, createdAt: now }),
      createCookTimer({ id: 'b', label: 'B', durationMs: 3_000, createdAt: now }),
    ];

    const after3s = tickCookTimers(timers, now + 3_000);
    const a = after3s.find((t) => t.id === 'a')!;
    const b = after3s.find((t) => t.id === 'b')!;

    expect(b.status).toBe('completed');
    expect(b.completionSignaled).toBe(true);
    expect(b.remainingMs).toBe(0);
    expect(a.status).toBe('running');
    expect(a.remainingMs).toBe(5_000);
    expect(a.completionSignaled).toBe(false);
  });

  it('acknowledgeTimerCompletion clears the completion signal without removing the timer', () => {
    const done = tickCookTimers(
      [createCookTimer({ id: 'x', label: 'Rest', durationMs: 1_000, createdAt: now })],
      now + 1_000,
    )[0];
    expect(done.completionSignaled).toBe(true);

    const acked = acknowledgeTimerCompletion(done);
    expect(acked.status).toBe('completed');
    expect(acked.completionSignaled).toBe(false);
    expect(acked.id).toBe('x');
  });

  it('tick is idempotent for already-completed timers', () => {
    const completed = tickCookTimers(
      [createCookTimer({ id: 'y', label: 'Y', durationMs: 500, createdAt: now })],
      now + 500,
    )[0];
    const again = tickCookTimers([completed], now + 5_000)[0];
    expect(again.status).toBe('completed');
    expect(again.remainingMs).toBe(0);
    // Signal stays until acknowledged — do not re-fire on later ticks.
    expect(again.completionSignaled).toBe(true);
  });
});
