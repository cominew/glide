// apps/dashboard/projections/AuthorityPanel.tsx
import React, { useMemo, useCallback } from 'react';
import { api } from '../gateways/api';

interface Props {
  events: any[];
}

export const AuthorityPanel: React.FC<Props> = ({ events = [] }) => {
  const resolvedIds = useMemo(() => {
    return new Set(
      events
        .filter(e => e.type === 'authority.resolved' || e.type === 'reality.collapsed')
        .map(e => e.payload.proposalId)
    );
  }, [events]);

  const pendingProposals = useMemo(() => {
    return events
      .filter(e => e.type === 'authority.required')
      .map(e => e.payload)
      .filter(p => p?.proposalId && !resolvedIds.has(p.proposalId));
  }, [events, resolvedIds]);

  const recentDecisions = useMemo(() => {
    const resolved = events
      .filter(e => e.type === 'authority.resolved' || e.type === 'reality.collapsed')
      .map(e => e.payload)
      .filter(p => p.proposalId);
    return resolved.map(r => {
      const original = events.find(e => e.payload?.proposalId === r.proposalId);
      return {
        proposalId: r.proposalId,
        title: original?.payload?.title ?? r.proposalId,
        decision: r.decision,
        resolvedAt: r.collapsedAt ?? r.timestamp,
      };
    }).slice(-5).reverse();
  }, [events]);

  const HUMAN_READABLE_TITLES: Record<string, string> = {
  'Anomaly detected in previous response': 'The last answer may require attention.',
  'Capability vacuum detected': 'The system currently lacks the ability to answer that query.',
  // 可以根据实际出现的 title 继续添加
};

  const handleDecision = useCallback(async (proposalId: string, decision: string) => {
    await api.signal({ type: 'authority.resolved', proposalId, decision });
  }, []);

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Authority queue</div>
        {pendingProposals.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--danger)', color: '#fff' }}>
            {pendingProposals.length} pending
          </span>
        )}
      </div>

      {pendingProposals.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No decisions awaiting human judgment.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingProposals.map(p => (
            <div key={p.proposalId} style={{ border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg-elevated)' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                  {p.title ?? 'Untitled proposal'}
                </div>
                {p.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {p.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDecision(p.proposalId, 'approve')}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Approve
                </button>
                <button onClick={() => handleDecision(p.proposalId, 'reject')}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recentDecisions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Recent</div>
          {recentDecisions.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid var(--border)', fontSize: 11, opacity: 0.7 }}>
              <span style={{ color: d.decision === 'approve' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, flexShrink: 0 }}>
                {d.decision === 'approve' ? '✓ Approved' : '✕ Rejected'}
              </span>
              <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};