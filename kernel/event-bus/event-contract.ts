// kernel/event-bus/event-contract.ts
// ─────────────────────────────────────────────────────────────
// Glide Event Kernel v2 — Single Canonical Event Schema
// ─────────────────────────────────────────────────────────────

export type EventSource =
  | 'KERNEL' | 'DISPATCHER' | 'RUNTIME'
  | 'COGNITION' | 'GUARDIAN' | 'SYSTEM';

export interface EventTrace {
  taskId?:        string;
  parentEventId?: string;
  sessionId?:     string;
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

export function makeEvent<T>(
  type: string, payload: T, source: EventSource, trace: EventTrace = {},
): Omit<GlideEvent<T>, 'id' | 'timestamp'> {
  return { type, source, payload, trace };
}

// ── Event type registry ───────────────────────────────────────

export const E = {
  // Task lifecycle
  TASK_CREATED:        'task.created',
  TASK_VALIDATED:      'task.validated',
  TASK_ROUTED:         'task.routed',
  TASK_STARTED:        'task.started',
  TASK_EXECUTING:      'task.executing',
  TASK_COMPLETED:      'task.completed',
  TASK_FAILED:         'task.failed',
  TASK_BLOCKED:        'task.blocked',
  TASK_AWAITING_HUMAN: 'task.awaiting_human',
  TASK_REJECTED:       'task.rejected',

  // Cognitive pipeline (Runtime emits these — not ConsciousLoop)
  THINKING_START:      'thinking.start',
  THINKING_END:        'thinking.end',
  PLANNING_START:      'planning.start',
  PLANNING_END:        'planning.end',
  SKILL_START:         'skill.start',
  SKILL_END:           'skill.end',
  SKILL_ERROR:         'skill.error',
  AGGREGATION_END:     'aggregation.end',
  ANSWER_END:          'answer.end',

  // Memory
  MEMORY_WRITE:        'memory.write',
  MEMORY_READ:         'memory.read',

  // Cognition — emergence events (not state broadcasts)
  CONSCIOUS_AWAKENED:   'conscious.awakened',    // ← NEW: mind appears
  CONSCIOUS_DISSOLVED:  'conscious.dissolved',   // ← NEW: mind disappears
  CONSCIOUS_REFLECTION: 'conscious.reflection',
  CONSCIOUS_ANOMALY:    'conscious.anomaly',
  // conscious.state.updated intentionally removed — no persistent state broadcast

  // Proposals
  PROPOSAL_CREATED:    'proposal.created',
  PROPOSAL_APPROVED:   'proposal.approved',
  PROPOSAL_REJECTED:   'proposal.rejected',

  // System
  SYSTEM_BOOT:         'system.boot',
  SYSTEM_SHUTDOWN:     'system.shutdown',
  CLOCK_PULSE:         'system.clock.pulse',
  ARCH_DRIFT:          'system.architecture.drift',

  // Governance
  CONSTITUTION_VIOLATION: 'constitution.violation', // only critical severity

  // Lifecycle (internal — filtered from SSE)
  EVENT_STATE_CHANGED: 'event.state_changed',
  EVENT_ARCHIVED:      'event.archived',
} as const;

export type EventType = typeof E[keyof typeof E];
