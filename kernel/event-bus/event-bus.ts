// kernel/event-bus/event-bus.ts
// ─────────────────────────────────────────────────────────────
// L0 — Kernel EventBus (Strong Contract Version)
//
// Converged EventSource:
//   KERNEL | DISPATCHER | RUNTIME | COGNITION | GUARDIAN | SYSTEM
//
// Every event MUST have: id, type, source, timestamp, trace.taskId
// Free-string emit is blocked — use typed emitEvent() only.
// ─────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import crypto           from 'crypto';

// ── Converged EventSource (6 sources only) ────────────────────

export type EventSource =
  | 'KERNEL'
  | 'DISPATCHER'
  | 'RUNTIME'
  | 'COGNITION'
  | 'GUARDIAN'
  | 'SYSTEM';

// ── GlideEvent — canonical contract ──────────────────────────
// trace.taskId links events across layers.
// trace.parentEventId builds the causal chain.

export interface GlideEvent<T = any> {
  id:        string;
  type:      string;
  source:    EventSource;
  timestamp: number;
  payload?:  T;
  trace: {
    taskId?:         string;
    parentEventId?:  string;
    sessionId?:      string;
  };
}

// ── KernelEvent alias (backward compat) ───────────────────────
// Old code uses KernelEvent — keep the alias so nothing breaks.
export type KernelEvent<T = any> = GlideEvent<T>;

// ── EventBus ──────────────────────────────────────────────────

export class EventBus extends EventEmitter {

  private anyHandlers = new Set<(event: GlideEvent) => void>();

  // ── Primary emit — MUST provide source ───────────────────
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
      trace: {
        taskId,
        parentEventId,
      },
    };

    super.emit(type, event);
    this.fanout(event);
    return event;
  }

  // ── Compatibility shim ────────────────────────────────────
  // Accepts pre-built GlideEvent objects OR legacy raw payloads.
  // Normalizes everything into GlideEvent before fanout.
  emit(type: string, payloadOrEvent: any, source?: EventSource, taskId?: string): boolean {
    // Pre-built GlideEvent: has both id and trace
    if (
      payloadOrEvent &&
      typeof payloadOrEvent === 'object' &&
      'id' in payloadOrEvent &&
      'trace' in payloadOrEvent
    ) {
      super.emit(type, payloadOrEvent);
      this.fanout(payloadOrEvent);
      return true;
    }

    // Legacy KernelEvent (has id + timestamp but no trace)
    if (
      payloadOrEvent &&
      typeof payloadOrEvent === 'object' &&
      'id' in payloadOrEvent &&
      'timestamp' in payloadOrEvent
    ) {
      // Normalize: add trace field
      const normalized: GlideEvent = {
        ...payloadOrEvent,
        source: payloadOrEvent.source ?? source ?? 'SYSTEM',
        trace: {
          taskId: payloadOrEvent.taskId ?? taskId,
          parentEventId: undefined,
        },
      };
      super.emit(type, normalized);
      this.fanout(normalized);
      return true;
    }

    // Raw payload — wrap into GlideEvent
    this.emitEvent(type, payloadOrEvent, source ?? 'SYSTEM', taskId);
    return true;
  }

  // ── Subscription API ──────────────────────────────────────

  onAny(handler: (event: GlideEvent) => void): void {
    this.anyHandlers.add(handler);
  }

  offAny(handler: (event: GlideEvent) => void): void {
    this.anyHandlers.delete(handler);
  }

  // ── Internal ──────────────────────────────────────────────

  private fanout(event: GlideEvent): void {
    for (const h of this.anyHandlers) {
      try { h(event); } catch (err) {
        console.error('[EventBus] handler error:', err);
      }
    }
  }
}

export const globalEventBus = new EventBus();
