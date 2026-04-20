// apps/dashboard/observers/useGlide.ts
// ─────────────────────────────────────────────────────────────
// Reality Adapter — bridges EventSource to React lifecycle.
//
// This is a TEMPORARY scaffold. It exists only because React
// components need a way to re-render when new events manifest.
//
// It does NOT:
//   - store state (that's ObservationSurface)
//   - make decisions
//   - represent a "user" or "observer"
//
// When React can natively react to event streams, this adapter
// will be removed. Until then, it silently pipes reality to UI.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { UIEvent, EventCategory, EventFilter, ReplaySession } from '../events/events';
import { observationSurface } from '../events/timeline';

// ── Blocked event types (never reach UI) ─────────────────────

const BLOCKED = new Set([
  'system.clock.pulse',
  'event.state_changed',
  'event.archived',
  'event.ttl_expired',
  'conscious.state.updated',
]);

// ── Normalization (unchanged) ────────────────────────────────

const CATEGORY_MAP: Record<string, EventCategory> = {
  'task.created': 'task', 'task.validated': 'task', 'task.routed': 'task',
  'task.executing': 'task', 'task.completed': 'task', 'task.failed': 'task',
  'task.blocked': 'governance', 'task.awaiting_human': 'task', 'task.started': 'task',
  'thinking.start': 'thinking', 'thinking.end': 'thinking',
  'planning.start': 'planning', 'planning.end': 'planning',
  'skill.start': 'skill', 'skill.end': 'skill', 'skill.error': 'skill',
  'aggregation.end': 'skill', 'answer.end': 'task',
  'memory.write': 'memory', 'memory.read': 'memory',
  'conscious.awakened': 'conscious', 'conscious.dissolved': 'conscious',
  'conscious.reflection': 'conscious', 'conscious.anomaly': 'conscious',
  'proposal.created': 'conscious', 'proposal.approved': 'conscious',
  'system.boot': 'system', 'system.shutdown': 'system',
};

function categorize(type: string): EventCategory {
  return CATEGORY_MAP[type] ?? 'system';
}

function labelOf(type: string, payload: any): string {
  switch (type) {
    case 'task.created':        return `Task: "${(payload?.intent ?? '').slice(0,50)}"`;
    case 'task.validated':      return `Policy: ${payload?.policyDecision?.allowed !== false ? 'allowed' : 'blocked'}`;
    case 'task.routed':         return 'Routed → executor';
    case 'task.executing':      return 'Executing...';
    case 'task.completed':      return 'Task completed';
    case 'task.failed':         return `Failed: ${payload?.result?.error ?? payload?.error ?? ''}`;
    case 'task.blocked':        return `Blocked: ${payload?.policyDecision?.reason ?? ''}`;
    case 'task.started':        return `Started: "${(payload?.query ?? '').slice(0,50)}"`;
    case 'thinking.start':      return 'Thinking...';
    case 'thinking.end':        return `Thought: "${(payload?.thinking ?? '').slice(0,60)}"`;
    case 'planning.start':      return 'Planning...';
    case 'planning.end':        return `Plan: ${(payload?.steps ?? []).map((s:any)=>s.skill).join(', ') || 'no skills'}`;
    case 'skill.start':         return `Skill → ${payload?.skill}`;
    case 'skill.end':           return `${payload?.skill} done`;
    case 'skill.error':         return `${payload?.skill ?? 'skill'} error`;
    case 'aggregation.end':     return 'Aggregating results...';
    case 'answer.end':          return `Answer ready (${(payload?.answer ?? '').length} chars)`;
    case 'memory.write':        return 'Memory write';
    case 'conscious.awakened':  return `Awareness: "${(payload?.intent ?? '').slice(0,50)}"`;
    case 'conscious.dissolved': return payload?.anomaly ? 'Dissolved — anomaly' : 'Dissolved — complete';
    case 'conscious.reflection':return `Reflection: ${(payload?.observation ?? '').slice(0,60)}`;
    case 'proposal.created':    return `Proposal: ${payload?.title ?? ''}`;
    case 'proposal.approved':   return `Approved: ${payload?.title ?? ''}`;
    case 'system.boot':         return 'Glide OS booted';
    default:                    return type;
  }
}

function statusOf(type: string, payload?: any): UIEvent['status'] {
  if (type.includes('.error') || type === 'task.failed' || type === 'task.blocked') return 'error';
  if (type === 'conscious.anomaly') return 'warn';
  if (type === 'conscious.dissolved' && payload?.anomaly) return 'warn';
  if (type.endsWith('.start') || type === 'task.executing' || type === 'conscious.awakened') return 'pending';
  return 'ok';
}

