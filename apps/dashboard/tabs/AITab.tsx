// apps/dashboard/tabs/AITab.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap } from 'lucide-react';
import { RenderData } from '../components/RenderData';
import { SkillTrace } from '../components/SkillTrace';
import { CognitiveStream, Timeline } from '../components/CognitiveStream';
import { ChatMessage } from '../types/chat';
import useChat from '../hooks/useChat';

// ── Helpers ───────────────────────────────────────────────────────────────────

const KNOWN_TYPES = [
  'customer_list','top_customers','monthly_report','sales_by_country',
  'overview','total_revenue','sales_data','knowledge_answer',
];

function isValidTimeline(t: any): t is Timeline {
  return t && t.plan && Array.isArray(t.plan.steps) && Array.isArray(t.steps);
}

function findStructuredData(result: any): any {
  if (!result?.data) return null;
  const d = result.data;
  if (!Array.isArray(d) && KNOWN_TYPES.includes(d?.type)) return d;
  if (Array.isArray(d) && d.length > 0) return d;
  return null;
}

const EXAMPLE_QUERIES = [
  'top 5 customers',
  'show me Adam Davis full profile',
  'customers from UK',
  'sales report 2026-01',
  'top countries by revenue',
  'what is RosCard?',
];

// ── Assistant bubble ──────────────────────────────────────────────────────────

const AssistantBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const result     = msg.result;
  const text       = result?.text ?? msg.text ?? '';
  const timeline   = result?.metadata?.timeline;
  const structured = findStructuredData(result);
  const usedSkills = result?.metadata?.usedSkills ?? [];

  // ✅ 优先使用 LLM 总结（来自 aggregator）
  const finalAnswer = timeline?.finalAnswer?.trim();
  const displayText = finalAnswer || text;

  return (
    <div className="space-y-2">
      {isValidTimeline(timeline) && <CognitiveStream timeline={timeline} />}

      {displayText && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed"
          style={{ color: 'var(--text-primary)' }}>
          {displayText}
        </div>
      )}

      {structured && <RenderData data={structured} />}

      {usedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {usedSkills.map((s: string) => <SkillTrace key={s} skillName={s} />)}
        </div>
      )}
    </div>
  );
};

// ── Live streaming bubble (shows while response is arriving) ──────────────────

const LiveBubble: React.FC<{ text: string; timeline: any }> = ({ text, timeline }) => (
  <div className="flex justify-start">
    <div className="p-4 rounded-2xl rounded-tl-none max-w-[90%] border text-sm"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
      <div className="space-y-2">
        {isValidTimeline(timeline) && <CognitiveStream timeline={timeline} />}
        {text ? (
          <div className="whitespace-pre-wrap leading-relaxed">{text}<span className="animate-pulse ml-0.5">▋</span></div>
        ) : (
          <div className="flex gap-1.5 items-center py-1">
            {[0,100,200].map(d => (
              <div key={d} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const AITab: React.FC<{
  isOnline:    boolean;
  messages:    ChatMessage[];
  chatLoading: boolean;
  onSend:      (msg: string) => void;
  onClear:     () => void;
  streamText?:     string;
  streamTimeline?: any;
}> = ({ isOnline, messages, chatLoading, onSend, onClear, streamText = '', streamTimeline = null }) => {

  const [input, setInput]   = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatLoading, streamText]);

  const handleSubmit = () => {
    const t = input.trim();
    if (!t || chatLoading || !isOnline) return;
    onSend(t);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col rounded-2xl overflow-hidden border"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="p-5 flex items-center justify-between shrink-0 border-b"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>Glide AI</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-500' : 'text-amber-400'}`}>
              {isOnline ? '● Online' : '● Offline'}
            </span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} className="text-xs hover:opacity-70 transition px-3 py-1 rounded-lg"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-overlay)' }}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && !chatLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center border"
              style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
              <Zap size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>How can I help you?</p>
              <div className="text-xs mt-3 space-y-2">
                {EXAMPLE_QUERIES.map(ex => (
                  <div key={ex}>
                    <button onClick={() => setInput(ex)}
                      className="font-mono hover:opacity-70 transition"
                      style={{ color: 'var(--accent)' }}>
                      "{ex}"
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[90%] text-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'rounded-tl-none border'
            }`}
              style={m.role === 'assistant' ? {
                backgroundColor: 'var(--bg-elevated)',
                borderColor:     'var(--border)',
                color:           'var(--text-primary)',
              } : {}}>
              {m.role === 'user'
                ? <span>{m.text}</span>
                : <AssistantBubble msg={m} />
              }
            </div>
          </div>
        ))}

        {/* Live streaming bubble */}
        {chatLoading && (
          <LiveBubble text={streamText} timeline={streamTimeline} />
        )}
      </div>

      {/* Input */}
      <div className="p-4 flex gap-3 shrink-0 border-t"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        <input
          id="ai-query-input"
          name="query"          
          autoComplete="off"
          className="flex-1 px-5 py-3 rounded-2xl outline-none border text-sm transition-all disabled:opacity-40"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor:     'var(--border)',
            color:           'var(--text-primary)',
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isOnline ? 'Ask anything...' : 'Backend offline'}
          disabled={!isOnline || chatLoading}
        />
        <button onClick={handleSubmit}
          disabled={!input.trim() || !isOnline || chatLoading}
          className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-500 transition-all disabled:opacity-40 shrink-0">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};