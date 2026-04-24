// cognition/reflection/reflection.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — reflection (Zen Awareness)
//
// "恰恰用心时，恰恰无心用。无心恰恰用，常用恰恰无。"
//
// Mind appears when task begins. Mind dissolves when task ends.
// No continuous cognition. No state broadcasts. No clock-driven awakening.
//
// Constitution v2 compliance:
//   ✓ Article III: no continuous cognition
//   ✓ Article VI: time does not awaken
//   ✓ Article VII: arises from events, ceases when conditions cease
//   ✓ Silence Principle: no periodic existence signals
//
// Subscriptions (exactly 6 — no onAny):
//   task.created        → conscious.awakened
//   task.completed      → conscious.dissolved
//   task.failed         → conscious.dissolved (anomaly)
//   task.blocked        → conscious.dissolved (anomaly)
//   skill.error         → anomaly observation
//   system.architecture.drift → anomaly observation
// ─────────────────────────────────────────────────────────────

import { EventBus}                          from '../../kernel/event-bus/event-bus';
import { getTaskId, GlideEvent, E }         from '../../kernel/event-bus/event-contract';
import { ProposalRegistry }                 from '../proposals/proposal-registry';

export interface Reflection {
  id: string;
  observedAt: number;
  eventType: string;
  taskId?: string;
  observation: string;
  anomaly: boolean;
};

export interface ConsciousLoopStats {
  totalObserved:    number;
  totalReflections: number;
  totalAnomalies:   number;
}

export class ConsciousLoop {

  private reflections: Reflection[] = [];
  private activeTasks = new Set<string>();
  private active = false;

  private stats: ConsciousLoopStats = {
    totalObserved: 0, totalReflections: 0, totalAnomalies: 0,
  };

  constructor(
    private bus:       EventBus,
    private proposals?: ProposalRegistry,
  ) {}

  start() {
    if (this.active) return;
    this.active = true;

    // Six precise subscriptions — no onAny()
    this.on(E.TASK_CREATED,   e => this.onTaskBegin(e));
    this.on(E.TASK_COMPLETED, e => this.onTaskEnd(e, false));
    this.on(E.TASK_FAILED,    e => this.onTaskEnd(e, true));
    this.on(E.TASK_BLOCKED,   e => this.onTaskEnd(e, true));
    this.on(E.SKILL_ERROR,    e => this.onAnomaly(e, `Skill error: ${(e.payload as any)?.skill ?? '?'}`));
    this.on(E.ARCH_DRIFT,     e => this.onAnomaly(e, `Architecture drift: ${(e.payload as any)?.reason ?? ''}`));

    console.log('[ConsciousLoop] Zen awareness ready — awakens on task events');
  }

  stop() {
    this.active = false;
    this.activeTasks.clear();
  }

  // ── Task lifecycle ────────────────────────────────────────

  private onTaskBegin(e: GlideEvent) {
    if (!this.active) return;
    this.stats.totalObserved++;
    const taskId = getTaskId(e);
    const intent = (e.payload as any)?.intent ?? '';
    if (taskId) this.activeTasks.add(taskId);

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
      ? (e.payload as any)?.error ?? (e.payload as any)?.result?.error ?? e.type
      : 'completed';

    if (isAnomaly) {
      this.stats.totalAnomalies++;
      this.record(e.type, `Task ${e.type}: ${outcome}`, true, taskId);
    }

    this.bus.emitEvent(E.CONSCIOUS_DISSOLVED, {
      taskId,
      outcome,
      anomaly: isAnomaly,
      dissolvedAt: Date.now(),
      activeTasksRemaining: this.activeTasks.size,
    }, 'COGNITION');
  }

  // ── Anomaly observation ───────────────────────────────────

  private onAnomaly(e: GlideEvent, observation: string) {
    if (!this.active) return;
    this.stats.totalObserved++;
    this.stats.totalAnomalies++;
    const taskId = getTaskId(e);
    this.record(e.type, observation, true, taskId);

    const recent = this.reflections.slice(-20).filter(r => r.anomaly);
    if (recent.length >= 3 && this.proposals) {
      this.proposals.propose({
        category:    'healing',
        title:       `${recent.length} anomalies detected`,
        description: recent.map(r => r.observation).join('; '),
        reasoning:   'ConsciousLoop anomaly threshold reached',
        impact:      recent.length >= 5 ? 'high' : 'medium',
        source: 'COGNITION_OBSERVER'
      });
    }
  }

  // ── Reflection recording ──────────────────────────────────

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
    if (this.reflections.length > 500) this.reflections = this.reflections.slice(-500);

    this.bus.emitEvent(E.CONSCIOUS_REFLECTION, r, 'COGNITION');
    return r;
  }

  private on(type: string, handler: (e: GlideEvent) => void) {
    this.bus.on(type as any, handler);
  }

  // ── Read-only API ─────────────────────────────────────────

  getStats():             ConsciousLoopStats { return { ...this.stats }; }
  getReflections(n = 50): Reflection[]       { return this.reflections.slice(-n); }
  getAnomalies(n = 20):   Reflection[]       { return this.reflections.filter(r => r.anomaly).slice(-n); }
  getActiveTasks():       string[]           { return [...this.activeTasks]; }
}