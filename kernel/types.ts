// kernel/types.ts
export type TaskStatus  = 'CREATED'|'VALIDATED'|'ROUTED'|'EXECUTING'|'COMPLETED'|'FAILED';
export type RiskLevel   = 'low'|'medium'|'high';
export type TaskSource  = 'goal'|'agent'|'system'|'human';
export type TaskType    = 'skill_execution'|'goal_pursuit'|'reflection'|'memory_write'|'system_check'|'human_request';

export interface Task {
  id: string; type: TaskType; intent: string;
  context: Record<string,any>; status: TaskStatus; source: TaskSource;
  createdAt: number; updatedAt: number;
  metadata: { priority: number; risk: RiskLevel; sessionId?: string; parentId?: string; traceId?: string; };
  policyDecision?: PolicyDecision;
  result?: TaskResult;
}

export interface PolicyDecision {
  allowed: boolean; requiresHumanApproval: boolean;
  reason: string; evaluatedAt: number; constitutionRules?: string[];
}

export interface TaskResult {
  success: boolean; output?: any; error?: string; completedAt: number;
}

export interface MemoryReceipt {
  taskId: string; taskType: TaskType; intent: string;
  result: TaskResult; sessionId?: string; issuedAt: number;
}

export type GlideEventType =
  | 'task.created'|'task.validated'|'task.routed'|'task.executing'
  | 'task.completed'|'task.failed'|'task.blocked'|'task.awaiting_human'
  | 'goal.created'|'goal.completed'|'goal.failed'
  | 'scheduler.tick'|'memory.write'|'memory.read'
  | 'conscious.reflection'|'conscious.anomaly'
  | 'system.boot'|'system.shutdown'|'human.input'|'llm.request'|'llm.response';

export interface GlideEvent<T = any> {
  id: string;
  type: GlideEventType;
  payload: T;
  timestamp: number;
  source?: string;
  taskId?: string;   // ← ADDED: lets SSE handler filter without casting to any
}

export interface SkillContext {
  memory: Record<string,any>; logger: any; llm: any;
  workspace: string; originalQuery: string; sessionId?: string; taskId?: string;
}

export interface Skill {
  name: string; description: string; keywords?: string[];
  execute(input: any, context: SkillContext): Promise<SkillResult>;
}

export interface SkillResult { success: boolean; output?: any; error?: string; }
export interface SkillStep   { skill: string; params: Record<string,any>; }

export type ThinkingType = 'desire'|'ethical'|'routing'|'procedural'|'generative'|'meta'|'experiential'|'physical';
