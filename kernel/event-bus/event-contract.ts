// kernel/event-bus/event-contract.ts
// ─────────────────────────────────────────────────────────────
// Glide Event Kernel — Canonical Event Schema
//
// Constitution v2 Compliance:
//   ✓ Rule 1: All task-derived events MUST carry taskId in trace
//   ✓ Rule 2: No return result — only bus.emitEvent()
//   ✓ Rule 3: Skills emit skill.output only — never answer.final
//   ✓ Kernel Emptiness: Event registry has NO business semantics
//
// Business-specific events (identity.resolved, profile.data, etc.)
// are defined and used by skills themselves — Kernel does not
// know or care about them.
// ─────────────────────────────────────────────────────────────

export type EventSource =
  | 'KERNEL' | 'DISPATCHER' | 'RUNTIME'
  | 'COGNITION' | 'GUARDIAN' | 'SYSTEM';

// Rule 1: taskId is required for all task-derived events.
// System events (system.boot) may omit it.
export interface EventTrace {
  taskId?: string;
  parentEventId?: string;
  sessionId?: string;
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

// ── Kernel Event Registry (NO BUSINESS SEMANTICS) ────────────
// These are the ONLY event types the Kernel knows about.
// Skills define their own business event strings at runtime.

export const E = {
  // ── Entry ─────────────────────────────────────────────────
  INPUT_USER: 'input.user',
  SYSTEM_SIGNAL: 'system.signal',

  // ── Task boundary ──────────────────────────────────────────
  TASK_CREATED:        'task.created',
  TASK_STARTED:        'task.started',
  TASK_EXECUTING:      'task.executing',
  TASK_VALIDATED:      'task.validated',
  TASK_ROUTED:         'task.routed',
  TASK_COMPLETED:      'task.completed',
  TASK_FAILED:         'task.failed',
  TASK_BLOCKED:        'task.blocked',
  TASK_AWAITING_HUMAN: 'task.awaiting_human',
  TASK_REJECTED:       'task.rejected',
  TASK_SILENT_COMPLETE: 'task.silent_complete',

  // ── Skill emergence ────────────────────────────────────────
  SKILL_START:   'skill.start',
  SKILL_END:     'skill.end',
  SKILL_OUTPUT:  'skill.output',
  SKILL_ERROR:   'skill.error',
  SKILL_MATCHED: 'skill.matched',

  // ── Answer synthesis ───────────────────────────────────────
  ANSWER_READY: 'answer.ready',
  ANSWER_FINAL: 'answer.final',
  ANSWER_END:   'answer.end',      // legacy UI compat

  // ── Cognition ──────────────────────────────────────────────
  CONSCIOUS_AWAKENED:   'conscious.awakened',
  CONSCIOUS_DISSOLVED:  'conscious.dissolved',
  CONSCIOUS_REFLECTION: 'conscious.reflection',
  CONSCIOUS_ANOMALY:    'conscious.anomaly',
  CONSCIOUS_STATE:      'conscious.state.updated',

  // ── Thinking pipeline ──────────────────────────────────────
  THINKING_START: 'thinking.start',
  THINKING_END:   'thinking.end',
  PLANNING_START: 'planning.start',
  PLANNING_END:   'planning.end',
  AGGREGATION_END: 'aggregation.end',

  // ── Memory ─────────────────────────────────────────────────
  MEMORY_WRITE: 'memory.write',
  MEMORY_READ:  'memory.read',

  // ── Proposals ──────────────────────────────────────────────
  PROPOSAL_CREATED:  'proposal.created',
  PROPOSAL_APPROVED: 'proposal.approved',
  PROPOSAL_REJECTED: 'proposal.rejected',

  // ── System ─────────────────────────────────────────────────
  SYSTEM_BOOT:     'system.boot',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  CLOCK_PULSE:     'system.clock.pulse',
  ARCH_DRIFT:      'system.architecture.drift',

  // ── Governance ─────────────────────────────────────────────
  CONSTITUTION_VIOLATION: 'constitution.violation',

  // ── Internal (filtered from SSE) ───────────────────────────
  EVENT_STATE_CHANGED: 'event.state_changed',
  EVENT_ARCHIVED:      'event.archived',
} as const;

export type EventType = typeof E[keyof typeof E];

// ── Event validation ──────────────────────────────────────────
// Skills may emit unknown event types — Kernel does not censor.
// This function is for type narrowing ONLY.
export function isEventType(type: string): type is EventType {
  return Object.values(E).includes(type as any);
}