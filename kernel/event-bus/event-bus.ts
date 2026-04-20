// kernel/event-bus/event-bus.ts
// ─────────────────────────────────────────────────────────────
// L0 — Kernel EventBus
// Uses GlideEvent, EventSource from event-contract.ts ONLY.
// No duplicate type definitions here.
// ─────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import crypto           from 'crypto';
import type {
  GlideEvent,
  EventSource,
  EventTrace
} from './event-contract';

export { GlideEvent, EventSource, EventTrace };
export type KernelEvent<T = any> = GlideEvent<T>;  // backward compat alias

export class EventBus extends EventEmitter {

  private anyHandlers = new Set<(event: GlideEvent) => void>();

  // ── Primary typed emit ────────────────────────────────────
  emitEvent<T>(
    type:    string,
    payload: T,
    source:  EventSource = 'SYSTEM',
    taskId?: string,
    parentEventId?: string,
  ): GlideEvent<T> {
    const event: GlideEvent<T> = {
      id:        crypto.randomUUID(),
      type,
      source,
      timestamp: Date.now(),
      payload,
      trace:     { taskId, parentEventId },
    };
    super.emit(type, event);
    this.fanout(event);
    return event;
  }

  // ── Compatibility shim ────────────────────────────────────
  // Accepts pre-built GlideEvents OR legacy raw payloads.
  emit(type: string, payloadOrEvent: any, source?: EventSource, taskId?: string): boolean {
    // Already a GlideEvent (has trace field)
    if (payloadOrEvent?.trace !== undefined && payloadOrEvent?.id) {
      super.emit(type, payloadOrEvent);
      this.fanout(payloadOrEvent);
      return true;
    }
    // Legacy KernelEvent (id + timestamp, no trace)
    if (payloadOrEvent?.id && payloadOrEvent?.timestamp) {
      const normalized: GlideEvent = {
        ...payloadOrEvent,
        source: payloadOrEvent.source ?? source ?? 'SYSTEM',
        trace: {
          taskId: payloadOrEvent.taskId ?? payloadOrEvent.trace?.taskId ?? taskId,
        },
      };
      super.emit(type, normalized);
      this.fanout(normalized);
      return true;
    }
    // Raw payload
    this.emitEvent(type, payloadOrEvent, source ?? 'SYSTEM', taskId);
    return true;
  }

  onAny(handler: (event: GlideEvent) => void): void {
    this.anyHandlers.add(handler);
  }

  offAny(handler: (event: GlideEvent) => void): void {
    this.anyHandlers.delete(handler);
  }

  private fanout(event: GlideEvent): void {
    for (const h of this.anyHandlers) {
      try { h(event); } catch (err) {
        console.error('[EventBus] handler error:', err);
      }
    }
  }
}

export const globalEventBus = new EventBus();