// kernel/event-bus/event-types.ts
// ─────────────────────────────────────────────────────────────
// L0 — Event type registry + source constants
// ─────────────────────────────────────────────────────────────

// ── Event source constants ────────────────────────────────────
// Used by ArchitectureGuardian to verify source integrity.

export const EVENT_SOURCES = {
  UI:           'UI',
  SYSTEM:       'SYSTEM',
  BOOTSTRAP:    'BOOTSTRAP',
  DISPATCHER:   'DISPATCHER',
  ORCHESTRATOR: 'ORCHESTRATOR',
  CONSCIOUS:    'CONSCIOUS',
  HUMAN:        'HUMAN',
  SCHEDULER:    'SCHEDULER',
  MEMORY:       'MEMORY',
  REFLECTION:   'REFLECTION',
  RUNTIME:      'RUNTIME',
  KERNEL:       'KERNEL',
  COGNITION:    'COGNITION',
  GUARDIAN:     'GUARDIAN',
} as const;

export type EventSourceKey = keyof typeof EVENT_SOURCES;

// ── Task lifecycle ────────────────────────────────────────────

export const TASK_EVENTS = {
  CREATED:        'task.created',
  VALIDATED:      'task.validated',
  ROUTED:         'task.routed',
  STARTED:        'task.started',
  EXECUTING:      'task.executing',
  COMPLETED:      'task.completed',
  FAILED:         'task.failed',
  BLOCKED:        'task.blocked',
  AWAITING_HUMAN: 'task.awaiting_human',
  HEARTBEAT:      'task.heartbeat',
} as const;

// ── Cognitive pipeline ────────────────────────────────────────

export const COGNITIVE_EVENTS = {
  THINKING_START:    'thinking.start',
  THINKING_TOKEN:    'thinking.token',
  THINKING_END:      'thinking.end',
  PLANNING_START:    'planning.start',
  PLANNING_END:      'planning.end',
  SKILL_START:       'skill.start',
  SKILL_PROGRESS:    'skill.progress',
  SKILL_END:         'skill.end',
  SKILL_ERROR:       'skill.error',
  AGGREGATION_START: 'aggregation.start',
  AGGREGATION_END:   'aggregation.end',
  ANSWER_TOKEN:      'answer.token',
  ANSWER_END:        'answer.end',
} as const;

// ── Memory ────────────────────────────────────────────────────

export const MEMORY_EVENTS = {
  WRITE: 'memory.write',
  READ:  'memory.read',
} as const;

// ── Conscious ─────────────────────────────────────────────────

export const CONSCIOUS_EVENTS = {
  REFLECTION:    'conscious.reflection',
  ANOMALY:       'conscious.anomaly',
  STATE_UPDATED: 'conscious.state.updated',
} as const;

// ── Temporal / Lifecycle ──────────────────────────────────────

export const LIFECYCLE_EVENTS = {
  STATE_CHANGED: 'event.state_changed',
  ARCHIVED:      'event.archived',
  TTL_EXPIRED:   'event.ttl_expired',
} as const;

// ── System ────────────────────────────────────────────────────

export const SYSTEM_EVENTS = {
  BOOT:              'system.boot',
  SHUTDOWN:          'system.shutdown',
  TICK:              'scheduler.tick',
  ARCHITECTURE_DRIFT: 'system.architecture.drift',
} as const;

// ── Union of all event type strings ──────────────────────────

export type GlideEventType =
  | typeof TASK_EVENTS[keyof typeof TASK_EVENTS]
  | typeof COGNITIVE_EVENTS[keyof typeof COGNITIVE_EVENTS]
  | typeof MEMORY_EVENTS[keyof typeof MEMORY_EVENTS]
  | typeof CONSCIOUS_EVENTS[keyof typeof CONSCIOUS_EVENTS]
  | typeof LIFECYCLE_EVENTS[keyof typeof LIFECYCLE_EVENTS]
  | typeof SYSTEM_EVENTS[keyof typeof SYSTEM_EVENTS];

// ── Payload contracts ─────────────────────────────────────────

export interface TaskStartPayload      { query: string; sessionId?: string; }
export interface ThinkingEndPayload    { thinking: string; }
export interface PlanningEndPayload    { steps: { skill: string; params: Record<string,unknown> }[]; raw: string; }
export interface SkillStartPayload     { skill: string; params?: Record<string,unknown>; }
export interface SkillEndPayload       { skill: string; output: unknown; duration: number; outputType?: string; }
export interface SkillErrorPayload     { skill: string; error: string; duration?: number; }
export interface AnswerEndPayload      { answer: string; observations?: unknown[]; }
export interface ArchitectureDriftPayload { reason: string; originalEventId: string; }
