// apps/dashboard/perspectives/AITab.tsx
//
// Observer Panel — Second-order Observation Interface
//
// When the user clicks 👍 ✏ ⚠ 💡, they are NOT rating.
// They are performing a Second-order Observation.
// The click injects an observer.feedback Boundary Event into the causal field.
//
// First collapse:  input.user → skill resonance → answer.ready
// Second collapse: observer.feedback → reflection → agenda → repair chain
//
// The user becomes an Observer Class Entity, not a prompt sender.
// Feedback does not re-enter via sendMessage (that would make it a new query).
// It enters via api.signal({ type: 'observer.feedback', ... }).
//
// UI is a pure projection — buttons inject events, not callbacks.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Zap, ThumbsUp, AlertTriangle, Lightbulb, Edit3 } from 'lucide-react';
import { RenderData } from '../projections/RenderData';
import { ThinkingProgress } from '../projections/EventNarrative';
import { ChatMessage } from '../events/chat';
import { UIEvent, ReplaySession } from '../events/events';
import { api } from '../gateways/api';

// ── Types ────────────────────────────────────────────────────────────────────
type FeedbackJudgment = 'positive' | 'correction' | 'incorrect' | 'style';

// ── Observer Panel ────────────────────────────────────────────────────────────
const ObserverPanel: React.FC<{
  messageId: number;
  scopeId?: string;
}> = ({ messageId, scopeId }) => {
  const [submitted,   setSubmitted]   = useState<FeedbackJudgment | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [noteText,    setNoteText]    = useState('');

  const STORAGE_KEY = 'glide_observer_submitted';

const loadSubmitted = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveSubmitted = (set: Set<string>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
};

const [submittedIds] = useState<Set<string>>(() => loadSubmitted());

const markSubmitted = (judgment: FeedbackJudgment, note?: string) => {
  const key = `${messageId}_${judgment}`;
  submittedIds.add(key);
  saveSubmitted(submittedIds);
  setSubmitted(judgment);
};
  const submit = (judgment: FeedbackJudgment, note?: string) => {
    setSubmitted(judgment);
    setShowCorrect(false);
    setNoteText('');

    // ⭐ UI 不处理反馈，只是注入 Boundary Event
    api.signal({
      type:        'observer.feedback',
      judgment,
      note:        note ?? '',
      targetScope: scopeId ?? '',
      timestamp: Date.now(),
      // 对于修正判断，同时注入修复查询
      ...(judgment === 'correction' && note ? {
        injectQuery: note,
        repairMode:  true,
      } : {}),
    }).catch(err => {
      console.error('[ObserverPanel] feedback signal failed', err);
    });
  };

  // 已提交的非修正类型反馈直接显示确认信息
  if (submitted && submitted !== 'correction') {
    return (
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>
        {submitted === 'positive'   ? '✓ observation recorded'
        : submitted === 'incorrect' ? '⚠ flagged for review'
        : submitted === 'style'     ? '💡 style note sent'
        : '↩ correction sent'}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!showCorrect && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>Observe:</span>

          <button onClick={() => submit('positive')}
            title="This reality is accurate"
            style={observerBtnStyle('#16a34a')}>
            <ThumbsUp size={11} /> Useful
          </button>

          <button onClick={() => setShowCorrect(v => !v)}
            title="Suggest a change — injects a repair boundary event"
            style={observerBtnStyle('#8b5cf6', showCorrect)}>
            <Edit3 size={11} /> Correct
          </button>

          <button onClick={() => submit('incorrect')}
            title="Flag as incorrect"
            style={observerBtnStyle('#dc2626')}>
            <AlertTriangle size={11} /> Wrong
          </button>

          <button onClick={() => submit('style')}
            title="Style or tone could improve"
            style={observerBtnStyle('#f59e0b')}>
            <Lightbulb size={11} /> Style
          </button>
        </div>
      )}

      {showCorrect && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <input
            autoFocus
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && noteText.trim()) submit('correction', noteText.trim());
              if (e.key === 'Escape') setShowCorrect(false);
            }}
            placeholder="Describe the correction — this becomes a repair event..."
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 8,
              border: '1px solid #8b5cf6',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: 12, outline: 'none',
            }}
          />
          <button onClick={() => { if (noteText.trim()) submit('correction', noteText.trim()); }}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Send
          </button>
          <button onClick={() => setShowCorrect(false)}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