function normalize(raw: any): UIEvent | null {
  const type = raw.type as string;
  if (!type || BLOCKED.has(type)) return null;

  const taskId =
    raw.trace?.taskId ??
    raw.payload?.taskId ??
    raw.payload?.id ??
    raw.taskId;

  return {
    id:        raw.id ?? `ui_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    taskId,
    type,
    category:  categorize(type),
    timestamp: raw.timestamp ?? Date.now(),
    source:    raw.source,
    payload:   raw.payload,
    label:     labelOf(type, raw.payload),
    status:    statusOf(type, raw.payload),
  };
}

// ── Filter ────────────────────────────────────────────────────

function matchesFilter(event: UIEvent, filter: EventFilter): boolean {
  if (filter.taskId && event.taskId !== filter.taskId) return false;
  if (filter.categories?.length && !filter.categories.includes(event.category)) return false;
  if (filter.status?.length && event.status && !filter.status.includes(event.status)) return false;
  if (filter.since && event.timestamp < filter.since) return false;
  if (filter.patterns?.length) {
    return filter.patterns.some(p => {
      if (p === '*') return true;
      if (p.endsWith('.*')) return event.type.startsWith(p.slice(0,-2) + '.');
      return event.type === p;
    });
  }
  return true;
}

// ── Reality Adapter ───────────────────────────────────────────

export function useGlide() {
  // React needs a way to re-render when new events arrive.
  // We subscribe to ObservationSurface and update this local version stamp.
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);

  // Per-task listeners for active chat turns (useChat subscribes here)
  const listenersRef = useRef<Map<string, (event: UIEvent) => void>>(new Map());

  // ── Subscribe to surface changes ───────────────────────────
  useEffect(() => {
    const unsubscribe = observationSurface.subscribe(() => {
      setVersion(v => v + 1);  // trigger re-render for all consumers
    });
    return unsubscribe;
  }, []);

  // ── Receive event from EventSource → write to surface ──────
  const receive = useCallback((event: UIEvent) => {
    observationSurface.receive(event);
    // Also notify per-task listeners (used by useChat active turns)
    if (event.taskId) {
      for (const handler of listenersRef.current.values()) {
        try { handler(event); } catch {}
      }
    }
  }, []);

  // ── Per-task subscription (for useChat) ────────────────────
  const subscribe = useCallback((id: string, handler: (event: UIEvent) => void) => {
    listenersRef.current.set(id, handler);
    return () => listenersRef.current.delete(id);
  }, []);

  // ── EventSource setup ──────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/events/stream');
    es.onopen  = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const event = normalize(raw);
        if (event) receive(event);
      } catch {}
    };

    const NAMED = [
      'task.created','task.validated','task.routed','task.executing',
      'task.completed','task.failed','task.blocked','task.awaiting_human','task.started',
      'thinking.start','thinking.end','planning.start','planning.end',
      'skill.start','skill.end','skill.error','aggregation.end','answer.end',
      'memory.write',
      'conscious.awakened','conscious.dissolved','conscious.reflection','conscious.anomaly',
      'proposal.created','proposal.approved','system.boot',
    ];

    const handlers: [string, (e: MessageEvent) => void][] = [];
    for (const type of NAMED) {
      const h = (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data);
          const event = normalize({ ...raw, type });
          if (event) receive(event);
        } catch {}
      };
      es.addEventListener(type, h);
      handlers.push([type, h]);
    }

    return () => {
      for (const [type, h] of handlers) es.removeEventListener(type, h);
      es.close();
      setConnected(false);
    };
  }, [receive]);

  // ── Query API — pure reads from ObservationSurface ─────────
  const events = observationSurface.getAll();

  const query = useCallback((f: EventFilter): UIEvent[] => {
    return (events as UIEvent[]).filter(e => matchesFilter(e, f));
  }, [events]);

  const getSession = useCallback((taskId: string): ReplaySession | null => {
    const taskEvents = observationSurface.getByTaskId(taskId) as UIEvent[];
    if (!taskEvents.length) return null;
    const start   = taskEvents.find(e => e.type === 'task.started' || e.type === 'task.created');
    const end     = taskEvents.find(e => e.type === 'task.completed' || e.type === 'task.failed');
    const thinking = taskEvents.find(e => e.type === 'thinking.end')?.payload?.thinking ?? '';
    const skills   = taskEvents.filter(e => e.type === 'skill.end').map(e => e.payload?.skill);
    const answer   = observationSurface.getAnswer(taskId) ?? '';
    return {
      taskId, events: taskEvents,
      startedAt: start?.timestamp ?? taskEvents[0].timestamp,
      endedAt:   end?.timestamp,
      summary: {
        thinking, skillsUsed: skills,
        outcome: typeof answer === 'string' ? answer.slice(0,200) : JSON.stringify(answer).slice(0,200),
        duration: end && start ? end.timestamp - start.timestamp : 0,
      },
    };
  }, []);

  const clearEvents = useCallback(() => {
    observationSurface.clear();
  }, []);

  // ── Dispatch helper (unchanged) ────────────────────────────
  const dispatch = useCallback(async (message: string, sessionId: string): Promise<string> => {
    const res = await fetch('/api/chat/stream', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, sessionId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const taskId = res.headers.get('X-Task-Id');
    if (!taskId) throw new Error('No X-Task-Id header from server');

    res.body?.cancel().catch(() => {});
    return taskId;
  }, []);

  return {
    events: events as UIEvent[],
    connected,
    query,
    getSession,
    clearEvents,
    subscribe,
    dispatch,
  };
}

export type { UIEvent, EventFilter, ReplaySession };