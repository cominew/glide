// kernel/event-bus/event-contract.ts
// ─────────────────────────────────────────────────────────────
// Glide Event Kernel — Canonical Event Schema
//
// Rule 1: ALL task-derived events MUST carry taskId in trace.
// Rule 2: No return result. Only bus.emitEvent().
// Rule 3: Execution produces skill.output only.
//         answer.final is produced by AnswerAssembler only.
// ─────────────────────────────────────────────────────────────

export type EventSource =
  | 'KERNEL' | 'DISPATCHER' | 'RUNTIME'
  | 'COGNITION' | 'GUARDIAN' | 'SYSTEM';

// Rule 1: taskId is REQUIRED for all task-derived events.
// Never undefined when a task is active.
export interface EventTrace {
  taskId?: string;
  parentEventId?: string;
  sessionId?: string;
}

export function makeEvent<T>(
  type: string,
  payload: T,
  source: EventSource,
  trace: Partial<EventTrace> = {},
): Omit<GlideEvent<T>, 'id' | 'timestamp'> {
  return {
    type,
    source,
    payload,
    trace,
  };
}
export interface GlideEvent<T = any> {
  id:        string;
  type:      string;
  source:    EventSource;
  timestamp: number;
  payload:   T;
  trace:     EventTrace;
}

export type ConsciousPhase =
  | 'idle' | 'receiving' | 'thinking' | 'planning'
  | 'executing' | 'reflecting' | 'waiting_human';

export function getTaskId(event: GlideEvent): string | undefined {
  return event.trace?.taskId
    ?? (event.payload as any)?.taskId
    ?? (event.payload as any)?.id;
}

// ── Event registry ────────────────────────────────────────────

export const E = {
  // Task boundary
  TASK_CREATED: 'task.created',
  TASK_ROUTED: 'task.routed',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_BLOCKED: 'task.blocked',
  TASK_AWAITING_HUMAN: 'task.awaiting_human',
  TASK_REJECTED: 'task.rejected',

  // Skill emergence (ONLY output-level reality)
  SKILL_OUTPUT: 'skill.output',
  SKILL_ERROR: 'skill.error',

  // Answer synthesis boundary
  ANSWER_FINAL: 'answer.final',

  // Cognition signals (non-pipeline)
  CONSCIOUS_AWAKENED: 'conscious.awakened',
  CONSCIOUS_DISSOLVED: 'conscious.dissolved',
  CONSCIOUS_REFLECTION: 'conscious.reflection',
  CONSCIOUS_ANOMALY: 'conscious.anomaly',

  // System
  SYSTEM_BOOT: 'system.boot',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  ARCH_DRIFT: 'system.architecture.drift',

  // Governance
  CONSTITUTION_VIOLATION: 'constitution.violation',
} as const;

export type EventType = typeof E[keyof typeof E];

export function isEventType(type: string): type is EventType {
  return Object.values(E).includes(type as any);
}
