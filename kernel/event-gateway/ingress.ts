// kernel/event-gateway/ingress.ts
// ─────────────────────────────────────────────
// Glide OS — Dispatcher (v4 stripped)
// ─────────────────────────────────────────────

import { Task } from '../../kernel/types';
import { PolicyEngine } from '../../governance/policy-engine';
import { EventBus } from '../../kernel/event-bus/event-bus';
import { E } from '../../kernel/event-bus/event-contract';

export class Dispatcher {

  constructor(
    private policyEngine: PolicyEngine,
    private eventBus: EventBus,
    private humanGate?: any, // optional external gate
  ) {}

  async dispatch(task: Task): Promise<Task> {

    console.log(`[Dispatcher] task: ${task.id}`);

    // ── 1. Policy Gate ─────────────────────────────
    const decision = await this.policyEngine.evaluate(task);

    if (!decision.allowed) {
      this.eventBus.emitEvent(E.TASK_BLOCKED, {
        taskId: task.id,
        reason: decision.reason,
      }, 'DISPATCHER', task.id);

      return task;
    }

    // ── 2. Human Gate (optional external system) ───
    if (decision.requiresHumanApproval && this.humanGate) {

      this.eventBus.emitEvent(E.TASK_AWAITING_HUMAN, {
        taskId: task.id,
      }, 'DISPATCHER', task.id);

      const result = await this.humanGate.request(task);

      if (!result.approved) {
        this.eventBus.emitEvent(E.TASK_REJECTED, {
          taskId: task.id,
          reason: result.reason,
        }, 'DISPATCHER', task.id);

        return task;
      }
    }

    // ── 3. ONLY OUTPUT OF DISPATCHER ──────────────
    this.eventBus.emitEvent(E.TASK_ROUTED, {
      taskId: task.id,
      intent: task.intent,
    }, 'DISPATCHER', task.id);

    return task;
  }
}