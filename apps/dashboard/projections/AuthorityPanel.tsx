// apps/dashboard/projections/AuthorityPanel.tsx
// Authority Panel — 纯投影层，只观察 authority.required 事件

import React, { useState, useCallback } from 'react';
import { api } from '../gateways/api';

interface Props {
  events?: any[];
}

const STORAGE_KEY = 'glide_authority_resolved';

function loadResolved(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveResolved(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export const AuthorityPanel: React.FC<Props> = ({ events = [] }) => {
  const [resolved, setResolved] = useState<Set<string>>(() => loadResolved());

  // 仅观察 authority.required 事件，而非所有 proposal.created
  const requiredEvents = events.filter(e => e.type === 'authority.required');
  const proposals = requiredEvents.map(e => e.payload?.proposal).filter(Boolean);

  const handleApprove = useCallback(async (proposalId: string) => {
    try {
      await api.signal({
        type: 'authority.resolved',
        proposalId,
        decision: 'approve'
      });
      setResolved(prev => {
        const next = new Set(prev).add(proposalId);
        saveResolved(next);
        return next;
      });
    } catch {}
  }, []);

  const handleReject = useCallback(async (proposalId: string) => {
    try {
      await api.signal({
        type: 'authority.resolved',
        proposalId,
        decision: 'reject'
      });
      setResolved(prev => {
        const next = new Set(prev).add(proposalId);
        saveResolved(next);
        return next;
      });
    } catch {}
  }, []);

  const visible = proposals.filter(p => !resolved.has(p.proposalId ?? p.id));

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Authority queue</div>
        {visible.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--danger)', color: '#fff' }}>
            {visible.length} pending
          </span>
        )}
      </div>
      {visible.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No decisions awaiting human judgment.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(p => (
            <div key={p.proposalId ?? p.id} style={{ border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>{p.title ?? 'Untitled proposal'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleApprove(p.proposalId ?? p.id)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Approve
                </button>
                <button onClick={() => handleReject(p.proposalId ?? p.id)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};