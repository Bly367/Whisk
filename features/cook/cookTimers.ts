/**
 * P2-W8 — pure cooking timer helpers (multi-timer concurrency + completion).
 * Keep side effects (audio/haptics) in the UI layer; this module owns state math.
 */

export type CookTimerStatus = 'running' | 'paused' | 'completed';

export type CookTimer = {
  id: string;
  label: string;
  /** Original duration when started or last resumed. */
  durationMs: number;
  /** Wall-clock ms when the current running segment started. */
  startedAt: number;
  /** Remaining ms when paused (ignored while running). */
  remainingMs: number;
  status: CookTimerStatus;
  /** True once when a timer hits zero until the cook acknowledges it. */
  completionSignaled: boolean;
};

export type CreateCookTimerInput = {
  id: string;
  label: string;
  durationMs: number;
  createdAt: number;
};

export function createCookTimer(input: CreateCookTimerInput): CookTimer {
  const durationMs = Math.max(0, Math.floor(input.durationMs));
  return {
    id: input.id,
    label: input.label.trim() || 'Timer',
    durationMs,
    startedAt: input.createdAt,
    remainingMs: durationMs,
    status: durationMs === 0 ? 'completed' : 'running',
    completionSignaled: durationMs === 0,
  };
}

export function tickCookTimers(timers: readonly CookTimer[], nowMs: number): CookTimer[] {
  return timers.map((timer) => tickOne(timer, nowMs));
}

function tickOne(timer: CookTimer, nowMs: number): CookTimer {
  if (timer.status !== 'running') {
    return timer;
  }

  const elapsed = Math.max(0, nowMs - timer.startedAt);
  const remaining = Math.max(0, timer.durationMs - elapsed);

  if (remaining === 0) {
    // First tick that crosses zero sets completionSignaled; later ticks keep it.
    return {
      ...timer,
      remainingMs: 0,
      status: 'completed',
      completionSignaled: true,
    };
  }

  return {
    ...timer,
    remainingMs: remaining,
  };
}

export function acknowledgeTimerCompletion(timer: CookTimer): CookTimer {
  if (timer.status !== 'completed') {
    return timer;
  }
  return {
    ...timer,
    completionSignaled: false,
  };
}

export function pauseCookTimer(timer: CookTimer, nowMs: number): CookTimer {
  if (timer.status !== 'running') return timer;
  const [ticked] = tickCookTimers([timer], nowMs);
  if (ticked.status === 'completed') return ticked;
  return {
    ...ticked,
    status: 'paused',
  };
}

export function resumeCookTimer(timer: CookTimer, nowMs: number): CookTimer {
  if (timer.status !== 'paused') return timer;
  return {
    ...timer,
    status: 'running',
    durationMs: timer.remainingMs,
    startedAt: nowMs,
  };
}

export function formatTimerRemaining(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
