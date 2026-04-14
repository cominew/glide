// apps/dashboard/hooks/useEventStream.ts
// ─────────────────────────────────────────────────────────────
// Subscribes to /api/events/stream (global SSE feed).
// Normalizes raw kernel events → UIEvent shape.
// All UI components consume this hook — never raw SSE directly.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { UIEvent, EventCategory, EventFilter, ReplaySession } from '../types/events';

// ── Event normalization ───────────────────────────────────────

const CATEGORY_MAP: Record<string, EventCategory> = {
  'task.created':        'task',
  'task.validated':      'task',
  'task.routed':         'task',
  'task.executing':      'task',
  'task.completed':      'task',
  'task.failed':         'task',
  'task.blocked':        'task',
  'task.awaiting_human': 'task',
  'task.started':        'task',
  'thinking.start':      'thinking',
  'thinking.end':        'thinking',
  'planning.start':      'planning',
  'planning.end':        'planning',
  'skill.start':         'skill',
  'skill.end':           'skill',
  'skill.error':         'skill',
  'aggregation.end':     'skill',
  'answer.end':          'task',
  'memory.write':        'memory',
  'memory.read':         'memory',
  'conscious.reflection':'conscious',
  'conscious.anomaly':   'conscious',
  'task.blocked':        'governance',
  'system.boot':         'system',
  'system.shutdown':     'system',
};

function categorize(type: string): EventCategory {
  return CATEGORY_MAP[type] ?? 'system';
}

function label(type: string, payload: any): string {
  switch (type) {
    case 'task.created':        return `Task created: "${payload?.intent?.slice(0,50) ?? ''}"`; 
    case 'task.validated':      return `Policy: ${payload?.policyDecision?.allowed ? 'allowed' : 'blocked'}`;
    case 'task.routed':         return `Routed → ${payload?.metadata?.traceId ? 'executor' : 'runtime'}`;
    case 'task.executing':      return 'Executing...';
    case 'task.completed':      return 'Task completed';
    case 'task.failed':         return `Failed: ${payload?.result?.error ?? 'unknown error'}`;
    case 'task.blocked':        return `Blocked: ${payload?.policyDecision?.reason ?? ''}`;
    case 'task.started':        return `Started: "${payload?.query?.slice(0,50) ?? ''}"`;
    case 'thinking.start':      return 'Thinking...';
    case 'thinking.end':        return `Thought: "${(payload?.thinking ?? '').slice(0,60)}"`;
    case 'planning.start':      return 'Planning skills...';
    case 'planning.end':        return `Plan: ${(payload?.steps ?? []).map((s:any) => s.skill).join(', ') || 'no skills'}`;
    case 'skill.start':         return `Skill → ${payload?.skill}`;
    case 'skill.end':           return `${payload?.skill} done (${payload?.duration ?? 0}ms)`;
    case 'skill.error':         return `${payload?.skill} error`;
    case 'aggregation.end':     return 'Aggregating results...';
    case 'answer.end':          return `Answer ready (${(payload?.answer ?? '').length} chars)`;
    case 'memory.write':        return `Memory write: ${payload?.taskType ?? ''}`;
    case 'memory.read':         return 'Memory read';
    case 'conscious.reflection':return `Reflection: ${payload?.observation?.slice(0,60) ?? ''}`;
    case 'conscious.anomaly':   return `Anomaly: ${payload?.observation?.slice(0,60) ?? ''}`;
    case 'system.boot':         return 'Glide OS booted';
    default:                    return type;
  }
}

function statusOf(type: string, payload: any): UIEvent['status'] {
  if (type.includes('.error') || type === 'task.failed' || type === 'task.blocked') return 'error';
  if (type === 'conscious.anomaly') return 'warn';
  if (type.includes('.start') || type === 'task.executing') return 'pending';
  return 'ok';
}

function normalize(raw: any): UIEvent | null {
  const type    = raw.type as string;
  if (!type) return null;

  return {
    id:        raw.id ?? `ui_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    taskId:    raw.taskId ?? raw.payload?.id ?? raw.payload?.taskId,
    type,
    category:  categorize(type),
    timestamp: raw.timestamp ?? Date.now(),
    source:    raw.source,
    payload:   raw.payload,
    label:     label(type, raw.payload),
    status:    statusOf(type, raw.payload),
  };
}

// ── Filter engine ─────────────────────────────────────────────

function matchesFilter(event: UIEvent, filter: EventFilter): boolean {
  if (filter.taskId && event.taskId !== filter.taskId) return false;
  if (filter.categories?.length && !filter.categories.includes(event.category)) return false;
  if (filter.status?.length && event.status && !filter.status.includes(event.status)) return false;
  if (filter.since && event.timestamp < filter.since) return false;

  if (filter.patterns?.length) {
    return filter.patterns.some(pattern => {
      if (pattern === '*') return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return event.type.startsWith(prefix + '.');
      }
      return event.type === pattern;
    });
  }
  return true;
}

// ── Main hook ─────────────────────────────────────────────────

const MAX_EVENTS = 500;

export function useEventStream() {
  const [events,    setEvents]    = useState<UIEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to global event stream
    const es = new EventSource('/api/events/stream');
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const event = normalize(raw);
        if (!event) return;
        setEvents(prev => {
          const next = [...prev, event];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      } catch {}
    };

    // Also listen to named events
    const TYPES = [
      'task.created','task.validated','task.routed','task.executing',
      'task.completed','task.failed','task.blocked','task.awaiting_human','task.started',
      'thinking.start','thinking.end','planning.start','planning.end',
      'skill.start','skill.end','skill.error','aggregation.end','answer.end',
      'memory.write','conscious.reflection','conscious.anomaly','system.boot',
    ];

    const handlers: [string, (e: MessageEvent) => void][] = [];
    for (const type of TYPES) {
      const h = (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data);
          const event = normalize({ ...raw, type });
          if (!event) return;
          setEvents(prev => {
            const next = [...prev, event];
            return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
          });
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
  }, []);

  const filter = useCallback((f: EventFilter): UIEvent[] => {
    return events.filter(e => matchesFilter(e, f));
  }, [events]);

  const getSession = useCallback((taskId: string): ReplaySession | null => {
    const taskEvents = events.filter(e => e.taskId === taskId);
    if (!taskEvents.length) return null;

    const start = taskEvents.find(e => e.type === 'task.started' || e.type === 'task.created');
    const end   = taskEvents.find(e => e.type === 'task.completed' || e.type === 'task.failed');
    const thinking = taskEvents.find(e => e.type === 'thinking.end')?.payload?.thinking ?? '';
    const skills = taskEvents.filter(e => e.type === 'skill.end').map(e => e.payload?.skill);
    const answer = taskEvents.find(e => e.type === 'answer.end')?.payload?.answer
                ?? taskEvents.find(e => e.type === 'task.completed')?.payload?.result ?? '';

    return {
      taskId,
      events: taskEvents,
      startedAt:  start?.timestamp ?? taskEvents[0].timestamp,
      endedAt:    end?.timestamp,
      summary: {
        thinking,
        skillsUsed: skills,
        outcome: typeof answer === 'string' ? answer.slice(0, 200) : JSON.stringify(answer).slice(0, 200),
        duration: end && start ? end.timestamp - start.timestamp : 0,
      },
    };
  }, [events]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, filter, getSession, clear };
}

// ── Singleton for sharing across tabs ────────────────────────
// Components that don't need the full hook can import this.
export type { UIEvent, EventFilter, ReplaySession };
