// kernel/temporal/temporal-event.ts
// ─────────────────────────────────────────────────────────────
// L1 — Temporal Layer schema
// Defines what a KernelEvent becomes after it enters the
// lifecycle engine — gains time, state, and governance fields.
//
// This is the "living" form of an event.
// KernelEvent = atomic signal
// TemporalEvent = signal + time + state + lifecycle
// ─────────────────────────────────────────────────────────────

import { KernelEvent, EventSource } from '../event-bus/event-bus.js';

// ── Lifecycle state machine ───────────────────────────────────
// Strict forward-only transitions (no cycling back).

export type EventLifecycleState =
  | 'NEW'
  | 'ACTIVE'
  | 'RUNNING'
  | 'PENDING_APPROVAL'
  | 'WAITING'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ARCHIVED';

// ── Governance decision ───────────────────────────────────────

export type ApprovalState =
  | 'AUTO_ALLOWED'
  | 'REQUIRES_HUMAN'
  | 'APPROVED'
  | 'REJECTED';

// ── Visibility — who can see this event ───────────────────────

export type EventVisibility =
  | 'SYSTEM'           // kernel-internal only
  | 'DASHBOARD'        // visible to UI
  | 'HUMAN_REQUIRED'   // requires human action
  | 'BACKGROUND';      // low priority, background

// ── TemporalEvent — the enriched form ────────────────────────

export interface TemporalEvent<T = any> extends KernelEvent<T> {

  // Lifecycle
  state:     EventLifecycleState;
  createdAt: number;
  updatedAt: number;
  aging:     number;           // ms since creation

  // Temporal windows
  scheduledAt?: number;
  startedAt?:   number;
  finishedAt?:  number;
  ttl?:         number;        // expiry in ms from createdAt

  // Governance
  approval:  ApprovalState;
  riskLevel: 1 | 2 | 3 | 4 | 5;

  // Priority scoring
  importance:    number;       // 0–100, system-assigned
  urgency:       number;       // 0–100, time-pressure
  priorityScore: number;       // derived: f(importance, urgency, aging)

  // Cognitive context
  intent?:   string;
  goal?:     string;

  // Execution
  assignedWorker?: string;
  progress?:       number;    // 0–1
  result?:         any;
  error?:          string;

  // Observation
  observations?: string[];
  feedback?:     string;
  qualityScore?: number;

  // Memory linkage
  episodicMemoryId?: string;
  semanticRefs?:     string[];
  learned?:          boolean;

  // Graph linkage
  parentId?:       string;
  correlationId?:  string;
  spawnedEvents?:  string[];

  // Visibility
  visibility: EventVisibility;
  tags?:      string[];
}

// ── Factory ───────────────────────────────────────────────────
// Creates a TemporalEvent from a raw KernelEvent.
// All fields start at safe defaults. Lifecycle engine updates them.

export function toTemporalEvent<T>(event: KernelEvent<T>): TemporalEvent<T> {
  return {
    ...event,
    state:         'NEW',
    createdAt:     event.timestamp,
    updatedAt:     event.timestamp,
    aging:         0,
    approval:      'AUTO_ALLOWED',
    riskLevel:     1,
    importance:    defaultImportance(event.type),
    urgency:       50,
    priorityScore: defaultImportance(event.type),
    visibility:    defaultVisibility(event.type),
  };
}

// ── Helpers ───────────────────────────────────────────────────

function defaultImportance(type: string): number {
  if (type.startsWith('task.'))       return 80;
  if (type.startsWith('conscious.'))  return 60;
  if (type.startsWith('thinking.') || type.startsWith('planning.')) return 70;
  if (type.startsWith('skill.'))      return 65;
  if (type.startsWith('system.'))     return 90;
  return 30;
}

function defaultVisibility(type: string): EventVisibility {
  if (type.startsWith('task.') ||
      type.startsWith('thinking.') ||
      type.startsWith('planning.') ||
      type.startsWith('skill.') ||
      type.startsWith('conscious.')) return 'DASHBOARD';
  if (type === 'task.awaiting_human') return 'HUMAN_REQUIRED';
  if (type.startsWith('system.'))     return 'SYSTEM';
  return 'BACKGROUND';
}
