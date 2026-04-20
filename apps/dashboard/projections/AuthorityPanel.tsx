// panels/AuthorityPanel.tsx
// ─────────────────────────────────────────────────────────────
// Human Authority Panel.
// Human is not a "user". Human is the Final Authority Node.
// Glide pauses and waits. This panel makes that visible.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';

interface PendingApproval {
  taskId:      string;
  intent:      string;
  risk:        string;
  reason:      string;
  requestedAt: number;
}

const RISK_COLOR: Record<string, string> = {
  high:   'var(--danger)',
  medium: 'var(--warning)',
  low:    'var(--success)',
};

export const AuthorityPanel: React.FC = () => {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [history, setHistory] = useState<Array<PendingApproval & { approved: boolean; resolvedAt: number }>>([]);

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
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

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

  const elapsed = (ts: number) => {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60)  return `${s}s ago`;
    if (s < 3600) return `${Math.round(s/60)}m ago`;
    return `${Math.round(s/3600)}h ago`;
  };

  return (
    <div style={{ background:'var(--card-bg)', border:'0.5px solid var(--border)', borderRadius:14, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Authority queue</div>
        {pending.length > 0 && (
          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10, background:'var(--danger)', color:'#fff' }}>
            {pending.length} pending
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div style={{ padding:'16px 0', textAlign:'center', fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
          No decisions awaiting human judgment.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:history.length ? 16 : 0 }}>
          {pending.map(p => (
            <div key={p.taskId} style={{ border:'0.5px solid var(--border)', borderRadius:10, padding:'12px 14px', background:'var(--bg-elevated)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4,
                  background: RISK_COLOR[p.risk] + '18', color: RISK_COLOR[p.risk] }}>
                  {p.risk.toUpperCase()} RISK
                </span>
                <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>
                  {elapsed(p.requestedAt)}
                </span>
              </div>
              <div style={{ fontSize:13, color:'var(--text-primary)', marginBottom:4, lineHeight:1.4 }}>
                {p.intent.slice(0, 100)}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>{p.reason}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => approve(p.taskId)}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', background:'var(--success)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  ✓ Approve
                </button>
                <button onClick={() => reject(p.taskId)}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:'0.5px solid var(--border)', background:'transparent', color:'var(--danger)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Recent decisions</div>
          {history.slice(-3).reverse().map((h, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'5px 0', borderBottom:'0.5px solid var(--border)', fontSize:12 }}>
              <span style={{ color: h.approved ? 'var(--success)' : 'var(--danger)', fontWeight:700, flexShrink:0 }}>
                {h.approved ? '✓' : '✕'}
              </span>
              <span style={{ color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {h.intent.slice(0, 60)}
              </span>
              <span style={{ color:'var(--text-muted)', flexShrink:0 }}>{elapsed(h.resolvedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
