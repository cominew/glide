// cognition/conscious/conscious-loop.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Conscious Loop
// Thinking type: META — observes and reflects ONLY.
//
// Invariant I4: ConsciousLoop is READ-ONLY.
//   ❌ No routing
//   ❌ No execution
//   ❌ No memory writes
//   ✅ Reads EventBus
//   ✅ Emits reflection events (observations only)
//
// The old implementation held an Orchestrator reference and
// called reflect() — that was a direct I4 violation. Fixed.
// ─────────────────────────────────────────────────────────────

import { GlideEvent, GlideEventType, Task } from '../../kernel/types';
import { EventBus } from '../../kernel/event-bus/event-bus';

export interface Reflection {
  id:          string;
  observedAt:  number;
  eventType:   GlideEventType;
  taskId?:     string;
  observation: string;
  anomaly:     boolean;
}

export interface ConsciousLoopStats {
  totalObserved:    number;
  totalReflections: number;
  totalAnomalies:   number;
  lastTickAt:       number | null;
}

export class ConsciousLoop {

  private reflections: Reflection[] = [];
  private active = false;

  private stats: ConsciousLoopStats = {
    totalObserved:    0,
    totalReflections: 0,
    totalAnomalies:   0,
    lastTickAt:       null,
  };

  // ConsciousLoop only needs EventBus — nothing else.
  constructor(private eventBus: EventBus) {}

  // ── Lifecycle ─────────────────────────────────────────────

  start() {
    if (this.active) return;
    this.active = true;

    // Subscribe to task lifecycle events
    this.observe('task.created',    e => this.onTaskEvent(e, 'Task entered system'));
    this.observe('task.validated',  e => this.onTaskEvent(e, 'Task passed policy gate'));
    this.observe('task.routed',     e => this.onTaskEvent(e, 'Task routed to execution'));
    this.observe('task.executing',  e => this.onTaskEvent(e, 'Task executing'));
    this.observe('task.completed',  e => this.onTaskEvent(e, 'Task completed successfully'));
    this.observe('task.failed',     e => this.onTaskAnomalyEvent(e, 'Task failed'));
    this.observe('task.blocked',    e => this.onTaskAnomalyEvent(e, 'Task blocked by policy'));
    this.observe('task.awaiting_human', e => this.onTaskEvent(e, 'Task awaiting human approval'));
    this.observe('conscious.anomaly',   e => this.onRawEvent(e, true));

    console.log('[ConsciousLoop] Started — observing EventBus');
  }

  stop() {
    this.active = false;
    console.log('[ConsciousLoop] Stopped');
  }

  // ── Tick (called by Scheduler) ────────────────────────────
  // Runs periodic self-reflection over recent observations.
  // Does NOT call any other module. Returns a reflection summary.

  tick(): Reflection | null {
    this.stats.lastTickAt = Date.now();

    const recent = this.reflections.slice(-20);
    const anomalies = recent.filter(r => r.anomaly);

    if (anomalies.length === 0) return null;

    const reflection = this.makeReflection(
      'scheduler.tick',
      `Periodic check: ${anomalies.length} anomalies in last ${recent.length} observations`,
      anomalies.length > 0,
    );

    // Emit as observation event — NOT a task, NOT a route
    this.eventBus.emit('conscious.reflection', {
      id:        reflection.id,
      type:      'conscious.reflection',
      payload:   reflection,
      timestamp: Date.now(),
      source:    'conscious-loop',
    });

    return reflection;
  }

  // ── Observation helpers ───────────────────────────────────

  private observe(type: GlideEventType, handler: (e: GlideEvent) => void) {
    this.eventBus.on(type, handler);
  }

  private onTaskEvent(event: GlideEvent<Task>, observation: string) {
    this.stats.totalObserved++;
    const task = event.payload as Task;
    this.record(event.type, observation, false, task?.id);
  }

  private onTaskAnomalyEvent(event: GlideEvent<Task>, observation: string) {
    this.stats.totalObserved++;
    this.stats.totalAnomalies++;
    const task = event.payload as Task;
    const reason = task?.policyDecision?.reason ?? task?.result?.error ?? '';
    this.record(
      event.type,
      `${observation}${reason ? `: ${reason}` : ''}`,
      true,
      task?.id,
    );
  }

  private onRawEvent(event: GlideEvent, isAnomaly: boolean) {
    this.stats.totalObserved++;
    if (isAnomaly) this.stats.totalAnomalies++;
    this.record(event.type, JSON.stringify(event.payload).slice(0, 120), isAnomaly);
  }

  private record(
    eventType: GlideEventType,
    observation: string,
    anomaly: boolean,
    taskId?: string,
  ): Reflection {
    const r = this.makeReflection(eventType, observation, anomaly, taskId);
    this.reflections.push(r);
    this.stats.totalReflections++;

    if (anomaly) {
      console.warn(`[ConsciousLoop] ⚠️  Anomaly observed: ${observation}`);
    }

    // Keep last 500 reflections
    if (this.reflections.length > 500) {
      this.reflections = this.reflections.slice(-500);
    }

    return r;
  }

  private makeReflection(
    eventType: GlideEventType,
    observation: string,
    anomaly: boolean,
    taskId?: string,
  ): Reflection {
    return {
      id:          `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      observedAt:  Date.now(),
      eventType,
      taskId,
      observation,
      anomaly,
    };
  }

  // ── Read-only accessors ───────────────────────────────────

  getReflections(limit = 50): Reflection[] {
    return this.reflections.slice(-limit);
  }

  getAnomalies(limit = 20): Reflection[] {
    return this.reflections.filter(r => r.anomaly).slice(-limit);
  }

  getStats(): ConsciousLoopStats {
    return { ...this.stats };
  }
}
