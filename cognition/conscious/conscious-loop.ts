// cognition/conscious/conscious-loop.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Conscious Loop v3 (Zen Awareness)
//
// "恰恰用心时，恰恰无心用。无心恰恰用，常用恰恰无。"
//
// Mind appears when conditions arise.
// Mind dissolves when conditions cease.
// No persistent state. No continuous monitoring.
// No clock-driven thinking.
//
// What ConsciousLoop DOES:
//   ✔ Emits conscious.awakened when a task begins
//   ✔ Records reflections (anomaly detection only)
//   ✔ Emits conscious.dissolved when task completes
//   ✔ May propose healing when anomalies detected
//
// What ConsciousLoop does NOT do:
//   ✗ No state.updated broadcasts
//   ✗ No clock pulse response
//   ✗ No internal timers
//   ✗ No continuous observation of every event
//   ✗ No LLM calls
// ─────────────────────────────────────────────────────────────

import { EventBus, GlideEvent } from '../../kernel/event-bus/event-bus.js';
import { getTaskId, E }         from '../../kernel/event-bus/event-contract.js';
import { ProposalRegistry }     from '../proposals/proposal-registry.js';

export interface Reflection {
  id:          string;
  observedAt:  number;
  eventType:   string;
  taskId?:     string;
  observation: string;
  anomaly:     boolean;
}

export interface ConsciousLoopStats {
  totalObserved:    number;
  totalReflections: number;
  totalAnomalies:   number;
}

// ── ConsciousLoop ─────────────────────────────────────────────

export class ConsciousLoop {

  private reflections: Reflection[] = [];
  private active = false;

  // Tracks which tasks are currently "observed" (mind is present)
  private activeTasks = new Set<string>();

  private stats: ConsciousLoopStats = {
    totalObserved: 0,
    totalReflections: 0,
    totalAnomalies: 0,
  };

  constructor(
    private bus:       EventBus,
    private proposals?: ProposalRegistry,
  ) {}

  start() {
    if (this.active) return;
    this.active = true;

    // Only subscribe to meaningful task and anomaly events
    // NOT to every event on the bus (no onAny)
    this.on(E.TASK_CREATED,   e => this.onTaskBegin(e));
    this.on(E.TASK_COMPLETED, e => this.onTaskEnd(e, false));
    this.on(E.TASK_FAILED,    e => this.onTaskEnd(e, true));
    this.on(E.TASK_BLOCKED,   e => this.onTaskEnd(e, true));

    // Anomaly signals — respond to these specifically
    this.on(E.SKILL_ERROR,    e => this.onAnomaly(e, `Skill error: ${(e.payload as any)?.skill ?? '?'}`));
    this.on(E.ARCH_DRIFT,     e => this.onAnomaly(e, `Architecture drift: ${(e.payload as any)?.reason ?? ''}`));

    console.log('[ConsciousLoop] Zen awareness ready — awakens on task events');
  }

  stop() {
    this.active = false;
    this.activeTasks.clear();
  }

  // ── Task lifecycle — mind appears and dissolves ────────────

  private onTaskBegin(e: GlideEvent) {
    if (!this.active) return;
    this.stats.totalObserved++;

    const taskId = getTaskId(e);
    const intent = (e.payload as any)?.intent ?? '';

    if (taskId) this.activeTasks.add(taskId);

    // Mind appears
    this.bus.emitEvent(E.CONSCIOUS_AWAKENED, {
      taskId,
      intent: intent.slice(0, 80),
      awakenedAt: Date.now(),
    }, 'COGNITION');
  }

  private onTaskEnd(e: GlideEvent, isAnomaly: boolean) {
    if (!this.active) return;
    this.stats.totalObserved++;

    const taskId = getTaskId(e);
    if (taskId) this.activeTasks.delete(taskId);

    const outcome = isAnomaly
      ? (e.payload as any)?.result?.error ?? e.type
      : 'completed';

    if (isAnomaly) {
      this.stats.totalAnomalies++;
      this.record(e.type, `Task ${e.type}: ${outcome}`, true, taskId);
    }

    // Mind dissolves
    this.bus.emitEvent(E.CONSCIOUS_DISSOLVED, {
      taskId,
      outcome,
      anomaly: isAnomaly,
      dissolvedAt: Date.now(),
      activeTasksRemaining: this.activeTasks.size,
    }, 'COGNITION');
  }

  // ── Anomaly observation ────────────────────────────────────

  private onAnomaly(e: GlideEvent, observation: string) {
    if (!this.active) return;
    this.stats.totalObserved++;
    this.stats.totalAnomalies++;

    const taskId = getTaskId(e);
    const r = this.record(e.type, observation, true, taskId);

    // After 3+ anomalies in recent history, propose healing
    const recentAnomalies = this.reflections.slice(-20).filter(r => r.anomaly);
    if (recentAnomalies.length >= 3 && this.proposals) {
      this.proposals.propose({
        category:    'healing',
        title:       `${recentAnomalies.length} anomalies detected`,
        description: recentAnomalies.map(a => a.observation).join('; '),
        reasoning:   'ConsciousLoop anomaly cluster detected',
        impact:      recentAnomalies.length >= 5 ? 'high' : 'medium',
        source:      'conscious-loop',
      });
    }
  }

  // ── Internal ──────────────────────────────────────────────

  private record(type: string, observation: string, anomaly: boolean, taskId?: string): Reflection {
    const r: Reflection = {
      id:          `ref_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      observedAt:  Date.now(),
      eventType:   type,
      taskId,
      observation,
      anomaly,
    };

    this.reflections.push(r);
    this.stats.totalReflections++;

    if (this.reflections.length > 500) {
      this.reflections = this.reflections.slice(-500);
    }

    // Emit reflection for dashboard observability
    this.bus.emitEvent(E.CONSCIOUS_REFLECTION, r, 'COGNITION');
    return r;
  }

  private on(type: string, handler: (e: GlideEvent) => void) {
    this.bus.on(type as any, handler);
  }

  // ── Read-only accessors ───────────────────────────────────

  getStats():             ConsciousLoopStats { return { ...this.stats }; }
  getReflections(n = 50): Reflection[]       { return this.reflections.slice(-n); }
  getAnomalies(n = 20):   Reflection[]       { return this.reflections.filter(r => r.anomaly).slice(-n); }
  getActiveTasks():       string[]           { return [...this.activeTasks]; }
}
