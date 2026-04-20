// apps/dashboard/events/timeline.ts
// ─────────────────────────────────────────────────────────────
// Observation Surface — the ONLY place UI reads events from.
//
// "你未看此花时，此花与汝心同归于寂"
//
// This is NOT a store. NOT a state. NOT a history.
// It is a pure projection: the most recent events that have
// manifested in this observation session.
//
// Rules:
//   - Only useGlide writes to this surface.
//   - All UI components read from this surface.
//   - No component ever mutates it directly.
//   - It has no concept of "past" or "future".
//   - It does not generate events, only collects them.
//
// "Sequence is not time. Sequence is readability for UI."
// Kernel needs no sequence. UI needs order to perceive relation.
//
// This surface is an ORDERED BUFFER, not a timeline.
// ─────────────────────────────────────────────────────────────

import type { UIEvent } from './events';

const MAX_EVENTS       = 1000;
const PRUNE_THRESHOLD  = 1200;

class ObservationSurface {
  private buffer:    UIEvent[]  = [];
  private listeners: Set<(events: readonly UIEvent[]) => void> = new Set();

  // ── Receive — called ONLY by the Reality Adapter (useGlide) ──

  receive(event: UIEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > PRUNE_THRESHOLD) {
      this.buffer = this.buffer.slice(-MAX_EVENTS);
    }
    this.notify();
  }

  // Keep `append` as alias so existing callsites don't break
  append(event: UIEvent): void {
    this.receive(event);
  }

  // ── Query — pure reads, no side effects ──────────────────────

  getAll(): readonly UIEvent[] {
    return Object.freeze([...this.buffer]);
  }

  getByTaskId(taskId: string): readonly UIEvent[] {
    return Object.freeze(this.buffer.filter(e => e.taskId === taskId));
  }

  getRecent(count: number): readonly UIEvent[] {
    return Object.freeze(this.buffer.slice(-count));
  }

  getLatestForTask(taskId: string): UIEvent | null {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].taskId === taskId) return this.buffer[i];
    }
    return null;
  }

  /** Returns true when task.completed has manifested for this taskId. */
  isTaskCompleted(taskId: string): boolean {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const e = this.buffer[i];
      if (e.taskId === taskId && e.type === 'task.completed') return true;
    }
    return false;
  }

  /** Returns true when answer.end has manifested for this taskId. */
  hasAnswer(taskId: string): boolean {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const e = this.buffer[i];
      if (e.taskId === taskId && e.type === 'answer.end') return true;
    }
    return false;
  }

  /** Extract answer text if answer.end has manifested. */
  getAnswer(taskId: string): string | null {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const e = this.buffer[i];
      if (e.taskId !== taskId) continue;
      if (e.type === 'answer.end') return e.payload?.answer ?? null;
      if (e.type === 'task.completed') {
        const r = e.payload?.result;
        return typeof r === 'string' ? r : r?.answer ?? r?.text ?? null;
      }
    }
    return null;
  }

  // ── Session reset ─────────────────────────────────────────────

  clear(): void {
    this.buffer = [];
    this.notify();
  }

  // ── Subscription ──────────────────────────────────────────────

  subscribe(listener: (events: readonly UIEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get count(): number {
    return this.buffer.length;
  }

  private notify(): void {
    const snapshot = Object.freeze([...this.buffer]);
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch (err) {
        console.error('[ObservationSurface] listener error:', err);
      }
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────
// One observation surface per session.
// All components look at the same surface.
// No component owns it.

export const observationSurface = new ObservationSurface();
export type { UIEvent };