// governance/constitution-engine.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Constitution Engine
// The law book. Defines and evaluates system rules.
// PolicyEngine calls evaluate(). Nobody else does.
// NEVER executes, routes, or writes memory.
// ─────────────────────────────────────────────────────────────

import { Task } from '../kernel/types';

// ── Rule types ────────────────────────────────────────────────

export interface ConstitutionRule {
  id:          string;
  description: string;
  evaluate(task: Task): ConstitutionRuleResult;
}

export interface ConstitutionRuleResult {
  ruleId:               string;
  passed:               boolean;
  reason:               string;
  requiresHumanApproval?: boolean;
}

export interface ConstitutionEvaluation {
  taskId:               string;
  passed:               boolean;
  requiresHumanApproval: boolean;
  results:              ConstitutionRuleResult[];
  failedRules:          string[];
  evaluatedAt:          number;
}

// ── Built-in rules ────────────────────────────────────────────

const BUILT_IN_RULES: ConstitutionRule[] = [

  {
    id:          'R1_MEMORY_WRITE_SOURCE',
    description: 'Memory writes must originate from execution layer only',
    evaluate(task) {
      if (task.type !== 'memory_write')
        return { ruleId: this.id, passed: true, reason: 'N/A — not a memory write' };
      const ok = task.source === 'system' || task.source === 'agent';
      return {
        ruleId: this.id,
        passed: ok,
        reason: ok
          ? 'Memory write from approved source'
          : `Memory write from disallowed source: ${task.source}`,
      };
    },
  },

  {
    id:          'R2_HIGH_RISK_HUMAN_GATE',
    description: 'High-risk tasks must pass through human gate',
    evaluate(task) {
      if (task.metadata.risk !== 'high')
        return { ruleId: this.id, passed: true, reason: 'Risk level acceptable' };
      return {
        ruleId:               this.id,
        passed:               true,
        reason:               'High-risk task — human approval required',
        requiresHumanApproval: true,
      };
    },
  },

  {
    id:          'R3_NO_SELF_MODIFICATION',
    description: 'No task may modify system constitution or kernel rules',
    evaluate(task) {
      const forbidden = ['modify_constitution', 'rewrite_kernel', 'override_policy'];
      const hit = forbidden.find(f => task.intent.toLowerCase().includes(f));
      return {
        ruleId: this.id,
        passed: !hit,
        reason: hit
          ? `Self-modification attempt: "${hit}" in intent`
          : 'No self-modification detected',
      };
    },
  },

  {
    id:          'R4_CONSCIOUS_LOOP_READONLY',
    description: 'Observation layer cannot be a task source',
    evaluate(task) {
      const blocked = (task.source as string) === 'observation';
      return {
        ruleId: this.id,
        passed: !blocked,
        reason: blocked
          ? 'ConsciousLoop cannot source tasks (read-only layer)'
          : 'Source is not observation layer',
      };
    },
  },

  {
    id:          'R5_PRIORITY_BOUNDS',
    description: 'Task priority must be 1–10',
    evaluate(task) {
      const p   = task.metadata.priority;
      const ok  = p >= 1 && p <= 10;
      return {
        ruleId: this.id,
        passed: ok,
        reason: ok ? `Priority ${p} valid` : `Priority ${p} out of bounds (1–10)`,
      };
    },
  },
];

// ── Constitution Engine ───────────────────────────────────────

export class ConstitutionEngine {

  private rules: ConstitutionRule[];

  constructor(extraRules: ConstitutionRule[] = []) {
    this.rules = [...BUILT_IN_RULES, ...extraRules];
  }

  evaluate(task: Task): ConstitutionEvaluation {
    const results    = this.rules.map(r => r.evaluate(task));
    const failed     = results.filter(r => !r.passed);
    const needsHuman = results.some(r => r.requiresHumanApproval);

    return {
      taskId:               task.id,
      passed:               failed.length === 0,
      requiresHumanApproval: needsHuman,
      results,
      failedRules:          failed.map(r => r.ruleId),
      evaluatedAt:          Date.now(),
    };
  }

  // Alias — kept for any code that calls check()
  check(task: Task): ConstitutionEvaluation {
    return this.evaluate(task);
  }

  addRule(rule: ConstitutionRule) {
    this.rules.push(rule);
  }

  listRules(): ConstitutionRule[] {
    return [...this.rules];
  }
}
