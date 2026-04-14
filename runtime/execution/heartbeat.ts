// runtime/execution/heartbeat.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Heartbeat Manager
// Tracks active tasks and detects stalls.
// Emits typed events via EventBus (not raw strings).
// ─────────────────────────────────────────────────────────────

import { EventBus } from '../../kernel/event-bus/event-bus';

export class HeartbeatManager {

  private active = new Map<string, number>();  // taskId → last beat ms
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  start(taskId: string): void {
    this.active.set(taskId, Date.now());
    this.emit(taskId, 'started');
  }

  beat(taskId: string, phase: string): void {
    this.active.set(taskId, Date.now());
    this.emit(taskId, phase);
  }

  stop(taskId: string): void {
    this.active.delete(taskId);
    this.emitRaw(taskId, 'task.completed');
  }

  // ── Stall detection — call from Scheduler tick ───────────

  checkTimeouts(timeoutMs = 30_000): string[] {
    const now     = Date.now();
    const stalled: string[] = [];

    for (const [taskId, lastBeat] of this.active) {
      if (now - lastBeat > timeoutMs) {
        stalled.push(taskId);
        this.emitRaw(taskId, 'task.failed');
        this.active.delete(taskId);
        console.warn(`[Heartbeat] Task stalled: ${taskId}`);
      }
    }

    return stalled;
  }

  activeCount(): number {
    return this.active.size;
  }

  // ── Helpers ───────────────────────────────────────────────

  private emit(taskId: string, phase: string): void {
    this.eventBus.emit('task.executing', {
      id:        `hb_${taskId}_${Date.now()}`,
      type:      'task.executing',
      payload:   { taskId, phase },
      timestamp: Date.now(),
      source:    'heartbeat',
    });
  }

  private emitRaw(taskId: string, type: string): void {
    this.eventBus.emit(type as any, {
      id:        `hb_${taskId}_${Date.now()}`,
      type,
      payload:   { taskId },
      timestamp: Date.now(),
      source:    'heartbeat',
    });
  }
}
