// apps/dashboard/projections/ReflectionPanel.tsx
import React, { useMemo } from 'react';

interface Props {
  events?: any[];
}

export const ReflectionPanel: React.FC<Props> = ({ events = [] }) => {
  const reflections = useMemo(() => {
    return events
      .filter(e => e.type === 'reflection.created')
      .map(e => ({
        id: e.id,
        observation: e.payload?.observation ?? '',
        timestamp: e.timestamp,
      }))
      .filter(r => r.observation && r.observation !== 'Reality stabilized.')
      .slice(-20);
  }, [events]);

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Reflections</div>
      {reflections.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No reflections yet.
        </div>
      ) : (
        reflections.map(r => (
          <div key={r.id} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {r.observation}
          </div>
        ))
      )}
    </div>
  );
};