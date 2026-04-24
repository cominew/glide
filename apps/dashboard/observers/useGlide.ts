// apps/dashboard/observers/useGlide.ts
// ─────────────────────────────────────────────────────────────
// Glide v4 — Reality bridge (minimal)
//
// ONE EventSource. All components read from observationSurface.
// No taskId filtering at this layer — v4 uses eventId correlation.
// Filtering happens in consumer components.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { observationSurface }               from '../events/timeline';
import { UIEvent }                          from '../events/events';

// v4 blocked types — internal noise
const BLOCKED = new Set([
  'system.clock.pulse',
  'event.state_changed',
  'event.archived',
  'event.ttl_expired',
  'conscious.state.updated',
]);

function normalize(raw: any, forceType?: string): UIEvent | null {
  const type = forceType ?? raw.type;
  if (!type || BLOCKED.has(type)) return null;

  // v4 correlation: prefer trace.taskId, then payload.eventId
  const taskId =
    raw.trace?.taskId ??
    raw.payload?.taskId ??
    raw.payload?.eventId ??
    raw.payload?.id ??
    raw.taskId;

  const label = raw.payload?.skill
    ? `${type} · ${raw.payload.skill}`
    : type;

  return {
    id:        raw.id ?? `ui_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
    taskId,
    type,
    category:  'system',   // simplified — components can re-categorize
    timestamp: raw.timestamp ?? Date.now(),
    source:    raw.source,
    payload:   raw.payload,
    label,
    status:    type.includes('error') || type.includes('failed') ? 'error' : 'ok',
  };
}

const NAMED_EVENTS = [
  'input.user',
  'skill.matched', 'skill.executing', 'skill.output', 'skill.error',
  'skill.start', 'skill.end',
  'answer.final', 'answer.end', 'answer.partial',
  'task.completing', 'task.completed', 'task.failed', 'task.silent_complete',
  'task.routed', 'task.started', 'task.validated', 'task.created',
  'reasoning.step',
  'conscious.awakened', 'conscious.dissolved', 'conscious.reflection',
  'proposal.created', 'proposal.approved',
  'system.boot', 'cognition.capabilities.inferred',
];

export function useGlide() {
  const [snapshot, setSnapshot] = useState<readonly UIEvent[]>(
    () => observationSurface.getAll()
  );
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsubSurface = observationSurface.subscribe(events => {
      setSnapshot(events);
    });

    const es = new EventSource('/api/events/stream');
    es.onopen  = () => setConnected(true);
    es.onerror = () => setConnected(false);

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
      unsubSurface();
      for (const [t, h] of handlers) es.removeEventListener(t, h);
      es.close();
      setConnected(false);
    };
  }, []);

  const clearSurface = useCallback(() => observationSurface.clear(), []);

  return {
    events:    snapshot as UIEvent[],
    connected,
    clearSurface,
  };
}
