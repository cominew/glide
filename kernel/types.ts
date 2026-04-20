// kernel/types.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Domain Type Definitions
//
// This file defines DOMAIN objects only:
//   Task, PolicyDecision, TaskResult, MemoryReceipt
//   Skill, SkillContext, SkillResult, SkillStep
//
// GlideEvent and EventSource live in event-contract.ts.
// ConsciousPhase lives in event-contract.ts.
// Do NOT redefine them here.
// ─────────────────────────────────────────────────────────────

// Re-export event contract types so old imports still work
export { GlideEvent, EventSource, ConsciousPhase, E, getTaskId }
  from './event-bus/event-contract.js';

// ── Task domain ───────────────────────────────────────────────

export type TaskStatus =
  | 'CREATED' | 'VALIDATED' | 'ROUTED'
  | 'EXECUTING' | 'COMPLETED' | 'FAILED';

export type RiskLevel  = 'low' | 'medium' | 'high';
export type TaskSource = 'goal' | 'agent' | 'system' | 'human';

export type TaskType =
  | 'skill_execution' | 'goal_pursuit' | 'reflection'
  | 'memory_write' | 'system_check' | 'human_request';

export interface Task {
  id:        string;
  type:      TaskType;
  intent:    string;
  context:   Record<string, any>;
  status:    TaskStatus;
  source:    TaskSource;
  createdAt: number;
  updatedAt: number;
  metadata: {
    priority:   number;
    risk:       RiskLevel;
    sessionId?: string;
    parentId?:  string;
    traceId?:   string;
  };
  policyDecision?: PolicyDecision;
  result?: TaskResult;
}

export interface PolicyDecision {
  allowed:               boolean;
  requiresHumanApproval: boolean;
  reason:                string;
  evaluatedAt:           number;
  constitutionRules?:    string[];
}

export interface TaskResult {
  success:     boolean;
  output?:     any;
  error?:      string;
  completedAt: number;
}

export interface MemoryReceipt {
  taskId:    string;
  taskType:  TaskType;
  intent:    string;
  result:    TaskResult;
  sessionId?: string;
  issuedAt:  number;
}

// ── Skill domain ──────────────────────────────────────────────

export interface SkillContext {
  memory:        Record<string, any>;
  logger:        any;
  llm:           any;
  workspace:     string;
  originalQuery: string;
  sessionId?:    string;
  taskId?:       string;
}

export interface Skill {
  name:        string;
  description: string;
  keywords?:   string[];
  execute(input: any, context: SkillContext): Promise<SkillResult>;
}

export interface SkillResult {
  success: boolean;
  output?: any;
  error?:  string;
}

export interface SkillStep {
  skill:  string;
  params: Record<string, any>;
}

// ── Legacy GlideEventType (for any code still using it) ───────
// This is the old union type — kept for backward compat only.
// New code should use E.* constants from event-contract.ts.
export type GlideEventType = string;
