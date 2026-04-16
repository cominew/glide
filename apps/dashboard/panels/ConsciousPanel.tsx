// panels/ConsciousPanel.tsx
// ─────────────────────────────────────────────────────────────
// What Glide is thinking right now.
// Not health. Not status. Consciousness.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useConsciousState, PHASE_LABEL, PHASE_COLOR } from '../mind/useConsciousState';

// ── Cognitive load bar ────────────────────────────────────────

const LoadBar: React.FC<{ value: number }> = ({ value }) => {
  const pct   = Math.round(value * 100);
  const color = value > 0.8 ? 'var(--danger)' : value > 0.5 ? 'var(--warning)' : 'var(--success)';
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Cognitive load</span>
        <span style={{ fontSize:10, fontFamily:'monospace', color }}>{pct}%</span>
      </div>
      <div style={{ height:3, background:'var(--bg-overlay)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width .6s ease, background .4s' }} />
      </div>
    </div>
  );
};

// ── Typewriter for thought ────────────────────────────────────

const Thought: React.FC<{ text: string }> = ({ text }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    let i = 0;
    setDisplayed('');
    const id = setInterval(() => {
      if (i >= text.length) { clearInterval(id); return; }
      setDisplayed(text.slice(0, ++i));
    }, 18);
    return () => clearInterval(id);
  }, [text]);

  if (!displayed) return null;
  return (
    <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, fontStyle:'italic', borderLeft:'2px solid #8b5cf6', paddingLeft:10, marginTop:2 }}>
      {displayed}
      {displayed.length < text.length && <span style={{ color:'#8b5cf6', animation:'blink 1s step-end infinite' }}>|</span>}
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
};

// ── Phase indicator ───────────────────────────────────────────

const PhaseIndicator: React.FC<{ phase: string }> = ({ phase }) => {
  const color  = PHASE_COLOR[phase as keyof typeof PHASE_COLOR] ?? 'var(--text-muted)';
  const label  = PHASE_LABEL[phase as keyof typeof PHASE_LABEL] ?? phase;
  const active = phase !== 'idle';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ position:'relative', width:10, height:10 }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:color }} />
        {active && (
          <div style={{
            position:'absolute', top:0, left:0, width:10, height:10,
            borderRadius:'50%', background:color, opacity:.4,
            animation:'ripple 1.4s ease-out infinite',
          }} />
        )}
      </div>
      <span style={{ fontSize:12, fontWeight:600, color }}>{label}</span>
      <style>{`@keyframes ripple{0%{transform:scale(1);opacity:.4}100%{transform:scale(2.6);opacity:0}}`}</style>
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────

export const ConsciousPanel: React.FC = () => {
  const state   = useConsciousState();
  const elapsed = Math.round((Date.now() - state.updatedAt) / 1000);

  return (
    <div style={{ background:'var(--card-bg)', border:'0.5px solid var(--border)', borderRadius:14, padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>

      {/* Phase */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <PhaseIndicator phase={state.phase} />
        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>
          {elapsed < 5 ? 'just now' : `${elapsed}s ago`}
        </span>
      </div>

      {/* Focus */}
      <div>
        <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Current focus</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', lineHeight:1.4 }}>
          {state.focus}
        </div>
      </div>

      {/* Thought */}
      {state.thought && (
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Thinking</div>
          <Thought text={state.thought} />
        </div>
      )}

      {/* Active goal */}
      {state.activeGoal && (
        <div style={{ background:'var(--accent-dim)', borderRadius:8, padding:'8px 12px' }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Active goal</div>
          <div style={{ fontSize:13, color:'var(--accent)' }}>{state.activeGoal.slice(0, 100)}</div>
        </div>
      )}

      {/* Load */}
      <LoadBar value={state.cognitiveLoad} />
    </div>
  );
};
