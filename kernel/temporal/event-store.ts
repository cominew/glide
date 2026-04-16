// kernel/temporal/event-store.ts
// ─────────────────────────────────────────────────────────────
// L2 — Event Store / Truth Ledger
// Immutable append-only log of all KernelEvents.
//
// Lifecycle ≠ Store:
//   Lifecycle = current state of a living event
//   Store     = permanent historical record (never mutates)
//
// What it does:
//   ✔ append every event
//   ✔ query by type, taskId, time range
//   ✔ reconstruct timeline for a task
//   ✔ replay for the Evolution engine
//
// What it does NOT do:
//   ✗ no state transitions
//   ✗ no reasoning
//   ✗ no mutation of stored events
// ─────────────────────────────────────────────────────────────

import { EventBus, KernelEvent } from '../event-bus/event-bus.js';

export class EventStore {

  private events: KernelEvent[] = [];
  private byTask  = new Map<string, string[]>();  // taskId → event ids
  private byType  = new Map<string, string[]>();  // type   → event ids
  private byId    = new Map<string, number>();    // id     → array index

  private readonly MAX_EVENTS = 10_000;

  constructor(bus: EventBus) {
    bus.onAny((event: KernelEvent) => this.append(event));
  }

  // ── Append (internal, immutable) ─────────────────────────

  private append(event: KernelEvent) {
    if (this.events.length >= this.MAX_EVENTS) {
      // Trim oldest 10% — keep recent history
      const trim = Math.floor(this.MAX_EVENTS * 0.1);
      const removed = this.events.splice(0, trim);
      for (const e of removed) {
        this.byId.delete(e.id);
        const typeList = this.byType.get(e.type);
        if (typeList) {
          const idx = typeList.indexOf(e.id);
          if (idx >= 0) typeList.splice(idx, 1);
        }
        if (e.taskId) {
          const taskList = this.byTask.get(e.taskId);
          if (taskList) {
            const idx = taskList.indexOf(e.id);
            if (idx >= 0) taskList.splice(idx, 1);
          }
        }
        // Rebuild index after trim
        this.byId.clear();
        this.events.forEach((ev, i) => this.byId.set(ev.id, i));
      }
    }

    const idx = this.events.length;
    this.events.push(event);
    this.byId.set(event.id, idx);

    if (event.taskId) {
      if (!this.byTask.has(event.taskId)) this.byTask.set(event.taskId, []);
      this.byTask.get(event.taskId)!.push(event.id);
    }

    if (!this.byType.has(event.type)) this.byType.set(event.type, []);
    this.byType.get(event.type)!.push(event.id);
  }

  // ── Query interface ───────────────────────────────────────

  all(): KernelEvent[] {
    return [...this.events];
  }

  getById(id: string): KernelEvent | undefined {
    const idx = this.byId.get(id);
    return idx !== undefined ? this.events[idx] : undefined;
  }

  byTaskId(taskId: string): KernelEvent[] {
    const ids = this.byTask.get(taskId) ?? [];
    return ids.map(id => this.events[this.byId.get(id)!]).filter(Boolean);
  }

  byEventType(type: string): KernelEvent[] {
    const ids = this.byType.get(type) ?? [];
    return ids.map(id => this.events[this.byId.get(id)!]).filter(Boolean);
  }

  since(timestampMs: number): KernelEvent[] {
    return this.events.filter(e => e.timestamp >= timestampMs);
  }

  between(fromMs: number, toMs: number): KernelEvent[] {
    return this.events.filter(e => e.timestamp >= fromMs && e.timestamp <= toMs);
  }

  // Reconstruct the event timeline for a task — ordered by timestamp
  timeline(taskId: string): KernelEvent[] {
    return this.byTaskId(taskId).sort((a, b) => a.timestamp - b.timestamp);
  }

  // Latest N events
  latest(n = 100): KernelEvent[] {
    return this.events.slice(-n);
  }

  count(): number {
    return this.events.length;
  }

  taskIds(): string[] {
    return [...this.byTask.keys()];
  }
}