function observerBtnStyle(color: string, active = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
    border: `1px solid ${color}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : color,
    cursor: 'pointer',
  };
}

// ── Event affinity grouping ────────────────────────────────────────────────────
function useEventAffinity(events: UIEvent[]) {
  return useMemo(() => {
    const groups: UIEvent[][] = [];
    let current: UIEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const prev = events[i - 1];
      const samePrefix = prev && e.type.split('.')[0] === prev.type.split('.')[0];
      const closeInTime = prev && Math.abs(e.timestamp - prev.timestamp) < 12000;
      if (!prev || (!samePrefix && !closeInTime)) {
        if (current.length) groups.push(current);
        current = [e];
      } else {
        current.push(e);
      }
    }
    if (current.length) groups.push(current);
    return groups;
  }, [events]);
}

// ── Prelude loading animation ─────────────────────────────────────────────────
const PreludeLines: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <style>{`
        @keyframes fs{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      `}</style>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 7, fontSize: 13,
          animation: 'fs .25s ease both', animationDelay: `${i * 35}ms`,
          color: i === lines.length - 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, background: i === lines.length - 1 ? 'var(--accent)' : 'var(--border)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{line}</span>
          {i === lines.length - 1 && (
            <span style={{ display: 'flex', gap: 3 }}>
              {[0,1,2].map(j => (
                <span key={j} style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: `dot .7s ${j*160}ms ease-in-out infinite` }} />
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Mission accomplished flash ────────────────────────────────────────────────
const MissionAccomplished: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0' }}>
      <style>{`@keyframes mIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}@keyframes mOut{0%{opacity:1}75%{opacity:.9}100%{opacity:0}}`}</style>
      <div style={{ animation: 'mIn .25s ease, mOut 2s ease forwards', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12 }}>✦</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', fontFamily: 'monospace', letterSpacing: '.03em' }}>manifested</span>
      </div>
    </div>
  );
};

// ── Assistant bubble ──────────────────────────────────────────────────────────
const AssistantBubble: React.FC<{
  msg:    ChatMessage;
  events: UIEvent[];
}> = ({ msg, events }) => {
  const [showTrace,   setShowTrace]   = useState(false);
  const [showMission, setShowMission] = useState(true);
  const result = msg.result;

  const text       = result?.text ?? '';
  const structured = result?.data ?? null;
  const scopeId = useMemo(() => {
  // 从与当前消息关联的 answer.ready 事件中获取 scopeId
  const answerEvent = events.find(e => e.type === 'answer.ready' && e.payload?.chainId);
  return answerEvent?.payload?.scopeId ?? answerEvent?.payload?.chainId;
}, [events]);

  const affinityEvents = scopeId
    ? events.filter(e => (e.payload?.scopeId ?? e.payload?.chainId) === scopeId)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {affinityEvents.length > 0 && (
        <div>
          <button onClick={() => setShowTrace(v => !v)}
            style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
            <span style={{ fontSize: 8 }}>{showTrace ? '▾' : '▸'}</span>
            {affinityEvents.length} causal events
          </button>
          {showTrace && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 }}>
              {affinityEvents.map(e => <ThinkingProgress key={e.id} event={e} />)}
            </div>
          )}
        </div>
      )}

      {showMission && <MissionAccomplished onDone={() => setShowMission(false)} />}

      {text && (
        <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      )}

      {structured && <RenderData data={structured} />}

      {/* Observer Panel — 直接注入事件，不经过父组件 */}
      <ObserverPanel messageId={msg.id} scopeId={scopeId} />
    </div>
  );
};

// ── Example queries ───────────────────────────────────────────────────────────
const EXAMPLES = [
  'show me Adam Davis full profile',
  'top 5 customers by revenue',
  'customers from UK',
  'sales report 2026-01',
  'top countries by revenue',
];

// ── Main AITab ────────────────────────────────────────────────────────────────
export const AITab: React.FC<{
  isOnline:      boolean;
  messages:      ChatMessage[];
  chatLoading:   boolean;
  onSend:        (msg: string) => void;
  onClear:       () => void;
  streamText?:   string;
  events?:       UIEvent[];
}> = ({ isOnline, messages, chatLoading, onSend, onClear, streamText = '', events = [] }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups      = useEventAffinity(events);
  const latestGroup = groups[groups.length - 1] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatLoading, streamText]);

  const submit = () => {
    const t = input.trim();
    if (!t || chatLoading || !isOnline) return;
    onSend(t);
    setInput('');
  };

  return (
    <div style={{ height: 'calc(100vh - 10rem)', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-surface)' }}>

      {/* Header */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-elevated)', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Glide</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: isOnline ? 'var(--success)' : 'var(--warning)', fontFamily: 'monospace' }}>
              {isOnline ? '● ready' : '● offline'}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && !chatLoading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 11, background: 'var(--accent-dim)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={19} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'monospace' }}>ask anything</div>
              {EXAMPLES.map(ex => (
                <div key={ex} style={{ marginBottom: 3 }}>
                  <button onClick={() => setInput(ex)} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>{ex}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
              maxWidth: '90%', fontSize: 14,
              background: m.role === 'user' ? '#2563eb' : 'var(--card-bg)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: m.role === 'user' ? 'none' : '0.5px solid var(--border)',
            }}>
              {m.role === 'user'
                ? <span>{m.text}</span>
                : <AssistantBubble msg={m} events={events} />
              }
            </div>
          </div>
        ))}

        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', maxWidth: '90%', background: 'var(--card-bg)', border: '0.5px solid var(--border)' }}>
              {latestGroup.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {latestGroup.map(e => <ThinkingProgress key={e.id} event={e} />)}
                </div>
              ) : streamText ? (
                <PreludeLines text={streamText} />
              ) : (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2].map(d => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', opacity: .6, animation: `dot .8s ${d*140}ms ease-in-out infinite` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--bg-elevated)', borderTop: '0.5px solid var(--border)' }}>
        <input
          autoComplete="off"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 11, border: '0.5px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', opacity: (!isOnline || chatLoading) ? 0.45 : 1 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={isOnline ? 'ask anything...' : 'offline'}
          disabled={!isOnline || chatLoading}
        />
        <button onClick={submit} disabled={!input.trim() || !isOnline || chatLoading}
          style={{ width: 42, height: 42, borderRadius: 11, border: 'none', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!input.trim() || !isOnline || chatLoading) ? 'not-allowed' : 'pointer', opacity: (!input.trim() || !isOnline || chatLoading) ? 0.4 : 1, flexShrink: 0 }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};