// apps/dashboard/arising/useAuthority.ts
// ─────────────────────────────────────────────────────────────
// Authority — event-driven, no polling
//
// Constitution compliance:
//   ✓ No setInterval (Article VI)
//   ✓ Refreshes only when task.awaiting_human arrives
//   ✓ Human authority is final — not continuously monitored
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { UIEvent } from '../events/events';

export interface PendingApproval {
  taskId:      string;
  intent:      string;
  risk:        string;
  reason:      string;
  requestedAt: number;
}

interface Props {
  events?: UIEvent[];
}

export function useAuthority({ events = [] }: Props = {}) {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [history, setHistory] = useState<Array<PendingApproval & { approved: boolean; resolvedAt: number }>>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/ops');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data?.vitals?.pendingApproval !== undefined ? [] : [])) {
          // /api/ops returns vitals.pendingApproval count, not the list
          // For actual pending items, check humanGate endpoint
        }
      }
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // React only when task.awaiting_human or related events arrive
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    if (
      last.type === 'task.awaiting_human' ||
      last.type === 'task.blocked'
    ) {
      // Refresh pending list when human gate fires
      load();

      if (last.type === 'task.awaiting_human' && last.taskId) {
        const newItem: PendingApproval = {
          taskId:      last.taskId,
          intent:      last.payload?.intent ?? '',
          risk:        last.payload?.policyDecision?.risk ?? 'medium',
          reason:      last.payload?.policyDecision?.reason ?? 'Human approval required',
          requestedAt: last.timestamp,
        };
        setPending(prev => {
          if (prev.some(p => p.taskId === last.taskId)) return prev;
          return [...prev, newItem];
        });
      }
    }
  }, [events, load]);

  const approve = useCallback(async (taskId: string) => {
    try {
      await fetch('/api/authority/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, approved: true }),
      });
      const item = pending.find(p => p.taskId === taskId);
      if (item) {
        setPending(prev => prev.filter(p => p.taskId !== taskId));
        setHistory(prev => [...prev, { ...item, approved: true, resolvedAt: Date.now() }]);
      }
    } catch {}
  }, [pending]);

  const reject = useCallback(async (taskId: string) => {
    try {
      await fetch('/api/authority/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, approved: false }),
      });
      const item = pending.find(p => p.taskId === taskId);
      if (item) {
        setPending(prev => prev.filter(p => p.taskId !== taskId));
        setHistory(prev => [...prev, { ...item, approved: false, resolvedAt: Date.now() }]);
      }
    } catch {}
  }, [pending]);

  return { pending, history, approve, reject };
}
