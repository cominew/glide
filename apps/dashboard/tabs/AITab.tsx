// tabs/AITab.tsx
// CognitiveStream replaced by EventViewer (embedded, filtered to taskId).
// The "thinking stream" IS the event stream — no separate interpretation.

import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap } from 'lucide-react';
import { RenderData }   from '../components/RenderData';
import { SkillTrace }   from '../components/SkillTrace';
import { EventViewer }  from '../components/EventViewer';
import { ChatMessage }  from '../types/chat';
import { UIEvent, ReplaySession, EventFilter } from '../types/events';

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
  'top 5 customers',
  'show me Adam Davis full profile',
  'customers from UK',
  'sales report 2026-01',
  'top countries by revenue',
];

// ── Prelude ───────────────────────────────────────────────────

const PRELUDE = [
  'Connecting to Glide Core...',
  'Loading language model...',
  'Indexing knowledge base...',
  'Processing your request...',
];

const PreludeLines: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      `}</style>
      {lines.map((line, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, animation:'fadeIn .3s ease both', animationDelay:`${i*50}ms` }}>
          <span style={{ width:5, height:5, borderRadius:'50%', flexShrink:0, background: i===lines.length-1 ? 'var(--accent)' : 'var(--border-strong, #ccc)' }} />
          <span style={{ color: i===lines.length-1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{line}</span>
          {i===lines.length-1 && (
            <span style={{ display:'flex', gap:3 }}>
              {[0,1,2].map(j=><span key={j} style={{width:4,height:4,borderRadius:'50%',background:'var(--accent)',display:'inline-block',animation:`dot .8s ${j*180}ms ease-in-out infinite`}}/>)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Assistant bubble ──────────────────────────────────────────

const AssistantBubble: React.FC<{ msg: ChatMessage; events: UIEvent[]; getSession?: (id:string)=>ReplaySession|null }> =
  ({ msg, events, getSession }) => {
  const [showStream, setShowStream] = useState(false);
  const result = msg.result;
  const text   = result?.metadata?.timeline?.finalAnswer?.trim() || result?.text || msg.text || '';
  const structured = findStructuredData(result);
  const usedSkills = result?.metadata?.usedSkills ?? [];
  const taskId = result?.metadata?.taskId;

  // Events for this specific task
  const taskEvents = taskId ? events.filter(e => e.taskId === taskId) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Collapsible event stream for this task */}
      {taskEvents.length > 0 && (
        <div>
          <button onClick={()=>setShowStream(s=>!s)}
            style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:'2px 0', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{fontSize:9}}>{showStream?'▾':'▸'}</span>
            {taskEvents.length} events · {showStream ? 'hide' : 'show'} stream
          </button>
          {showStream && (
            <div style={{ marginTop:6, border:'0.5px solid var(--border)', borderRadius:8, height:200, overflow:'hidden' }}>
              <EventViewer events={taskEvents} embedded getSession={getSession} />
            </div>
          )}
        </div>
      )}

      {text && (
        <div style={{ fontSize:14, lineHeight:1.65, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>
          {text}
        </div>
      )}
      {structured && <RenderData data={structured} />}
      {usedSkills.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
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
  streamTimeline?: any;
  // New: event stream
  events?:     UIEvent[];
  getSession?: (id: string) => ReplaySession | null;
}> = ({ isOnline, messages, chatLoading, onSend, onClear, streamText='', events=[], getSession }) => {

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

      {/* Header */}
      <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'var(--bg-elevated)', borderBottom:'0.5px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:9,background:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Glide AI</div>
            <div style={{ fontSize:10,fontWeight:700,letterSpacing:'.06em',color:isOnline?'var(--success)':'var(--warning)' }}>
              {isOnline?'● Online':'● Offline'}
            </div>
          </div>
        </div>
        {messages.length>0 && (
          <button onClick={onClear} style={{ fontSize:12,padding:'4px 10px',borderRadius:7,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex:1,overflowY:'auto',padding:'14px 18px',display:'flex',flexDirection:'column',gap:12 }}>
        {messages.length===0 && !chatLoading && (
          <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',gap:16 }}>
            <div style={{ width:48,height:48,borderRadius:12,background:'var(--accent-dim)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Zap size={20} style={{ color:'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontSize:13,fontWeight:500,color:'var(--text-secondary)',marginBottom:10 }}>How can I help you?</div>
              {EXAMPLES.map(ex=>(
                <div key={ex} style={{ marginBottom:4 }}>
                  <button onClick={()=>setInput(ex)} style={{ fontSize:12,fontFamily:'monospace',color:'var(--accent)',background:'none',border:'none',cursor:'pointer' }}>"{ex}"</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map(m=>(
          <div key={m.id} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ padding:'11px 14px', borderRadius:m.role==='user'?'14px 14px 2px 14px':'14px 14px 14px 2px', maxWidth:'90%', fontSize:14,
              background:m.role==='user'?'#2563eb':'var(--card-bg)',
              color:m.role==='user'?'#fff':'var(--text-primary)',
              border:m.role==='user'?'none':'0.5px solid var(--border)' }}>
              {m.role==='user'
                ? <span>{m.text}</span>
                : <AssistantBubble msg={m} events={events} getSession={getSession} />
              }
            </div>
          </div>
        ))}

        {chatLoading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ padding:'12px 14px',borderRadius:'14px 14px 14px 2px',maxWidth:'90%',background:'var(--card-bg)',border:'0.5px solid var(--border)' }}>
              {streamText
                ? <PreludeLines text={streamText} />
                : <div style={{ display:'flex',gap:4 }}>
                    {[0,1,2].map(d=><div key={d} style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',opacity:.7,animation:`dot .9s ${d*150}ms ease-in-out infinite`}}/>)}
                  </div>
              }
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding:'10px 14px',display:'flex',gap:8,flexShrink:0,background:'var(--bg-elevated)',borderTop:'0.5px solid var(--border)' }}>
        <input autoComplete="off"
          style={{ flex:1,padding:'9px 14px',borderRadius:11,border:'0.5px solid var(--border)',background:'var(--bg-surface)',color:'var(--text-primary)',fontSize:14,outline:'none',opacity:(!isOnline||chatLoading)?0.45:1 }}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}}}
          placeholder={isOnline?'Ask anything...':'Backend offline'}
          disabled={!isOnline||chatLoading}
        />
        <button onClick={submit} disabled={!input.trim()||!isOnline||chatLoading}
          style={{ width:42,height:42,borderRadius:11,border:'none',background:'#2563eb',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:(!input.trim()||!isOnline||chatLoading)?'not-allowed':'pointer',opacity:(!input.trim()||!isOnline||chatLoading)?0.4:1,flexShrink:0 }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
