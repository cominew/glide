// apps/dashboard/projections/StatCard.tsx
import React from 'react';

const ACCENT: Record<string, { icon: string; value: string; badge: string }> = {
  blue:    { icon: 'rgba(59,130,246,0.12)',  value: '#3b82f6', badge: 'rgba(59,130,246,0.1)' },
  emerald: { icon: 'rgba(16,185,129,0.12)',  value: '#10b981', badge: 'rgba(16,185,129,0.1)' },
  amber:   { icon: 'rgba(245,158,11,0.12)',  value: '#f59e0b', badge: 'rgba(245,158,11,0.1)' },
  purple:  { icon: 'rgba(139,92,246,0.12)',  value: '#8b5cf6', badge: 'rgba(139,92,246,0.1)' },
  coral:   { icon: 'rgba(239,68,68,0.12)',   value: '#ef4444', badge: 'rgba(239,68,68,0.1)' },
};

export const StatCard: React.FC<{
  label:  string;
  value:  string | number;
  icon:   React.ReactElement;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'coral';
  sub?:   string;
}> = ({ label, value, icon, color = 'blue', sub }) => {
  const c = ACCENT[color];
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '0.5px solid var(--border)',
      borderRadius: 14,
      padding: '18px 20px',
      transition: 'border-color .15s',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: c.icon,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: c.value, marginBottom: 14,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
};
