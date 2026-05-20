// apps/dashboard/projections/AgendaPanel.tsx
import React, { useMemo } from 'react';

interface Props {
  events?: any[];
}

const IGNORED_TITLES = new Set(['System ready', 'Glide cognitive field is now active.']);

export const AgendaPanel: React.FC<Props> = ({ events = [] }) => {
  const items = useMemo(() => {
    const proposals = events.filter(e => e.type === 'proposal.arisen' || e.type === 'proposal.created');
    const collapsedIds = new Set(
      events.filter(e => e.type === 'reality.collapsed').map(e => e.payload?.proposalId)
    );

    return proposals
      .map(e => e.payload?.proposal ?? e.payload)
      .filter(p => p && !IGNORED_TITLES.has(p.title) && !collapsedIds.has(p.proposalId))
      .slice(-10);
  }, [events]);

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Agenda</div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          The causal field is at rest.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => (
            <div key={item.proposalId ?? i} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
              {item.description && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};