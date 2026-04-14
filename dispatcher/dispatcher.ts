// dispatcher/dispatcher.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Dispatcher
// Thinking type: ROUTING — routes tasks ONLY.
// The single authority entry point. No reasoning, no execution,
// no memory access. Just: validate → gate → route.
//
// Invariant I2: Policy ALWAYS runs before routing.
// ─────────────────────────────────────────────────────────────

import { Task, GlideEvent, GlideEventType } from '../kernel/types';
import { transitionTask, failTask } from '../runtime/tasks/task';
import { PolicyEngine }  from '../governance/policy-engine';
import { HumanGate }     from './human-gate';
import { TaskRouter }    from './task-router';
import { EventBus }      from '../kernel/event-bus/event-bus';

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

    this.emit('task.validated', validated);

    // ── Step 2: Block if policy denied ──────────────────────
    if (!decision.allowed) {
      const blocked = failTask(
        validated,
        `Policy blocked: ${decision.reason}`
      );
      this.emit('task.blocked', blocked);
      this.emit('task.failed',  blocked);
      console.warn(`[Dispatcher] Task blocked: ${task.id}`);
      return blocked;
    }

    // ── Step 3: Human gate ───────────────────────────────────
    if (decision.requiresHumanApproval) {
      const pending = await this.humanGate.request(validated);

      if (!pending.approved) {
        const rejected = failTask(
          validated,
          `Human gate rejected: ${pending.reason}`
        );
        this.emit('task.failed', rejected);
        console.warn(`[Dispatcher] Human gate rejected: ${task.id}`);
        return rejected;
      }

      console.log(`[Dispatcher] Human approved task: ${task.id}`);
    }

    // ── Step 4: Route ────────────────────────────────────────
    const route  = this.taskRouter.resolve(validated);
    const routed = transitionTask(validated, 'ROUTED');

    this.emit('task.routed', routed);

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

