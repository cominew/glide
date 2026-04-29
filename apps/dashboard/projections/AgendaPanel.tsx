// apps/dashboard/projections/AgendaPanel.tsx
// ─────────────────────────────────────────────────────────────
// Agenda — things Glide wants human attention on.
// AI proposes. Human decides. This is the interface.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { useAgenda, AgendaItem } from '../arising/useAgenda';

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  approval: { bg:'#FAEEDA', color:'#633806' },
  suggest:  { bg:'#E6F1FB', color:'#0C447C' },
  risk:     { bg:'#FCEBEB', color:'#791F1F' },
  info:     { bg:'#EAF3DE', color:'#27500A' },
  learning: { bg:'#EEEDFE', color:'#3C3489' },
};

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <span style={{ fontSize:11, color:'#BA7517', minWidth:48, flexShrink:0 }}>
    {'★'.repeat(n)}{'☆'.repeat(Math.max(0, 4-n))}
  </span>
);

const Item: React.FC<{ item: AgendaItem; onDismiss: ()=>void; onBump: ()=>void }> = ({ item, onDismiss, onBump }) => (
  <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 0', borderBottom:'0.5px solid var(--border)' }}>
    <Stars n={item.stars} />
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.4, marginBottom:5 }}>{item.text}</div>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <span style={{
          fontSize:10, fontWeight:600, borderRadius:4, padding:'2px 7px',
          background: TAG_STYLE[item.tagType]?.bg ?? '#f1f5f9',
          color:      TAG_STYLE[item.tagType]?.color ?? '#475569',
        }}>{item.tag}</span>
        <button onClick={onBump}
          style={{ fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:'1px 4px' }}>
          ↑ Urgent
        </button>
        <button onClick={onDismiss}
          style={{ fontSize:10, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:'1px 4px' }}>
          Dismiss
        </button>
      </div>
    </div>
  </div>
);

export const AgendaPanel: React.FC = () => {
  const { items, loading, dismiss, bump } = useAgenda();

  return (
    <div style={{ background:'var(--card-bg)', border:'0.5px solid var(--border)', borderRadius:14, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Agenda</div>
        <span style={{ fontSize:10, color:'var(--text-muted)' }}>
          {loading ? 'Updating...' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding:'20px 0', textAlign:'center', fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
          No internal agenda yet.
        </div>
      ) : (
        <div>
          {items.map(item => (
            <Item key={item.id} item={item}
              onDismiss={() => dismiss(item.id)}
              onBump={()    => bump(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
};
