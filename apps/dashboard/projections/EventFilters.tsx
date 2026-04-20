// apps/dashboard/components/EventFilters.tsx
import React from 'react';
import { EventCategory, EventFilter } from '../events/events';

const PRESETS: { label: string; filter: Partial<EventFilter> }[] = [
  { label: 'All',       filter: { patterns: ['*'] } },
  { label: 'Task flow', filter: { categories: ['task'] } },
  { label: 'Thinking',  filter: { patterns: ['thinking.*', 'planning.*'] } },
  { label: 'Skills',    filter: { patterns: ['skill.*', 'aggregation.end'] } },
  { label: 'Memory',    filter: { categories: ['memory'] } },
  { label: 'Conscious', filter: { categories: ['conscious'] } },
  { label: 'Errors',    filter: { status: ['error', 'warn'] } },
];

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  task:       '#3b82f6',
  thinking:   '#8b5cf6',
  planning:   '#f59e0b',
  skill:      '#10b981',
  memory:     '#06b6d4',
  conscious:  '#ec4899',
  governance: '#f97316',
  system:     '#6b7280',
};

interface Props {
  active:        string;
  onChange:      (preset: string, filter: Partial<EventFilter>) => void;
  taskIds?:      string[];
  onTaskFilter?: (taskId: string | undefined) => void;
}

export const EventFilters: React.FC<Props> = ({ active, onChange, taskIds = [], onTaskFilter }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    {PRESETS.map(p => (
      <button key={p.label} onClick={() => onChange(p.label, p.filter)}
        style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
          border: '0.5px solid var(--border)', cursor: 'pointer',
          background: active === p.label ? 'var(--accent)' : 'var(--bg-elevated)',
          color:      active === p.label ? '#fff' : 'var(--text-secondary)',
          transition: 'background .15s, color .15s',
        }}>
        {p.label}
      </button>
    ))}
    {taskIds.length > 0 && (
      <select onChange={e => onTaskFilter?.(e.target.value || undefined)}
        style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 8,
          border: '0.5px solid var(--border)', background: 'var(--bg-elevated)',
          color: 'var(--text-secondary)', outline: 'none',
        }}>
        <option value="">All tasks</option>
        {taskIds.map(id => (
          <option key={id} value={id}>{id.slice(0, 28)}…</option>
        ))}
      </select>
    )}
  </div>
);
