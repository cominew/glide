// runtime/tasks/task.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Task Object
// The single execution unit. Every state-changing operation
// must be wrapped in a Task.
// ─────────────────────────────────────────────────────────────

import {
  Task,
  TaskType,
  TaskStatus,
  TaskSource,
  TaskResult,
  MemoryReceipt,
  RiskLevel,
} from '../../kernel/types';

// ── ID Generator ─────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Task Factory ─────────────────────────────────────────────

export interface CreateTaskParams {
  type:       TaskType;
  intent:     string;
  context?:   Record<string, any>;
  source?:    TaskSource;
  priority?:  number;
  risk?:      RiskLevel;
  sessionId?: string;
  parentId?:  string;
  traceId?:   string;
}

export function createTask(params: CreateTaskParams): Task {
  const now = Date.now();
  return {
    id:        makeId('task'),
    type:      params.type,
    intent:    params.intent,
    context:   params.context ?? {},
    status:    'CREATED',
    source:    params.source ?? 'system',
    createdAt: now,
    updatedAt: now,
    metadata: {
      priority:  params.priority  ?? 5,
      risk:      params.risk      ?? 'low',
      sessionId: params.sessionId,
      parentId:  params.parentId,
      traceId:   params.traceId   ?? makeId('trace'),
    },
  };
}

// ── Status Transitions ────────────────────────────────────────
// Valid forward transitions only. Any violation = FAILED.

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED:    ['VALIDATED', 'FAILED'],
  VALIDATED:  ['ROUTED',    'FAILED'],
  ROUTED:     ['EXECUTING', 'FAILED'],
  EXECUTING:  ['COMPLETED', 'FAILED'],
  COMPLETED:  [],
  FAILED:     [],
};

export function transitionTask(task: Task, next: TaskStatus): Task {
  const allowed = VALID_TRANSITIONS[task.status];

  if (!allowed.includes(next)) {
    throw new Error(
      `[Task] Invalid transition: ${task.status} → ${next} (task: ${task.id})`
    );
  }

  return {
    ...task,
    status:    next,
    updatedAt: Date.now(),
  };
}

// ── Convenience Mutators ──────────────────────────────────────

export function failTask(task: Task, error: string): Task {
  return {
    ...transitionTask(task, 'FAILED'),
    result: {
      success:     false,
      error,
      completedAt: Date.now(),
    },
  };
}

export function completeTask(task: Task, output: any): Task {
  return {
    ...transitionTask(task, 'COMPLETED'),
    result: {
      success:     true,
      output,
      completedAt: Date.now(),
    },
  };
}

// ── MemoryReceipt Builder ─────────────────────────────────────
// I1 invariant enforcement.
// Only callable with a COMPLETED task — throws otherwise.
// This is the ONLY valid input to MemoryWriter.

export function buildMemoryReceipt(task: Task): MemoryReceipt {
  if (task.status !== 'COMPLETED') {
    throw new Error(
      `[Task] MemoryReceipt requires COMPLETED status. Got: ${task.status} (task: ${task.id})`
    );
  }

  if (!task.result) {
    throw new Error(
      `[Task] MemoryReceipt requires a result. Task ${task.id} has none.`
    );
  }

  return {
    taskId:    task.id,
    taskType:  task.type,
    intent:    task.intent,
    result:    task.result,
    sessionId: task.metadata.sessionId,
    issuedAt:  Date.now(),
  };
}

// ── Inspection Helpers ────────────────────────────────────────

export function isTerminal(task: Task): boolean {
  return task.status === 'COMPLETED' || task.status === 'FAILED';
}

export function isBlocked(task: Task): boolean {
  return (
    task.status === 'FAILED' &&
    task.policyDecision?.allowed === false
  );
}

export function taskSummary(task: Task): string {
  return `[${task.id}] ${task.type} "${task.intent}" → ${task.status}`;
}
