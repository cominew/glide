// governance/policy-engine.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Policy Engine
// Thinking type: ETHICAL — evaluates permission ONLY.
// Input:  Task  →  Output: PolicyDecision
//
// NO Dispatcher import. NO circular dependency.
// ─────────────────────────────────────────────────────────────

import { Task, PolicyDecision } from '../kernel/types';
import { ConstitutionRule }   from './constitution-engine';

function evaluateConstitution(rules: ConstitutionRule[], task: Task) {

  const results = rules.map(rule => {
    const r = rule.evaluate(task);

    return {
      ruleId: r.ruleId,
      passed: r.passed,
      reason: r.reason,
      requiresHumanApproval: r.requiresHumanApproval,
    };
  });

  const failedRules = results.filter(r => !r.passed).map(r => r.ruleId);

  return {
    passed: failedRules.length === 0,
    failedRules,
    results,
    requiresHumanApproval: results.some(r => r.requiresHumanApproval),
    evaluatedAt: Date.now(),
  };
}

export class PolicyEngine {

  constructor(private rules: ConstitutionRule[]) {}

  async evaluate(task: Task): Promise<PolicyDecision> {

    console.log(`[PolicyEngine] Evaluating: ${task.id} "${task.intent}"`);

    const ev = evaluateConstitution(this.rules, task);

    return {
      allowed: ev.passed,
      requiresHumanApproval: ev.requiresHumanApproval,
      reason: ev.passed
        ? 'All constitution rules passed'
        : `Blocked by [${ev.failedRules.join(', ')}]`,
      evaluatedAt: ev.evaluatedAt,
      constitutionRules: ev.results.map(r => r.ruleId),
    };
  }
}