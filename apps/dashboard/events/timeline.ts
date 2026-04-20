// apps/dashboard/events/timeline.ts
// ─────────────────────────────────────────────────────────────
// Observation Surface — the ONLY place UI reads events from.
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

import { UIEvent } from './events';

const MAX_EVENTS = 1000;        // maximum events retained in this session
const PRUNE_THRESHOLD = 1200;   // when exceeded, prune to MAX_EVENTS

class ObservationSurface {
  private events: UIEvent[] = [];
  private listeners: Set<(events: readonly UIEvent[]) => void> = new Set();

  /**
   * Append a new event to the surface.
   * Called ONLY by useGlide when an event is received from EventSource.
   */
  append(event: UIEvent): void {
    this.events.push(event);
    
    // Prune if exceeding threshold (keep most recent)
    if (this.events.length > PRUNE_THRESHOLD) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
    
    this.notify();
  }

  /**
   * Get all events currently on the surface.
   * Returns a frozen copy to prevent accidental mutation.
   */
  getAll(): readonly UIEvent[] {
    return Object.freeze([...this.events]);
  }

  /**
   * Get events filtered by taskId.
   */
  getByTaskId(taskId: string): readonly UIEvent[] {
    return Object.freeze(this.events.filter(e => e.taskId === taskId));
  }

  /**
   * Get the most recent N events.
   */
  getRecent(count: number): readonly UIEvent[] {
    return Object.freeze(this.events.slice(-count));
  }

  /**
   * Get the most recent event for a given taskId.
   */
  getLatestForTask(taskId: string): UIEvent | null {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].taskId === taskId) {
        return this.events[i];
      }
    }
    return null;
  }

  /**
   * Check if a task.completed event has been observed for this taskId.
   * This is NOT "deriving state". It is simply checking whether a
   * specific event has manifested in the current observation window.
   */
  isTaskCompleted(taskId: string): boolean {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.taskId === taskId && e.type === 'task.completed') {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all events (useful for session reset).
   */
  clear(): void {
    this.events = [];
    this.notify();
  }

  /**
   * Subscribe to surface changes.
   * Returns unsubscribe function.
   */
  subscribe(listener: (events: readonly UIEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get the current event count.
   */
  get count(): number {
    return this.events.length;
  }

  private notify(): void {
    const snapshot = Object.freeze([...this.events]);
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[ObservationSurface] Listener error:', err);
      }
    }
  }
}

// Singleton export
export const observationSurface = new ObservationSurface();

// Type exports
export type { UIEvent };