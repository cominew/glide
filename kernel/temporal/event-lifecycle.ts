// kernel/temporal/event-lifecycle.ts
// ─────────────────────────────────────────────────────────────
// L1 — Temporal Layer / Lifecycle Engine
//
// Transforms raw KernelEvents into TemporalEvents.
// Runs the state machine. Models time. Emits lifecycle events.
//
// What it does:
//   1. State machine  NEW → ACTIVE → RUNNING → COMPLETED/FAILED
//   2. Time modeling  createdAt / startedAt / finishedAt / aging
//   3. Lifecycle emit event.state_changed / event.archived
//
// What it does NOT do:
//   ✗ no query interface (that is EventStore)
//   ✗ no pattern analysis (that is EventEvolution)
//   ✗ no causal linking (that is EventGraph)
// ─────────────────────────────────────────────────────────────

import { EventBus, KernelEvent } from '../event-bus/event-bus.js';
import { EventGraph }            from '../graph/event-graph.js';
import { TemporalEvent, EventLifecycleState, toTemporalEvent } from './temporal-event.js';

// ── State machine transitions ─────────────────────────────────
// Maps incoming event types to lifecycle state changes.
// Only forward transitions are allowed.

const TRANSITIONS: Record<string, EventLifecycleState> = {
  'task.created':       'ACTIVE',
  'task.validated':     'ACTIVE',
  'task.routed':        'ACTIVE',
  'task.executing':     'RUNNING',
  'task.started':       'RUNNING',
  'thinking.start':     'RUNNING',
  'planning.start':     'RUNNING',
  'skill.start':        'RUNNING',
  'task.awaiting_human':'PENDING_APPROVAL',
  'task.completed':     'COMPLETED',
  'answer.end':         'COMPLETED',
  'task.failed':        'FAILED',
  'task.blocked':       'BLOCKED',
};

// ── EventLifecycleManager ─────────────────────────────────────

export class EventLifecycleManager {
  private store = new Map<string, TemporalEvent>();
  private lastByTask = new Map<string, string>();

  constructor(private bus: EventBus) {   // 移除 graph 参数
    this.bus.onAny((event: KernelEvent) => this.ingest(event));
  }

  // ── Ingest ────────────────────────────────────────────────

  ingest(event: KernelEvent): TemporalEvent {
    let temporal = this.store.get(event.id);

    if (!temporal) {
      temporal = toTemporalEvent(event);
      this.store.set(event.id, temporal);
    }

    const prevState = temporal.state;

    // Apply state machine
    this.transition(temporal, event.type);
    // Update timestamps
    this.tick(temporal);
    // Link to parent task event
    this.link(event, temporal);

    // Emit state change if transition occurred
    if (prevState !== temporal.state) {
      this.bus.emitEvent('event.state_changed', {
        eventId: temporal.id,
        from:    prevState,
        to:      temporal.state,
        taskId:  temporal.taskId,
      }, 'SYSTEM');
    }

    // Archive completed/failed events older than 5 min
    this.garbageCollect();

    return temporal;
  }

  // ── Transitions ───────────────────────────────────────────

  private transition(t: TemporalEvent, type: string) {
    const next = TRANSITIONS[type];
    if (!next) return;

    // Only allow forward transitions — never go backwards
    const ORDER: EventLifecycleState[] = [
      'NEW','ACTIVE','RUNNING','PENDING_APPROVAL','WAITING',
      'BLOCKED','COMPLETED','FAILED','CANCELLED','ARCHIVED',
    ];
    const currentRank = ORDER.indexOf(t.state);
    const nextRank    = ORDER.indexOf(next);

    if (nextRank > currentRank || next === 'FAILED' || next === 'BLOCKED') {
      t.state = next;
    }

    if (next === 'RUNNING'   && !t.startedAt)  t.startedAt  = Date.now();
    if (next === 'COMPLETED' && !t.finishedAt) t.finishedAt = Date.now();
    if (next === 'FAILED'    && !t.finishedAt) t.finishedAt = Date.now();
  }

  private tick(t: TemporalEvent) {
    const now   = Date.now();
    t.updatedAt = now;
    t.aging     = now - t.createdAt;
    // Evolve priority score: importance + urgency - decay
    const decay = Math.min(20, t.aging / 60_000);
    t.priorityScore = Math.max(0, (t.importance * 0.7 + t.urgency * 0.3) - decay);
  }

  // ── Causal linking ────────────────────────────────────────
  // Connects events that share a taskId into a causal chain.

  private link(event: KernelEvent, temporal: TemporalEvent) {
    if (!event.taskId) return;
    const prevId = this.lastByTask.get(event.taskId);
    if (prevId && prevId !== event.id) {
      // 直接设置 parentId，不再调用外部 graph
      temporal.parentId = prevId;
    }
    this.lastByTask.set(event.taskId, event.id);
  }


  // ── Cleanup ───────────────────────────────────────────────

  private garbageCollect() {
    const cutoff = Date.now() - 5 * 60_000;
    for (const [id, t] of this.store) {
      if ((t.state === 'COMPLETED' || t.state === 'FAILED') && t.finishedAt && t.finishedAt < cutoff) {
        t.state = 'ARCHIVED';
        this.bus.emitEvent('event.archived', { eventId: id, taskId: t.taskId }, 'SYSTEM');
        this.store.delete(id);
      }
    }
  }

  // ── Read-only accessors ───────────────────────────────────

  get(id: string): TemporalEvent | undefined {
    return this.store.get(id);
  }

  getByTask(taskId: string): TemporalEvent[] {
    return [...this.store.values()].filter(t => t.taskId === taskId);
  }

  getActive(): TemporalEvent[] {
    return [...this.store.values()].filter(t =>
      t.state === 'ACTIVE' || t.state === 'RUNNING' || t.state === 'PENDING_APPROVAL'
    );
  }

  all(): TemporalEvent[] {
    return [...this.store.values()];
  }
}
