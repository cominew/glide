// apps/dashboard/perspectives/LogsTab.tsx
// Now a thin wrapper — the real work is in EventViewer.
// LogsTab = EventViewer with default filter = all events, table mode.
import React from 'react';
import { EventViewer } from '../projections/EventViewer';
import { UIEvent, ReplaySession, EventFilter } from '../events/events';

interface Props {
  events:      UIEvent[];
  connected?:  boolean;
  getSession?: (taskId: string) => ReplaySession | null;
  onFilter?:   (f: EventFilter) => UIEvent[];
  onClear?:    () => void;
}

export default function LogsTab({ events, connected, getSession, onFilter, onClear }: Props) {
  return (
    <div style={{ height: 'calc(100vh - 12rem)' }}>
      <EventViewer
        events={events}
        connected={connected}
        getSession={getSession}
        onFilter={onFilter}
        onClear={onClear}
      />
    </div>
  );
}

// Re-export Log type for backward compat
export interface Log {
  id: string; timestamp: string; level: 'info'|'warn'|'error'; message: string;
}
