// panels/ReflectionPanel.tsx
// ─────────────────────────────────────────────────────────────
// What Glide learned — visible learning makes AI trustworthy.
// Invisible learning is the default for all AI systems.
// This panel breaks that.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { useReflection } from '../mind/useReflection';

export const ReflectionPanel: React.FC = () => {
  const { reflections, anomalies, clear } = useReflection();

  const recent   = reflections.filter(r => !r.anomaly).slice(-8).reverse();
  const ts = (n: number) => new Date(n).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  return (
    <div style={{ background:'var(--card-bg)', border:'0.5px solid var(--border)', borderRadius:14, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Reflections</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {anomalies.length > 0 && (
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10, background:'var(--warning)', color:'#412402' }}>
              {anomalies.length} anomaly
            </span>
          )}
          {reflections.length > 0 && (
            <button onClick={clear} style={{ fontSize:10, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom:12 }}>
          {anomalies.slice(-3).reverse().map(a => (
            <div key={a.id} style={{ display:'flex', gap:8, padding:'6px 0', borderBottom:'0.5px solid var(--border)', fontSize:12 }}>
              <span style={{ color:'var(--danger)', flexShrink:0 }}>⚠</span>
              <span style={{ color:'var(--text-secondary)', flex:1, lineHeight:1.4 }}>{a.observation}</span>
              <span style={{ color:'var(--text-muted)', flexShrink:0, fontFamily:'monospace', fontSize:10 }}>{ts(a.observedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Regular reflections */}
      {recent.length === 0 ? (
        <div style={{ padding:'16px 0', textAlign:'center', fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
          No reflections yet. Start a task to begin learning.
        </div>
      ) : (
        <div>
          {recent.map(r => (
            <div key={r.id} style={{ display:'flex', gap:8, padding:'6px 0', borderBottom:'0.5px solid var(--border)', fontSize:12 }}>
              <span style={{ color:'#8b5cf6', flexShrink:0, marginTop:1 }}>○</span>
              <span style={{ color:'var(--text-secondary)', flex:1, lineHeight:1.4 }}>{r.observation}</span>
              <span style={{ color:'var(--text-muted)', flexShrink:0, fontFamily:'monospace', fontSize:10 }}>{ts(r.observedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats footer */}
      <div style={{ marginTop:12, display:'flex', gap:16, borderTop:'0.5px solid var(--border)', paddingTop:10 }}>
        {[
          ['Total observed', reflections.length],
          ['Anomalies',      anomalies.length],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
