// apps/dashboard/perspectives/AITab.tsx
// ─────────────────────────────────────────────────────────────
// AI Conversation Tab — event-native, narrative-driven
//
// No "AI is thinking". No subject.
// What happened is described as plain sentences derived from events.
// The answer appears. Sentences dissolve.
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Zap } from 'lucide-react';
import { RenderData }     from '../projections/RenderData';
import { SkillTrace }     from '../projections/SkillTrace';
import { EventViewer }    from '../projections/EventViewer';
import { NarraceTrace, ThinkingProgress } from '../projections/EventNarrative';
import { ChatMessage }    from '../events/chat';
import { UIEvent, ReplaySession } from '../events/events';

const KNOWN_TYPES = [
  'customer_list','top_customers','monthly_report','sales_by_country',
  'overview','total_revenue','sales_data','knowledge_answer',
];

function findStructuredData(result: any): any {
  if (!result?.data) return null;
  const d = result.data;
  if (!Array.isArray(d) && KNOWN_TYPES.includes(d?.type)) return d;
  if (Array.isArray(d) && d.length > 0) return d;
  return null;
}

const EXAMPLES = [
  'show me Adam Davis full profile',
  'top 5 customers by revenue',
  'customers from UK',
  'sales report 2026-01',
  'top countries by revenue',
];

// ── Prelude ───────────────────────────────────────────────────

const PRELUDE = [
  'Connecting to Glide Core...',
  'Loading knowledge base...',
  'Processing your request...',
];

