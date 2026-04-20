// tabs/OperationsTab.tsx  (renamed conceptually: Mind Surface)
// ─────────────────────────────────────────────────────────────
// The Externalized Cortex.
// Not a control panel. A mind visualization surface.
// Assembled from the five conscious panels.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { ConsciousPanel }  from '../projections/ConsciousPanel';
import { AgendaPanel }     from '../projections/AgendaPanel';
import { AuthorityPanel }  from '../projections/AuthorityPanel';
import { ReflectionPanel } from '../projections/ReflectionPanel';
import { EventViewer }     from '../projections/EventViewer';
import { UIEvent, ReplaySession, EventFilter } from '../events/events';

interface Props {
  events?:     UIEvent[];
  connected?:  boolean;
  getSession?: (id: string) => ReplaySession | null;
  onFilter?:   (f: EventFilter) => UIEvent[];
}

export const OperationsTab: React.FC<Props> = ({ events = [], connected, getSession, onFilter }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-muted)' }}>
      Mind surface
    </div>

    {/* Row 1: Conscious state (full width) */}
    <ConsciousPanel events={events} />

    {/* Row 2: Agenda + Authority */}
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
      <AgendaPanel />
      <AuthorityPanel />
    </div>

    {/* Row 3: Event stream + Reflection */}
    <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14 }}>
      <div style={{ height:340, border:'0.5px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <EventViewer
          events={events}
          connected={connected}
          getSession={getSession}
          onFilter={onFilter}
          embedded
        />
      </div>
      <ReflectionPanel />
    </div>

  </div>
);
