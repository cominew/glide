// kernel/event-types.ts
// 所有事件类型的定义

export type AgentEventType =
  | 'task:start' | 'task:heartbeat' | 'task:end' | 'task:error'
  | 'thinking:start' | 'thinking:token' | 'thinking:end'
  | 'planning:start' | 'planning:end'
  | 'skill:start' | 'skill:progress' | 'skill:end' | 'skill:error'
  | 'aggregation:start' | 'aggregation:end'
  | 'answer:token' | 'answer:end'
  | 'log' | 'metrics'
  | 'reflection';

export interface AgentEvent<T = unknown> {
  id:        string;
  type:      AgentEventType;
  taskId:    string;
  timestamp: number;
  payload:   T;
}

export interface SkillStep {
  skill:  string;
  params: Record<string, unknown>;
}

// 各事件 Payload 类型
export interface TaskStartPayload      { query: string; sessionId: string; }
export interface TaskHeartbeatPayload  { elapsed: number; phase: string; }
export interface TaskEndPayload        { duration: number; usedSkills: string[]; }
export interface TaskErrorPayload      { error: string; phase: string; }
export interface ThinkingStartPayload  { query: string; }
export interface ThinkingTokenPayload  { token: string; }
export interface ThinkingEndPayload    { thinking: string; }
export interface PlanningStartPayload  { query: string; }
export interface PlanningEndPayload    { steps: SkillStep[]; raw: string; }
export interface SkillStartPayload     { skill: string; params: Record<string, unknown>; }
export interface SkillProgressPayload  { skill: string; message: string; }
export interface SkillEndPayload       { skill: string; output: unknown; duration: number; outputType: string; }
export interface SkillErrorPayload     { skill: string; error: string; duration: number; }
export interface AggregationStartPayload { observationCount: number; }
export interface AggregationEndPayload   { summary: string; }
export interface AnswerTokenPayload    { token: string; }
export interface AnswerEndPayload      { answer: string; observations: unknown[]; }
export interface LogPayload            { level: 'info'|'warn'|'error'; message: string; }
export interface MetricsPayload        { phase: string; duration: number; }

export type EmitFn = <T>(type: AgentEventType, payload: T, taskId: string) => void;

export const SYSTEM_EVENTS = {
  TASK_CREATED: 'task.created',
  TASK_STARTED: 'task.started',
  TASK_RESULT: 'task.result',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
};
