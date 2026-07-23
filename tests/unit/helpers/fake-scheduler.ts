import type { Scheduler } from '../../../src/shared/types';

type Task = { fn: () => void; at: number; interval?: number };

/** Deterministik zaman: advance() ile ilerletilir; gerçek timer yok. */
export function createFakeScheduler() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map<number, Task>();

  const scheduler: Scheduler = {
    setTimeout(fn, ms) {
      const id = nextId++;
      tasks.set(id, { fn, at: now + ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(id) {
      tasks.delete(id as unknown as number);
    },
    setInterval(fn, ms) {
      const id = nextId++;
      tasks.set(id, { fn, at: now + ms, interval: ms });
      return id as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval(id) {
      tasks.delete(id as unknown as number);
    },
  };

  function advance(ms: number): void {
    const target = now + ms;
    for (;;) {
      let dueId: number | null = null;
      let dueAt = Infinity;
      for (const [id, t] of tasks) {
        if (t.at <= target && t.at < dueAt) {
          dueAt = t.at;
          dueId = id;
        }
      }
      if (dueId === null) break;
      const task = tasks.get(dueId)!;
      now = task.at;
      if (task.interval !== undefined) {
        task.at = now + task.interval;
      } else {
        tasks.delete(dueId);
      }
      task.fn();
    }
    now = target;
  }

  return {
    scheduler,
    advance,
    now: () => now,
    pendingCount: () => tasks.size,
    pendingTimeouts: () => [...tasks.values()].filter((t) => t.interval === undefined).length,
    pendingIntervals: () => [...tasks.values()].filter((t) => t.interval !== undefined).length,
  };
}
