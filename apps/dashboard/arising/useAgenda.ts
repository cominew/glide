// dashboard/mind/useAgenda.ts
// ─────────────────────────────────────────────────────────────
// Agenda = things Glide wants human attention on.
// Polls /api/ops/agenda. When AgendaManager is implemented
// on the backend, this will become a live subscription.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export type AgendaTagType = 'approval' | 'suggest' | 'risk' | 'info' | 'learning';

export interface AgendaItem {
  id:       string;
  stars:    number;           // 1–4 urgency
  text:     string;
  tag:      string;
  tagType:  AgendaTagType;
  taskId?:  string;
  since:    number;
}

// Seed items to show before the backend generates real ones.
// These will disappear once /api/ops returns real agenda data.
const SEED_AGENDA: AgendaItem[] = [
  {
    id: 'seed-1', stars: 3, tagType: 'info',
    text: 'Agenda engine not yet active — start an AI task to generate agenda items',
    tag: 'System', since: Date.now(),
  },
];

export function useAgenda(pollMs = 5000) {
  const [items, setItems]     = useState<AgendaItem[]>(SEED_AGENDA);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/ops');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data?.agenda) && data.agenda.length > 0) {
          setItems(data.agenda);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const bump = useCallback((id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, stars: Math.min(4, i.stars + 1) } : i)
      .sort((a, b) => b.stars - a.stars));
  }, []);

  return { items, loading, dismiss, bump };
}
