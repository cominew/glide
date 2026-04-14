// apps/dashboard/types/events.ts
// ─────────────────────────────────────────────────────────────
// Frontend Event System — canonical types
// These mirror kernel GlideEventType but are the "UI projection"
// of kernel events. UI never touches kernel directly.
// ─────────────────────────────────────────────────────────────

export type EventCategory =
  | 'task'        // task lifecycle: created → validated → routed → executing → completed/failed
  | 'thinking'    // LLM reasoning
  | 'planning'    // skill selection
  | 'skill'       // skill execution
  | 'memory'      // memory reads/writes
  | 'conscious'   // ConsciousLoop observations
  | 'governance'  // policy decisions
  | 'system';     // boot, shutdown, heartbeat

export interface UIEvent {
  id:        string;
  taskId?:   string;
  type:      string;           // e.g. "task.completed", "thinking.end"
  category:  EventCategory;
  timestamp: number;
  source?:   string;           // "orchestrator" | "dispatcher" | "kernel" etc.
  payload:   any;

  // Derived fields — computed by the event stream processor
  label:     string;           // human-readable one-liner
  duration?: number;           // ms (for paired start/end events)
  status?:   'ok' | 'warn' | 'error' | 'pending';
}

// ── Filter spec ───────────────────────────────────────────────

export interface EventFilter {
  patterns:    string[];       // glob-style: "task.*", "skill.*", "thinking.end"
  categories?: EventCategory[];
  taskId?:     string;
  since?:      number;         // timestamp
  status?:     UIEvent['status'][];
}

// ── Replay session ────────────────────────────────────────────

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
