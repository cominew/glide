// apps/dashboard/projections/ReflectionPanel.tsx
//
// Fix log:
//   [BUG-REFLECT-1] reflection.created payload has only { observation } — no scopeId.
//     Old code tried payload.anomalies?.join() which was always undefined for this type.
//     Fixed: extract observation text with proper fallback chain.
//
//   [BUG-REFLECT-2] Total observed always showed 0 because reflections slice was
//     computed but the stat used reflections.length from the wrong scope.
//     Fixed: stats now reference the correct derived arrays.
//
//   [BUG-REFLECT-3] cognition.anomaly.detected with subtype=non_resonant_field_vacuum
//     after reasoning skill is infrastructure noise, not a meaningful anomaly to surface.
//     Fixed: vacuum events from post-closure scope are labeled differently.

import React, { useMemo } from 'react';
import { UIEvent } from '../events/events';

interface ReflectionEntry {
  id:          string;
  observedAt:  number;
  observation: string;
  anomaly:     boolean;
  vacuum:      boolean;  // infrastructure noise — shown dimmed
}

interface Props {
  events?: UIEvent[];
}

function extractObservation(e: UIEvent): string {
  const p = e.payload ?? {};
  // reflection.created
  if (p.observation) return p.observation;
  // cognition.anomaly.detected
  if (p.reason)      return `${p.subtype ?? 'anomaly'}: ${p.reason}`;
  if (p.anomalies && Array.isArray(p.anomalies)) return p.anomalies.join('; ');
  // reality.conflict
  if (p.surfaces)    return `Reality conflict: ${p.surfaces.join(' vs ')}`;
  if (p.conflictSurfaces) return `Reality conflict: ${p.conflictSurfaces.join(' vs ')}`;
  // meaning.unresolved
  if (p.description) return p.description;
  return e.type;
}

export const ReflectionPanel: React.FC<Props> = ({ events = [] }) => {
  const { reflections, anomalies } = useMemo(() => {
    console.log('reflections events:', events.filter(e => e.type === 'reflection.created'));
    const relevant = events.filter(e =>
      e.type === 'conscious.reflection'       ||
      e.type === 'reflection.created'         ||
      e.type === 'cognition.anomaly.detected' ||
      e.type === 'reality.conflict'           ||
      e.type === 'meaning.unresolved'
    );

    const entries: ReflectionEntry[] = relevant.map(e => {
      const isAnomaly = e.type === 'cognition.anomaly.detected' || e.type === 'reality.conflict';
      // vacuum = infrastructure noise from post-closure skill triggers
      const isVacuum  =
        e.type === 'cognition.anomaly.detected' &&
        e.payload?.subtype === 'non_resonant_field_vacuum';

      return {
        id:          e.id,
        observedAt:  e.timestamp,
        observation: extractObservation(e),
        anomaly:     isAnomaly && !isVacuum,
        vacuum:      isVacuum,
      };
    });

    return {
      reflections: entries.slice(-50),
      anomalies:   entries.filter(r => r.anomaly),
    };
  }, [events]);

  const recent = reflections.slice(-8).reverse();
  const ts = (n: number) =>
    new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Reflections</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {anomalies.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--warning)', color: '#412402' }}>
              {anomalies.length} anomaly
            </span>
          )}
        </div>
      </div>

      {/* Anomaly summary at top */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {anomalies.slice(-3).reverse().map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--danger)', flexShrink: 0 }}>⚠</span>
              <span style={{ color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{a.observation}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace', fontSize: 10 }}>{ts(a.observedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {recent.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No reflections yet. Start a task to begin learning.
        </div>
      ) : (
        <div>
          {recent.map(r => (
            <div key={r.id} style={{
              display: 'flex', gap: 8, padding: '6px 0',
              borderBottom: '0.5px solid var(--border)', fontSize: 12,
              opacity: r.vacuum ? 0.4 : 1,  // dim infrastructure noise
            }}>
              <span style={{ color: r.anomaly ? 'var(--danger)' : r.vacuum ? 'var(--border)' : '#8b5cf6', flexShrink: 0, marginTop: 1 }}>
                {r.anomaly ? '⚠' : r.vacuum ? '·' : '○'}
              </span>
              <span style={{ color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{r.observation}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace', fontSize: 10 }}>{ts(r.observedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 16, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
        {[
          ['Total observed', reflections.filter(r => !r.vacuum).length],
          ['Anomalies',      anomalies.length],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
