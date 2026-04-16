// cognition/conscious/conscious-loop.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Conscious Loop
// Layer: COGNITION — observes, reflects, proposes. Never executes.
//
// Implements The Silence Law:
//   IDLE → INTENT → THINK → REFLECT → IDLE
//
// ConsciousLoop produces PROPOSALS, not TASKS.
// Proposals go to ProposalRegistry (superposition).
// They become real only when a human approves them.
//
// Invariant I4: read-only observer.
//   ✗ No routing
//   ✗ No execution
//   ✗ No memory writes
//   ✗ No heartbeat tasks that bypass policy
//   ✓ Reads EventBus
//   ✓ Emits conscious.* events (observation only)
//   ✓ Creates proposals via ProposalRegistry
// ─────────────────────────────────────────────────────────────

import { EventBus, GlideEvent } from '../../kernel/event-bus/event-bus.js';
import { ProposalRegistry }     from '../proposals/proposal-registry.js';

// ── Conscious state ───────────────────────────────────────────

export type ConsciousPhase =
  | 'idle'
  | 'receiving'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'reflecting'
  | 'waiting_human';

export interface ConsciousState {
  focus:         string;
  thought:       string;
  activeGoal:    string | null;
  cognitiveLoad: number;
  phase:         ConsciousPhase;
  updatedAt:     number;
}

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
  lastTickAt:       number | null;
}

// ── ConsciousLoop ─────────────────────────────────────────────

export class ConsciousLoop {

  private reflections: Reflection[] = [];
  private active = false;

  private state: ConsciousState = {
    focus:         'System idle',
    thought:       '',
    activeGoal:    null,
    cognitiveLoad: 0,
    phase:         'idle',
    updatedAt:     Date.now(),
  };

  private stats: ConsciousLoopStats = {
    totalObserved:    0,
    totalReflections: 0,
    totalAnomalies:   0,
    lastTickAt:       null,
  };

  constructor(
    private bus:      EventBus,
    private proposals?: ProposalRegistry,
  ) {}

  start() {
    if (this.active) return;
    this.active = true;

    // Task lifecycle — observation only
    this.on('task.created',          e => this.onTaskCreated(e));
    this.on('task.validated',         e => this.onPhaseChange(e, 'receiving', 'Evaluating task against policy'));
    this.on('task.routed',            e => this.onPhaseChange(e, 'planning',  'Routing to execution layer'));
    this.on('task.executing',         e => this.onPhaseChange(e, 'executing', 'Executing task'));
    this.on('task.completed',         e => this.onTaskCompleted(e));
    this.on('task.failed',            e => this.onAnomaly(e, 'Task failed'));
    this.on('task.blocked',           e => this.onAnomaly(e, 'Task blocked by policy'));
    this.on('task.awaiting_human',    e => this.onAwaitingHuman(e));

    // Cognitive pipeline — observation only
    this.on('thinking.start',         () => this.updateState({ phase:'thinking', thought:'Reasoning...', cognitiveLoad:0.7 }));
    this.on('thinking.end',           e => this.onThinkingEnd(e));
    this.on('planning.end',           e => this.onPlanningEnd(e));
    this.on('skill.start',            e => this.onSkillStart(e));
    this.on('skill.end',              e => this.onSkillEnd(e));
    this.on('skill.error',            e => this.onAnomaly(e, 'Skill execution failed'));

    // Proposals collapsed into reality
    this.on('proposal.approved',      e => this.record(e.type, `Proposal approved: ${e.payload?.title}`, false));

    console.log('[ConsciousLoop] Started — observing EventBus');
  }

  stop() { this.active = false; }

  // ── Scheduler tick ────────────────────────────────────────
  // Periodic reflection. May generate proposals.
  // Does NOT create tasks or emit execution events.

  tick(): Reflection | null {
    this.stats.lastTickAt = Date.now();

    // Idle drift
    const idleMs = Date.now() - this.state.updatedAt;
    if (idleMs > 15_000 && this.state.phase !== 'idle') {
      this.updateState({ phase:'idle', focus:'System idle', thought:'', cognitiveLoad:0 });
    }

    const recent   = this.reflections.slice(-20);
    const anomalies = recent.filter(r => r.anomaly);

    // If many anomalies, PROPOSE (not execute) a health check
    if (anomalies.length >= 3 && this.proposals) {
      this.proposals.propose({
        category:    'healing',
        title:       `${anomalies.length} anomalies detected — health review suggested`,
        description: `ConsciousLoop observed ${anomalies.length} anomalies in the last ${recent.length} events`,
        reasoning:   anomalies.map(a => a.observation).join('; '),
        impact:      anomalies.length >= 5 ? 'high' : 'medium',
        source:      'conscious-loop',
      });
    }

    if (anomalies.length === 0) return null;

    return this.record(
      'scheduler.tick',
      `Periodic check: ${anomalies.length} anomalies in ${recent.length} events`,
      anomalies.length > 0,
    );
  }

  // ── Observation handlers ──────────────────────────────────

