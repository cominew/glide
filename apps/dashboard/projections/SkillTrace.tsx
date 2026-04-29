// apps/dashboard/projections/SkillTrace.tsx
import React from 'react';

export const SkillTrace: React.FC<{ skillName: string }> = ({ skillName }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: 'var(--text-muted)',
    background: 'var(--tag-bg)', borderRadius: 6, padding: '2px 8px',
    border: '0.5px solid var(--border)',
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
    <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{skillName}</span>
  </span>
);
