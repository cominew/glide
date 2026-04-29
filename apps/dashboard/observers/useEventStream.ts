// apps/dashboard/observers/useEventStream.ts
// ─────────────────────────────────────────────────────────────
// Global SSE stream — normalizes all v4 kernel events for UI
//
// v4 event chain events added:
//   input.user            — user query enters the field
//   identity.resolved     — name disambiguation succeeded
//   identity.ambiguous    — multiple matches
//   identity.not_found    — no match
//   profile.data          — raw profile fetched
//   profile.output        — rendered profile
//   skill.output          — any skill produced output
//   answer.ready          — AnswerWitness assembled fragments
//
// Connection safety: short SSE interruptions will not trigger
// an immediate "offline" state. Only sustained loss of connection
// (3s of inactivity) will mark the UI as disconnected.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { observationSurface } from '../events/timeline';
import { UIEvent, EventCategory } from '../events/events';

// ── Blocked events ────────────────────────────────────────────
const BLOCKED = new Set([
  'system.clock.pulse',
  'event.state_changed',
  'event.archived',
  'event.ttl_expired',
  'conscious.state.updated',
]);

// ── Category mapping ──────────────────────────────────────────
function categorize(type: string): EventCategory {
  if (type.startsWith('task.'))            return 'task';
  if (type.startsWith('thinking.'))        return 'thinking';
  if (type.startsWith('planning.'))        return 'planning';
  if (type.startsWith('skill.'))           return 'skill';
  if (type.startsWith('memory.'))          return 'memory';
  if (type.startsWith('conscious.'))       return 'conscious';
  if (type.startsWith('proposal.'))        return 'conscious';
  if (type.startsWith('identity.'))        return 'skill';
  if (type.startsWith('profile.'))         return 'skill';
  if (type.startsWith('sales.'))           return 'skill';
  if (type === 'input.user')               return 'task';
  if (type === 'answer.ready' ||
      type === 'answer.final' ||
      type === 'answer.end')               return 'task';
  return 'system';
}

// ── Label ─────────────────────────────────────────────────────
function labelOf(type: string, payload: any): string {
  const p = payload ?? {};
  switch (type) {
    case 'input.user':
      return `"${String(p.input?.message ?? p.input ?? '').slice(0, 50)}"`;
    case 'identity.resolved':
      return `Identity: ${p.name ?? p.query ?? ''}`;
    case 'identity.ambiguous':
      return `Ambiguous: ${p.candidates?.length ?? 0} matches for "${p.query ?? ''}"`;
    case 'identity.not_found':
      return `Not found: "${p.query ?? ''}"`;
    case 'profile.data':
      return `Profile data: ${p.name ?? ''}`;
    case 'profile.output':
      return `Profile rendered: ${p.name ?? ''}`;
    case 'sales.query':   return `Sales query: ${p.intent ?? ''}`;
    case 'sales.data':    return `Sales data ready`;
    case 'sales.output':  return `Sales output ready`;
    case 'skill.output':
      return `${p.skill ?? 'skill'} → ${p.fragments?.length ?? 0} fragment(s)`;
    case 'skill.error':
      return `${p.skill ?? 'skill'} error: ${p.error ?? ''}`;
    case 'answer.ready':
    case 'answer.final':
      return `Answer assembled (${p.fragments?.length ?? 0} fragments)`;
    case 'answer.end':
      return `Answer ready (${String(p.answer ?? '').length} chars)`;
    case 'task.created':    return `Task: "${(p.intent ?? '').slice(0, 50)}"`;
    case 'task.completed':  return 'Task completed';
    case 'task.failed':     return `Failed: ${p.error ?? ''}`;
    case 'task.started':    return `Started: "${(p.query ?? '').slice(0, 50)}"`;
    case 'conscious.awakened':   return `Awareness: "${(p.intent ?? '').slice(0, 50)}"`;
    case 'conscious.dissolved':  return p.anomaly ? 'Dissolved — anomaly' : 'Dissolved';
    case 'conscious.reflection': return `Reflection: ${(p.observation ?? '').slice(0, 60)}`;
    case 'system.boot': return 'Glide OS ready';
    default:            return type;
  }
}

// ── Status ────────────────────────────────────────────────────
function statusOf(type: string, payload?: any): UIEvent['status'] {
  if (type.includes('.error') || type === 'task.failed' || type === 'identity.not_found') return 'error';
  if (type === 'identity.ambiguous') return 'warn';
  if (type === 'input.user' || type.endsWith('.start')) return 'pending';
  if (type === 'answer.ready' || type === 'answer.final' || type === 'task.completed') return 'ok';
  return 'ok';
}

// ── Normalization ─────────────────────────────────────────────
function normalize(raw: any, forceType?: string): UIEvent | null {
  const type = forceType ?? raw.type;
  if (!type || BLOCKED.has(type)) return null;

  const taskId =
    raw.trace?.taskId ??
    raw.payload?.taskId ??
    raw.payload?.correlationId ??
    raw.payload?.eventId ??
    raw.payload?.id ??
    raw.id;

  return {
    id:        raw.id ?? `ui_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
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

// ── Named event types for per-type listener ──────────────────
const NAMED_EVENTS = [
  'input.user',
  'identity.query', 'identity.resolved', 'identity.ambiguous', 'identity.not_found',
  'profile.request', 'profile.data', 'profile.output',
  'sales.query', 'sales.data', 'sales.output',
  'skill.output', 'skill.error', 'skill.matched',
  'answer.ready', 'answer.final', 'answer.end',
  'task.created', 'task.validated', 'task.routed', 'task.executing',
  'task.completed', 'task.failed', 'task.blocked', 'task.started',
  'conscious.awakened', 'conscious.dissolved', 'conscious.reflection', 'conscious.anomaly',
  'proposal.created', 'proposal.approved',
  'system.boot',
];

// ── Main hook ─────────────────────────────────────────────────
export function useEventStream() {
  const [snapshot, setSnapshot] = useState<readonly UIEvent[]>(() => observationSurface.getAll());
  const [connected, setConnected] = useState(false);

  // Refs to handle debounced offline detection
  const connectedRef     = useRef(false);
  const offlineTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef            = useRef<EventSource | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const unsub = observationSurface.subscribe(events => setSnapshot(events));

    const es = new EventSource('/api/events/stream');
    esRef.current = es;

    const clearOfflineTimer = () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };

    es.onopen = () => {
      clearOfflineTimer();
      connectedRef.current = true;
      setConnected(true);
    };

    es.onerror = () => {
      // Do NOT immediately disconnect – wait 3s to see if connection restores
      clearOfflineTimer();
      offlineTimerRef.current = setTimeout(() => {
        connectedRef.current = false;
        setConnected(false);
      }, 3000);
    };

    const receive = (raw: any, forceType?: string) => {
      const event = normalize(raw, forceType);
      if (event) observationSurface.append(event);
    };

    es.onmessage = (e) => { try { receive(JSON.parse(e.data)); } catch {} };

    const handlers: [string, (e: MessageEvent) => void][] = [];
    for (const type of NAMED_EVENTS) {
      const h = (e: MessageEvent) => {
        try { receive(JSON.parse(e.data), type); } catch {}
      };
      es.addEventListener(type, h);
      handlers.push([type, h]);
    }

    return () => {
      unsub();
      for (const [t, h] of handlers) es.removeEventListener(t, h);
      es.close();
      setConnected(false);
      connectedRef.current = false;
      clearOfflineTimer();
    };
  }, []);

  const clearSurface = useCallback(() => observationSurface.clear(), []);

  return {
    events:    snapshot as UIEvent[],
    connected,
    clearSurface,
  };
}