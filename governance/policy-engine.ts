// governance/policy-engine.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Policy Engine
// Thinking type: ETHICAL — evaluates permission ONLY.
// Input:  Task  →  Output: PolicyDecision
//
// NO Dispatcher import. NO circular dependency.
// ─────────────────────────────────────────────────────────────

import { Task, PolicyDecision } from '../kernel/types';
import { ConstitutionEngine }   from './constitution-engine';

export class PolicyEngine {

  constructor(private constitution: ConstitutionEngine) {}

  async evaluate(task: Task): Promise<PolicyDecision> {

    console.log(`[PolicyEngine] Evaluating: ${task.id} "${task.intent}"`);

    const ev = this.constitution.evaluate(task);

    const decision: PolicyDecision = {
      allowed:               ev.passed,
      requiresHumanApproval: ev.requiresHumanApproval,
      reason:                ev.passed
        ? 'All constitution rules passed'
        : `Blocked by [${ev.failedRules.join(', ')}]: ${
            ev.results
              .filter(r => ev.failedRules.includes(r.ruleId))
              .map(r => r.reason)
              .join('; ')
          }`,
      evaluatedAt:       ev.evaluatedAt,
      constitutionRules: ev.results.map(r => r.ruleId),
    };

    if (!decision.allowed)               console.warn(`[PolicyEngine] BLOCKED  ${task.id}: ${decision.reason}`);
    else if (decision.requiresHumanApproval) console.log(`[PolicyEngine] HUMAN GATE ${task.id}`);
    else                                 console.log(`[PolicyEngine] ALLOWED  ${task.id}`);

    return decision;
  }
}
