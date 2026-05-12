// apps/dashboard/perspectives/OperationsTab.tsx
//
// Now uses unified useProjection hook.
// All panels read from a single RealityProjection — one collapse, one truth.

import React, { useState } from 'react';
import { EventViewer }     from '../projections/EventViewer';
import {
  ConsciousPanel,
  AgendaPanel,
  AuthorityPanel,
  ReflectionPanel,
} from '../projections/ProjectionPanels';
import { useProjection }   from '../arising/useProjection';
import { UIEvent, ReplaySession, EventFilter } from '../events/events';

interface Props {
  events?:     UIEvent[];
  connected?:  boolean;
  getSession?: (id: string) => ReplaySession | null;
  onFilter?:   (f: EventFilter) => UIEvent[];
}

export const OperationsTab: React.FC<Props> = ({ events = [], connected, getSession, onFilter }) => {
  // ⭐ Single Observer Collapse — one projection for all panels
  const projection = useProjection(events);

  // Local dismiss state for agenda items (UI-only — doesn't affect causal field)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const filteredProjection = {
    ...projection,
    agenda: projection.agenda.filter(item => !dismissed.has(item.id)),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Mind surface
      </div>

      {/* Cognitive state — reads projection.cognitive */}
      <ConsciousPanel projection={filteredProjection} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Agenda — reads projection.agenda */}
        <AgendaPanel
          projection={filteredProjection}
          onDismiss={(id) => setDismissed(prev => new Set([...prev, id]))}
        />

        {/* Authority — reads projection.proposals */}
        <AuthorityPanel projection={filteredProjection} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <div style={{ height: 340, border: '0.5px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <EventViewer
            events={events}
            connected={connected}
            getSession={getSession}
            onFilter={onFilter}
            embedded
          />
        </div>

        {/* Reflections — reads projection.reflections */}
        <ReflectionPanel projection={filteredProjection} />
      </div>
    </div>
  );
};
