// apps/dashboard/projections/ConsciousPanel.tsx
import React, { useMemo } from 'react';
import { UIEvent } from '../events/events';

interface PhenomenalState {
  dot:         string;
  headline:    string;
  narrative:   string;
  subtext?:    string;
  eventTime:   number | null;
}

const IDLE: PhenomenalState = {
  dot:       'var(--text-muted)',
  headline:  'At rest',
  narrative: 'The field is silent. Waiting for a boundary to arise.',
  eventTime: null,
};

function describeEvent(e: UIEvent): PhenomenalState | null {
  const p = e.payload ?? {};

  switch (e.type) {
    case 'mind.aware':
      return { dot: '#60a5fa', headline: 'Awakened', narrative: 'A disturbance has entered the field.', subtext: p.cause?.slice(0, 60), eventTime: e.timestamp };
    case 'awareness.disturbance':
      return { dot: '#f59e0b', headline: 'Perturbed', narrative: 'Something has broken the silence.', subtext: p.summary?.slice(0, 60), eventTime: e.timestamp };
    case 'awareness.skill_arising': {
      const names: Record<string, string> = {
        'name-disambiguation': 'An identity is being recognized',
        'profile-fetcher': 'Memory is being retrieved',
        'persona-summary': 'A portrait is taking shape',
        'reasoning': 'Deeper understanding is forming',
        'sales': 'Transaction patterns are being read',
      };
      return { dot: '#818cf8', headline: 'Arising', narrative: (names[p.skill] ?? `A capability is manifesting`) + '.', subtext: p.skill, eventTime: e.timestamp };
    }
    case 'resonance.observed':
      if ((p.fragmentCount ?? 0) === 0) return null;
      return { dot: '#a78bfa', headline: 'Resonating', narrative: 'Fragments of reality are connecting.', subtext: p.skill, eventTime: e.timestamp };
    case 'entity.anchor.created':
      return { dot: '#34d399', headline: 'Identity anchored', narrative: 'A presence has become clear in the field.', subtext: p.entity, eventTime: e.timestamp };
    case 'mind.settling':
      return { dot: '#60a5fa', headline: 'Settling', narrative: 'The causal storm is calming.', eventTime: e.timestamp };
    case 'answer.projected':
      return { dot: '#34d399', headline: 'Projected', narrative: 'Understanding has crystallized.', eventTime: e.timestamp };
    case 'answer.manifested':
      return { dot: '#34d399', headline: 'Manifested', narrative: 'An answer has become visible.', subtext: p.narrative?.slice(0, 80), eventTime: e.timestamp };
    case 'answer.ready':
      return { dot: '#34d399', headline: 'Manifested', narrative: 'The field has collapsed into observable form.', eventTime: e.timestamp };
    case 'mind.state.entered':
      if (p.state === 'settled') return { dot: '#34d399', headline: 'Settled', narrative: 'The cognitive cycle has completed.', eventTime: e.timestamp };
      return null;
    case 'causality.closed':
      return { dot: '#34d399', headline: 'Closed', narrative: 'The causal chain has reached its conclusion.', eventTime: e.timestamp };
    case 'reality.updated':
      return { dot: '#34d399', headline: 'Reality updated', narrative: 'The causal field has reconfigured.', eventTime: e.timestamp };
    case 'reality.conflict':
      return { dot: '#f87171', headline: 'Conflicted', narrative: 'Multiple realities are competing.', subtext: (p.surfaces ?? []).join(' vs '), eventTime: e.timestamp };
    case 'cognition.anomaly.detected':
      if (p.subtype === 'non_resonant_field_vacuum') return null;
      return { dot: '#fbbf24', headline: 'Concerned', narrative: (p.anomalies ?? [])[0] ?? 'A quality issue was noticed.', eventTime: e.timestamp };
    case 'authority.required':
      return { dot: '#fbbf24', headline: 'Awaiting', narrative: 'A decision requires human presence.', subtext: p.proposal?.title, eventTime: e.timestamp };
    case 'observer.feedback':
    case 'observer.feedback.recorded':
      return { dot: '#c084fc', headline: 'Observed again', narrative: 'The observer has re-entered the field.', subtext: p.note?.slice(0, 60), eventTime: e.timestamp };
    case 'proposal.created':
      return { dot: '#60a5fa', headline: 'Proposal arose', narrative: p.title ?? 'A new proposal emerged.', eventTime: e.timestamp };
    case 'reflection.created':
      return { dot: '#a78bfa', headline: 'Reflection', narrative: p.observation ?? 'A reflection occurred.', eventTime: e.timestamp };
    default:
      return null;
  }
}

export const ConsciousPanel: React.FC<{ events: UIEvent[] }> = ({ events }) => {
  const state = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const d = describeEvent(events[i]);
      if (d) return d;
    }
    return IDLE;
  }, [events]);

  const elapsedSec = state.eventTime !== null ? Math.round((Date.now() - state.eventTime) / 1000) : null;
  const elapsedLabel = elapsedSec === null ? null : elapsedSec < 5 ? 'just now' : elapsedSec < 60 ? `${elapsedSec}s ago` : `${Math.round(elapsedSec / 60)}m ago`;

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: state.dot, boxShadow: state.dot !== 'var(--text-muted)' ? `0 0 6px ${state.dot}` : 'none' }} />
          <span style={{ fontSize: 12, color: state.dot, fontWeight: 700 }}>{state.headline}</span>
        </div>
        {elapsedLabel && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{elapsedLabel}</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic' }}>{state.narrative}</div>
      {state.subtext && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.subtext}</div>}
    </div>
  );
};