// apps/dashboard/arising/useAgenda.ts
// ─────────────────────────────────────────────────────────────
// Agenda — event-driven, no polling
//
// Constitution compliance:
//   ✓ No setInterval (Article VI)
//   ✓ Data refreshes only when relevant events arrive
//   ✓ Initial load on mount only
//
// Refreshes when:
//   - proposal.created event arrives (new agenda item appeared)
//   - task.completed event arrives (agenda may have updated)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { UIEvent } from '../events/events';

export type AgendaTagType = 'approval' | 'suggest' | 'risk' | 'info' | 'learning';

export interface AgendaItem {
  id:      string;
  stars:   number;
  text:    string;
  tag:     string;
  tagType: AgendaTagType;
  taskId?: string;
  since:   number;
}

const SEED: AgendaItem[] = [{
  id: 'seed-1', stars: 3, tagType: 'info',
  text: 'Agenda engine not yet active — start an AI task to generate agenda items',
  tag: 'System', since: Date.now(),
}];

interface Props {
  events?: UIEvent[];   // pass global events from useGlide
}

export function useAgenda({ events = [] }: Props = {}) {
  const [items,   setItems]   = useState<AgendaItem[]>(SEED);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/ops');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data?.pendingProposals) && data.pendingProposals.length > 0) {
          setItems(data.pendingProposals.map((p: any) => ({
            id:      p.id,
            stars:   p.impact === 'high' ? 4 : p.impact === 'medium' ? 3 : 2,
            text:    p.title,
            tag:     p.category,
            tagType: p.category === 'healing' ? 'risk' : 'suggest',
            since:   Date.now(),
          })));
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Reload when proposal or task events arrive — not on timer
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    if (
      last.type === 'proposal.created' ||
      last.type === 'proposal.approved' ||
      last.type === 'task.completed'
    ) {
      load();
    }
  }, [events, load]);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const bump = useCallback((id: string) => {
  setItems(prev => {
    const idx = prev.findIndex(item => item.id === id);
    if (idx === -1) return prev;
    const item = prev[idx];
    const newItems = [...prev];
    newItems.splice(idx, 1);
    newItems.unshift({ ...item, stars: Math.min(item.stars + 1, 4) }); // 提升优先级
    return newItems;
  });
}, []);

return { items, loading, dismiss, bump };
}
