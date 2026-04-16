// dashboard/mind/useAuthority.ts
// ─────────────────────────────────────────────────────────────
// Authority panel data — pending human approvals.
// Human is the Final Authority Node, not a "user".
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export interface PendingApproval {
  taskId:      string;
  intent:      string;
  risk:        string;
  reason:      string;
  requestedAt: number;
}

export function useAuthority(pollMs = 3000) {
  const [pending, setPending]     = useState<PendingApproval[]>([]);
  const [history, setHistory]     = useState<Array<PendingApproval & { approved: boolean; resolvedAt: number }>>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/ops');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data?.pendingApprovals)) {
          setPending(data.pendingApprovals);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const approve = useCallback(async (taskId: string) => {
    try {
      await fetch(`/api/authority/resolve`, {
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
      await fetch(`/api/authority/resolve`, {
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
