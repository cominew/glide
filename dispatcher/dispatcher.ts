// dispatcher/dispatcher.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Dispatcher
// Thinking type: ROUTING — routes tasks ONLY.
// The single authority entry point. No reasoning, no execution,
// no memory access. Just: validate → gate → route.
//
// Invariant I2: Policy ALWAYS runs before routing.   
// ─────────────────────────────────────────────────────────────
// Note: Dispatcher is NOT responsible for emitting the initial "task.created" event.
// That event is emitted by the GoalEngine or Agent that creates the Task.
// Dispatcher only emits events for its internal state transitions (validated, blocked, etc).

import { Task, GlideEventType } from '../kernel/types';
import { transitionTask, failTask } from '../runtime/tasks/task';
import { PolicyEngine }  from '../governance/policy-engine';
import { HumanGate }     from './human-gate';
import { TaskRouter }    from './task-router';
import { GlideEvent, EventBus }      from '../kernel/event-bus/event-bus';
import { E }    from '../kernel/event-bus/event-contract';

export class Dispatcher {

  constructor(
    private policyEngine: PolicyEngine,
    private humanGate:    HumanGate,
    private taskRouter:   TaskRouter,
    private eventBus:     EventBus,
  ) {}

  // ── Primary dispatch ──────────────────────────────────────
  // Called when a new Task arrives (from GoalEngine, Agent, etc).
  // Returns the Task in its final post-dispatch state.

  async dispatch(task: Task): Promise<Task> {

    console.log(`[Dispatcher] Received task: ${task.id} "${task.intent}"`);

    // ── Step 1: Policy evaluation (I2 — must come first) ────
    const decision = await this.policyEngine.evaluate(task);

    let validated: Task = {
      ...transitionTask(task, 'VALIDATED'),
      policyDecision: decision,
    };

    this.emit(E.TASK_VALIDATED, validated);

    // ── Step 2: Block if policy denied ──────────────────────
    if (!decision.allowed) {
      const blocked = failTask(
        validated,
        `Policy blocked: ${decision.reason}`
      );
      this.emit(E.TASK_BLOCKED, blocked);
      console.warn(`[Dispatcher] Task blocked: ${task.id}`);
      return blocked;
    }

    // ── Step 3: Human gate ───────────────────────────────────
    if (decision.requiresHumanApproval) {
      this.emit(E.TASK_AWAITING_HUMAN, validated);
      const pending = await this.humanGate.request(validated);

      if (!pending.approved) {
        
        const rejected = failTask(
          validated,
          `Human gate rejected: ${pending.reason}`
        );
        this.emit(E.TASK_REJECTED, rejected);
        console.warn(`[Dispatcher] Human gate rejected: ${task.id}`);
        return rejected;
      }

      console.log(`[Dispatcher] Human approved task: ${task.id}`);
    }

    // ── Step 4: Route ────────────────────────────────────────
    const route  = this.taskRouter.resolve(validated);
    const routed = transitionTask(validated, 'ROUTED');

    this.emit(E.TASK_ROUTED, routed);

    console.log(
      `[Dispatcher] Routed task ${task.id} → ${route.destination}`
    );

    // ── Step 5: Hand off to execution layer via EventBus ─────
    // Dispatcher's job ends here. It does NOT call the executor.
    this.eventBus.emit(route.eventType, {
      id:        this.makeEventId(),
      type:      route.eventType,
      payload:   routed,
      timestamp: Date.now(),
      source:    'dispatcher',
    });

    return routed;
  }

  // ── Internal helpers ──────────────────────────────────────

  private emit(type: GlideEventType, task: Task) {
    this.eventBus.emit(type, {
      id:        this.makeEventId(),
      type,
      payload:   task,
      timestamp: Date.now(),
      source:    'dispatcher',
    });
  }

  private makeEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

