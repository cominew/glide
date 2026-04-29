// apps/dashboard/projections/ConsciousPanel.tsx
// ─────────────────────────────────────────────────────────────
// Conscious Panel — event-derived projection
//
// "你未看此花时，此花与汝心同归于寂"
//
// This panel shows what is happening NOW.
// When nothing is happening, the panel shows nothing.
// There is no persistent "mind state".
// There is no subject.
//
// Data source: UIEvent stream (conscious.awakened / conscious.dissolved)
// No polling. No persistent state hook. No mind object.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { UIEvent } from '../events/events';

interface Props {
  events: UIEvent[];
}

export const ConsciousPanel: React.FC<Props> = ({ events }) => {
  // Derive the current state from recent events — no stored state
  const state = useMemo(() => {
    const relevant = events
      .filter(e => e.type === 'conscious.awakened' || e.type === 'conscious.dissolved')
      .slice(-10);

    const last = relevant[relevant.length - 1];
    if (!last) return { active: false, intent: '', dissolvedAt: null as number | null };

    if (last.type === 'conscious.awakened') {
      return {
        active: true,
        intent: (last.payload?.intent ?? '').slice(0, 80),
        dissolvedAt: null,
      };
    }

    // conscious.dissolved — show briefly then go silent
    return {
      active:      false,
      intent:      '',
      anomaly:     last.payload?.anomaly ?? false,
      dissolvedAt: last.timestamp,
    };
  }, [events]);

  // Derive the current task in progress
  const activeTask = useMemo(() => {
    const started   = events.filter(e => e.type === 'task.started');
    const completed = new Set(
      events.filter(e => e.type === 'task.completed' || e.type === 'task.failed')
        .map(e => e.taskId)
    );
    const inFlight = started.filter(e => e.taskId && !completed.has(e.taskId));
    return inFlight[inFlight.length - 1] ?? null;
  }, [events]);

  // Elapsed since last event
  const lastEvent = events[events.length - 1];
  const elapsedSec = lastEvent
    ? Math.round((Date.now() - lastEvent.timestamp) / 1000)
    : null;

  // Silence state — nothing happening
  if (!state.active && !activeTask) {
    return (
      <div style={{
        background:'var(--card-bg)', border:'0.5px solid var(--border)',
        borderRadius:14, padding:'18px 20px',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--text-muted)' }}/>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Idle</span>
          </div>
          {elapsedSec !== null && (
            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>
              {elapsedSec < 5 ? 'just now' : `${elapsedSec}s ago`}
            </span>
          )}
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
          Waiting for conditions to arise...
        </div>
      </div>
    );
  }

  // Active task — show what's processing
  const taskQuery = activeTask?.payload?.query ?? '';

  return (
    <div style={{
      background:'var(--card-bg)', border:'0.5px solid var(--border)',
      borderRadius:14, padding:'18px 20px', display:'flex', flexDirection:'column', gap:12,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ position:'relative', width:10, height:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--success)' }}/>
            <div style={{
              position:'absolute', top:0, left:0, width:10, height:10,
              borderRadius:'50%', background:'var(--success)', opacity:.4,
              animation:'ripple 1.4s ease-out infinite',
            }}/>
          </div>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--success)' }}>Processing</span>
        </div>
        <style>{`@keyframes ripple{0%{transform:scale(1);opacity:.4}100%{transform:scale(2.6);opacity:0}}`}</style>
      </div>

      {taskQuery && (
        <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.4 }}>
          "{taskQuery.slice(0, 80)}{taskQuery.length > 80 ? '…' : ''}"
        </div>
      )}

      {/* Recent cognitive events as plain facts, no subject */}
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {events
          .filter(e => e.taskId === activeTask?.taskId)
          .slice(-4)
          .map(e => {
            const sentence = eventToNarrativeSentence(e);
            if (!sentence) return null;
            return (
              <div key={e.id} style={{
                fontSize:11, color:'var(--text-muted)', fontFamily:'monospace',
              }}>
                {sentence}
              </div>
            );
          })
          .filter(Boolean)
        }
      </div>
    </div>
  );
};

// Pure function — no subject, no self
function eventToNarrativeSentence(e: UIEvent): string | null {
  switch (e.type) {
    case 'thinking.end': {
      const t = (e.payload?.thinking ?? '').slice(0, 60);
      return t ? `Reasoned: "${t}…"` : null;
    }
    case 'planning.end': {
      const skills = (e.payload?.steps ?? []).map((s:any)=>s.skill).join(', ');
      return skills ? `Plan: ${skills}` : null;
    }
    case 'skill.start': return `Running ${e.payload?.skill}`;
    case 'skill.end':   return `${e.payload?.skill} complete`;
    case 'skill.error': return `${e.payload?.skill ?? 'Skill'} error`;
    default:            return null;
  }
}