const PreludeLines: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <style>{`
        @keyframes fs{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      `}</style>
      {lines.map((line, i) => (
        <div key={i} style={{
          display:'flex', alignItems:'center', gap:7, fontSize:13,
          animation:'fs .25s ease both', animationDelay:`${i*35}ms`,
          color: i===lines.length-1 ? 'var(--text-secondary)' : 'var(--text-muted)',
        }}>
          <span style={{ width:4, height:4, borderRadius:'50%', flexShrink:0, background: i===lines.length-1 ? 'var(--accent)' : 'var(--border)' }}/>
          <span style={{ fontFamily:'monospace', fontSize:12 }}>{line}</span>
          {i===lines.length-1 && (
            <span style={{ display:'flex', gap:3 }}>
              {[0,1,2].map(j=>(
                <span key={j} style={{ width:3,height:3,borderRadius:'50%',background:'var(--accent)',display:'inline-block',animation:`dot .7s ${j*160}ms ease-in-out infinite` }}/>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Mission accomplished (transient) ─────────────────────────

const MissionAccomplished: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 0' }}>
      <style>{`
        @keyframes mIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        @keyframes mOut{0%{opacity:1}75%{opacity:.9}100%{opacity:0}}
      `}</style>
      <div style={{ animation:'mIn .25s ease, mOut 2s ease forwards', display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ fontSize:12 }}>✦</span>
        <span style={{ fontSize:12, fontWeight:600, color:'var(--success)', fontFamily:'monospace', letterSpacing:'.03em' }}>
          completed
        </span>
      </div>
    </div>
  );
};

// ── Assistant bubble ──────────────────────────────────────────

const AssistantBubble: React.FC<{
  msg:        ChatMessage;
  events:     UIEvent[];
  getSession?: (id:string)=>ReplaySession|null;
}> = ({ msg, events, getSession }) => {
  const [showTrace,   setShowTrace]   = useState(false);
  const [showMission, setShowMission] = useState(true);

  const result     = msg.result;
  const text       = result?.metadata?.timeline?.finalAnswer?.trim() || result?.text || msg.text || '';
  const structured = findStructuredData(result);
  const usedSkills = result?.metadata?.usedSkills ?? [];
  const taskId     = result?.metadata?.taskId;
  const taskEvents = taskId ? events.filter(e => e.taskId === taskId) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Event-derived narrative trace — replaces ThinkingBadge */}
      {taskId && taskEvents.length > 0 && (
        <div>
          <button onClick={()=>setShowTrace(v=>!v)}
            style={{ fontSize:10, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:'2px 0', display:'flex', alignItems:'center', gap:4, fontFamily:'monospace' }}>
            <span style={{fontSize:8}}>{showTrace?'▾':'▸'}</span>
            {taskEvents.length} events
          </button>
          {showTrace && <NarraceTrace events={taskEvents} taskId={taskId} />}
        </div>
      )}

      {/* Transient completion signal */}
      {showMission && <MissionAccomplished onDone={()=>setShowMission(false)} />}

      {/* Answer */}
      {text && (
        <div style={{ fontSize:14, lineHeight:1.65, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>
          {text}
        </div>
      )}

      {structured && <RenderData data={structured} />}

      {usedSkills.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {usedSkills.map((s:string) => <SkillTrace key={s} skillName={s} />)}
        </div>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────

export const AITab: React.FC<{
  isOnline:    boolean;
  messages:    ChatMessage[];
  chatLoading: boolean;
  onSend:      (msg: string) => void;
  onClear:     () => void;
  streamText?:     string;
  events?:         UIEvent[];
  currentTaskId?:  string;
  getSession?:     (id: string) => ReplaySession | null;
}> = ({ isOnline, messages, chatLoading, onSend, onClear, streamText='', events=[], currentTaskId, getSession }) => {

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:'smooth' });
  }, [messages, chatLoading, streamText]);

  const submit = () => {
    const t = input.trim();
    if (!t || chatLoading || !isOnline) return;
    onSend(t); setInput('');
  };

  return (
    <div style={{ height:'calc(100vh - 10rem)', display:'flex', flexDirection:'column', borderRadius:16, overflow:'hidden', border:'0.5px solid var(--border)', background:'var(--bg-surface)' }}>

      <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'var(--bg-elevated)', borderBottom:'0.5px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:9,background:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Glide</div>
            <div style={{ fontSize:10,fontWeight:600,letterSpacing:'.06em',color:isOnline?'var(--success)':'var(--warning)', fontFamily:'monospace' }}>
              {isOnline ? '● ready' : '● offline'}
            </div>
          </div>
        </div>
        {messages.length>0 && (
          <button onClick={onClear} style={{ fontSize:12,padding:'4px 10px',borderRadius:7,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer' }}>
            Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} style={{ flex:1,overflowY:'auto',padding:'14px 18px',display:'flex',flexDirection:'column',gap:12 }}>
        {messages.length===0 && !chatLoading && (
          <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',gap:14 }}>
            <div style={{ width:46,height:46,borderRadius:11,background:'var(--accent-dim)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Zap size={19} style={{ color:'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontSize:13,color:'var(--text-muted)',marginBottom:10,fontFamily:'monospace' }}>
                ask anything
              </div>
              {EXAMPLES.map(ex=>(
                <div key={ex} style={{ marginBottom:3 }}>
                  <button onClick={()=>setInput(ex)} style={{ fontSize:12,fontFamily:'monospace',color:'var(--accent)',background:'none',border:'none',cursor:'pointer' }}>
                    {ex}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map(m=>(
          <div key={m.id} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{
              padding:'10px 14px',
              borderRadius: m.role==='user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
              maxWidth:'90%', fontSize:14,
              background: m.role==='user' ? '#2563eb' : 'var(--card-bg)',
              color: m.role==='user' ? '#fff' : 'var(--text-primary)',
              border: m.role==='user' ? 'none' : '0.5px solid var(--border)',
            }}>
              {m.role==='user'
                ? <span>{m.text}</span>
                : <AssistantBubble msg={m} events={events} getSession={getSession} />
              }
            </div>
          </div>
        ))}

        {/* Loading state — ThinkingProgress or prelude */}
        {chatLoading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ padding:'10px 14px',borderRadius:'14px 14px 14px 2px',maxWidth:'90%',background:'var(--card-bg)',border:'0.5px solid var(--border)' }}>
              {currentTaskId && events.some(e=>e.taskId===currentTaskId)
                ? <ThinkingProgress events={events} taskId={currentTaskId} />
                : streamText
                  ? <PreludeLines text={streamText} />
                  : (
                    <div style={{ display:'flex',gap:4 }}>
                      {[0,1,2].map(d=>(
                        <div key={d} style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)',opacity:.6,animation:`dot .8s ${d*140}ms ease-in-out infinite` }}/>
                      ))}
                    </div>
                  )
              }
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:'10px 14px',display:'flex',gap:8,flexShrink:0,background:'var(--bg-elevated)',borderTop:'0.5px solid var(--border)' }}>
        <input
          autoComplete="off"
          style={{ flex:1,padding:'9px 14px',borderRadius:11,border:'0.5px solid var(--border)',background:'var(--bg-surface)',color:'var(--text-primary)',fontSize:14,outline:'none',opacity:(!isOnline||chatLoading)?0.45:1 }}
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}}}
          placeholder={isOnline ? 'ask anything...' : 'offline'}
          disabled={!isOnline||chatLoading}
        />
        <button onClick={submit} disabled={!input.trim()||!isOnline||chatLoading}
          style={{ width:42,height:42,borderRadius:11,border:'none',background:'#2563eb',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:(!input.trim()||!isOnline||chatLoading)?'not-allowed':'pointer',opacity:(!input.trim()||!isOnline||chatLoading)?0.4:1,flexShrink:0 }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
