// apps/dashboard/events/events.ts
// ─────────────────────────────────────────────────────────────
// UI Event Types — the frontend projection of kernel events.
//
// These types describe how kernel GlideEvents appear in the UI.
// They are NOT the same as kernel GlideEvent — they are
// enriched with UI-specific fields (label, status, category).
//
// This is the SINGLE source for all UI event types.
// event-types.ts has been deleted — import from here instead.
// ─────────────────────────────────────────────────────────────

export type EventCategory =
  | 'task'
  | 'thinking'
  | 'planning'
  | 'skill'
  | 'memory'
  | 'conscious'
  | 'governance'
  | 'system';

export interface UIEvent {
  id:        string;
  taskId?:   string;          // trace.taskId from kernel event
  type:      string;
  category:  EventCategory;
  timestamp: number;
  source?:   string;
  payload?:  any;

  // UI-derived fields
  label:     string;          // human-readable one-liner
  duration?: number;
  status?:   'ok' | 'warn' | 'error' | 'pending';
}

export interface EventFilter {
  patterns?:    string[];     // glob: "task.*", "skill.*"
  categories?:  EventCategory[];
  taskId?:      string;
  since?:       number;
  status?:      UIEvent['status'][];
}

export interface ReplaySession {
  taskId:    string;
  events:    UIEvent[];
  startedAt: number;
  endedAt?:  number;
  summary?: {
    thinking:   string;
    skillsUsed: string[];
    outcome:    string;
    duration:   number;
  };
}
