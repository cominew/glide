// dashboard/mind/useReflection.ts
// ─────────────────────────────────────────────────────────────
// What Glide learned — visible learning makes AI trustworthy.
// Subscribes to conscious.reflection events from the stream.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export interface ReflectionEntry {
  id:          string;
  observedAt:  number;
  eventType:   string;
  taskId?:     string;
  observation: string;
  anomaly:     boolean;
}

export function useReflection(streamUrl = '/api/events/stream', maxItems = 50) {
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);
  const [anomalies,   setAnomalies]   = useState<ReflectionEntry[]>([]);

  useEffect(() => {
    // Load historical reflections
    fetch('/api/ops')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.reflections)) {
          setReflections(data.reflections.slice(-maxItems));
          setAnomalies(data.reflections.filter((r: ReflectionEntry) => r.anomaly));
        }
      })
      .catch(() => {});

    // Subscribe to live reflections
    const es = new EventSource(streamUrl);

    const handler = (e: MessageEvent) => {
      try {
        const event  = JSON.parse(e.data);
        const payload = event.payload;
        if (!payload) return;

        const entry: ReflectionEntry = {
          id:          payload.id     ?? `r_${Date.now()}`,
          observedAt:  payload.observedAt ?? Date.now(),
          eventType:   payload.eventType  ?? 'conscious.reflection',
          taskId:      payload.taskId,
          observation: payload.observation ?? '',
          anomaly:     payload.anomaly ?? false,
        };

        setReflections(prev => {
          const next = [...prev, entry];
          return next.length > maxItems ? next.slice(-maxItems) : next;
        });

        if (entry.anomaly) {
          setAnomalies(prev => [...prev.slice(-20), entry]);
        }
      } catch {}
    };

    es.addEventListener('conscious.reflection', handler);
    return () => {
      es.removeEventListener('conscious.reflection', handler);
      es.close();
    };
  }, [streamUrl, maxItems]);

  const clear = useCallback(() => {
    setReflections([]);
    setAnomalies([]);
  }, []);

  return { reflections, anomalies, clear };
}