  private onTaskCreated(e: GlideEvent) {
    this.stats.totalObserved++;
    const task = e.payload;
    this.updateState({
      phase:         'receiving',
      focus:         (task?.intent ?? 'New task').slice(0, 80),
      thought:       'Received new task — evaluating...',
      activeGoal:    task?.intent ?? null,
      cognitiveLoad: Math.min(this.state.cognitiveLoad + 0.3, 1),
    });
    this.record(e.type, `Received: "${(task?.intent ?? '').slice(0,60)}"`, false, task?.id ?? e.trace?.taskId);
  }

  private onPhaseChange(e: GlideEvent, phase: ConsciousPhase, thought: string) {
    this.stats.totalObserved++;
    this.updateState({ phase, thought, cognitiveLoad: Math.min(this.state.cognitiveLoad + 0.1, 1) });
    this.record(e.type, thought, false, e.trace?.taskId);
  }

  private onTaskCompleted(e: GlideEvent) {
    this.stats.totalObserved++;
    this.updateState({
      phase:         'reflecting',
      thought:       'Task complete — consolidating results',
      cognitiveLoad: Math.max(this.state.cognitiveLoad - 0.4, 0),
    });
    this.record(e.type, 'Task completed', false, e.trace?.taskId);

    // Auto-return to IDLE (The Silence Law)
    setTimeout(() => {
      if (this.state.phase === 'reflecting') {
        this.updateState({ phase:'idle', focus:'System idle', thought:'', cognitiveLoad:0, activeGoal:null });
      }
    }, 4000);
  }

  private onAnomaly(e: GlideEvent, label: string) {
    this.stats.totalObserved++;
    this.stats.totalAnomalies++;
    const reason = e.payload?.policyDecision?.reason ?? e.payload?.error ?? e.payload?.reason ?? '';
    const obs    = `${label}${reason ? ': '+reason : ''}`;
    this.updateState({ thought: obs, cognitiveLoad: Math.max(this.state.cognitiveLoad - 0.2, 0) });
    this.record(e.type, obs, true, e.trace?.taskId);
  }

  private onAwaitingHuman(e: GlideEvent) {
    this.stats.totalObserved++;
    this.updateState({
      phase:   'waiting_human',
      thought: 'Paused — awaiting human decision',
      focus:   (e.payload?.intent ?? 'Awaiting human').slice(0, 80),
    });
    this.record(e.type, 'Waiting for human approval', false, e.trace?.taskId);
  }

  private onThinkingEnd(e: GlideEvent) {
    this.stats.totalObserved++;
    const t = e.payload?.thinking ?? '';
    this.updateState({ phase:'planning', thought: t.slice(0,120) || 'Thinking complete', cognitiveLoad:0.6 });
    if (t) this.record(e.type, t.slice(0,80), false, e.trace?.taskId);
  }

  private onPlanningEnd(e: GlideEvent) {
    this.stats.totalObserved++;
    const skills = (e.payload?.steps ?? []).map((s: any) => s.skill).join(', ');
    this.updateState({ phase:'executing', thought: skills ? `Plan: ${skills}` : 'Direct generation', cognitiveLoad:0.8 });
  }

  private onSkillStart(e: GlideEvent) {
    this.stats.totalObserved++;
    this.updateState({ phase:'executing', thought:`Executing: ${e.payload?.skill ?? '?'}`, cognitiveLoad:0.9 });
  }

  private onSkillEnd(e: GlideEvent) {
    this.stats.totalObserved++;
    this.updateState({ thought:`${e.payload?.skill ?? '?'} complete`, cognitiveLoad: Math.max(this.state.cognitiveLoad-0.1, 0.5) });
  }

  // ── State management ──────────────────────────────────────

  private updateState(partial: Partial<ConsciousState>) {
    this.state = { ...this.state, ...partial, updatedAt: Date.now() };

    // Emit state update for Dashboard (observation, not execution)
    this.bus.emitEvent('conscious.state.updated', { ...this.state }, 'COGNITION');
  }

  // ── Reflection record ─────────────────────────────────────

  private record(type: string, observation: string, anomaly: boolean, taskId?: string): Reflection {
    const r: Reflection = {
      id:          `ref_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      observedAt:  Date.now(),
      eventType:   type,
      taskId,
      observation,
      anomaly,
    };

    this.reflections.push(r);
    this.stats.totalReflections++;
    if (anomaly) console.warn(`[ConsciousLoop] ⚠ ${observation}`);
    if (this.reflections.length > 500) this.reflections = this.reflections.slice(-500);

    this.bus.emitEvent('conscious.reflection', r, 'COGNITION');
    return r;
  }

  private on(type: string, handler: (e: GlideEvent) => void) {
    this.bus.on(type as any, handler);
  }

  // ── Read-only accessors ───────────────────────────────────

  getState():       ConsciousState     { return { ...this.state }; }
  getStats():       ConsciousLoopStats { return { ...this.stats }; }
  getReflections(n = 50): Reflection[] { return this.reflections.slice(-n); }
  getAnomalies(n = 20):   Reflection[] { return this.reflections.filter(r => r.anomaly).slice(-n); }
}
