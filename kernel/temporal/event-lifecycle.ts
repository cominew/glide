// kernel/temporal/event-lifecycle.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Event Lifecycle Manager
// Part of Kernel Temporal Layer. Manages the "physics of time"
// for events: state transitions, aging, and temporal evolution.
//
// Responsibilities:
// - Listen to all raw GlideEvents from EventBus.
// - Convert them into structured TemporalEvents.
// - Manage state machine (NEW → ACTIVE → PENDING_APPROVAL → ...).
// - Apply aging and priority evolution over time.
// - Emit lifecycle-specific events for other layers (e.g., event-store).
// ─────────────────────────────────────────────────────────────

import { EventBus } from '../event-bus/event-bus';
import { GlideEvent } from '../types';
import { TemporalEvent } from './temporal-event';

export class EventLifecycleManager {
  private activeEvents = new Map<string, TemporalEvent>();

  constructor(private eventBus: EventBus) {
    // Listen to all raw events flowing through the system
    this.eventBus.onAny((raw: GlideEvent) => this.handleRawEvent(raw));
  }

  /**
   * Process an incoming raw event: create or update its TemporalEvent.
   */
  private handleRawEvent(raw: GlideEvent): void {
    let temporal = this.activeEvents.get(raw.id);

    if (!temporal) {
      temporal = this.createTemporalEvent(raw);
      this.activeEvents.set(temporal.id, temporal);
      this.emit('event.created', temporal);
    }

    const prevState = temporal.state;
    this.applyStateTransition(temporal, raw);
    this.updateTemporalFields(temporal, raw);

    // Emit state change event if state transitioned
    if (prevState !== temporal.state) {
      this.emit('event.state_changed', temporal, { prevState });
    }

    // If terminal, remove from active and emit archived
    if (this.isTerminal(temporal.state)) {
      this.activeEvents.delete(temporal.id);
      this.emit('event.archived', temporal);
    } else {
      this.emit('event.updated', temporal);
    }
  }

  /**
   * Create a new TemporalEvent from a raw GlideEvent.
   */
  private createTemporalEvent(raw: GlideEvent): TemporalEvent {
  const now = Date.now();
  return {
    id: raw.id,
    type: this.mapToTemporalType(raw.type),
    source: raw.source as unknown as TemporalEvent['source'],
    createdAt: now,
    updatedAt: now,
    state: this.initialState(raw.type),
    approval: 'AUTO_ALLOWED',
    riskLevel: 1,
    importance: 50,
    urgency: 50,
    payload: raw.payload,
    visibility: 'SYSTEM',
  };
}

  /**
   * Apply state transition based on the raw event type.
   */
  private applyStateTransition(temporal: TemporalEvent, raw: GlideEvent): void {
    switch (raw.type) {
      case 'task.validated':
        temporal.state = 'ACTIVE';
        break;
      case 'task.awaiting_human':
        temporal.state = 'PENDING_APPROVAL';
        temporal.approval = 'REQUIRES_HUMAN';
        break;
      case 'task.executing':
        temporal.state = 'RUNNING';
        temporal.startedAt = Date.now();
        break;
      case 'task.completed':
        temporal.state = 'COMPLETED';
        temporal.finishedAt = Date.now();
        temporal.result = raw.payload?.result;
        break;
      case 'task.failed':
        temporal.state = 'FAILED';
        temporal.finishedAt = Date.now();
        temporal.error = raw.payload?.error;
        break;
      case 'task.blocked':
        temporal.state = 'BLOCKED';
        break;
      // Extend with more mappings as needed
    }
  }

  /**
   * Update timestamps, aging score, and other temporal fields.
   */
  private updateTemporalFields(temporal: TemporalEvent, raw: GlideEvent): void {
    temporal.updatedAt = Date.now();
    temporal.agingScore = Math.min(100, Math.floor((Date.now() - temporal.createdAt) / 1000));
    // Optionally copy additional fields from raw event
    if (raw.taskId) temporal.correlationId = raw.taskId;
  }

  private mapToTemporalType(rawType: string): TemporalEvent['type'] {
    if (rawType.startsWith('task.')) return 'TASK';
    if (rawType.startsWith('conscious.')) return 'REFLECTION';
    if (rawType.startsWith('system.')) return 'ALERT';
    return 'USER_INPUT';
  }

  private initialState(rawType: string): TemporalEvent['state'] {
    return rawType.startsWith('task.') ? 'NEW' : 'ACTIVE';
  }

  private isTerminal(state: TemporalEvent['state']): boolean {
    return ['COMPLETED', 'FAILED', 'CANCELLED', 'ARCHIVED'].includes(state);
  }

  /**
   * Emit a lifecycle event onto the same EventBus.
   */
  private emit(type: string, temporal: TemporalEvent, extra?: any): void {
    this.eventBus.emit(type as any, {
      id: `lc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload: { temporal, ...extra },
      timestamp: Date.now(),
      source: 'event-lifecycle',
    });
  }

  // Public API for inspection
  getEvent(id: string): TemporalEvent | undefined {
    return this.activeEvents.get(id);
  }

  listActive(): TemporalEvent[] {
    return Array.from(this.activeEvents.values());
  }
}