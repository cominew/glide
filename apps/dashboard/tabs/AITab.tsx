// apps/dashboard/tabs/AITab.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap } from 'lucide-react';
import { RenderData } from '../components/RenderData';
import { SkillTrace } from '../components/SkillTrace';
import { ChatMessage } from '../types/chat';
import { CognitiveStream, Timeline  } from '../components/CognitiveStream'; 

function isValidTimeline(t: any): t is Timeline {
  return (
    t &&
    t.plan &&
    Array.isArray(t.plan.steps) &&
    Array.isArray(t.steps)
  );
}

interface AITabProps {
  isOnline:    boolean;
  messages:    ChatMessage[];
  chatLoading: boolean;
  onSend:      (msg: string) => void;
  onClear:     () => void;
}

const EXAMPLE_QUERIES = [
  'top 5 customers',
  'show me Adam Davis full profile',
  'customers from UK',
  'sales report 2026-01',
  'top countries by revenue',
  'what is RosCard?',
];

// Known structured data types from skills
const KNOWN_TYPES = [
  'customer_list', 'top_customers', 'monthly_report',
  'sales_by_country', 'overview', 'total_revenue',
  'sales_data', 'knowledge_answer',
];

function findStructuredData(result: any): any {
  if (!result) return null;

  // result.data is already resolved by api.ts
  const d = result.data;
  if (!d) return null;

  // Single skill output
  if (d && typeof d === 'object' && !Array.isArray(d) && KNOWN_TYPES.includes(d.type)) {
    return d;
  }

  // Multi-skill array
  if (Array.isArray(d) && d.length > 0) {
    return d;
  }

  return null;
}

export const AITab: React.FC<AITabProps> = ({
  isOnline, messages, chatLoading, onSend, onClear,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleSubmit = () => {
    const t = input.trim();
    if (!t || chatLoading || !isOnline) return;
    onSend(t);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const AssistantBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const result = React.useMemo(() => msg.result, [msg]);
  const text = result?.text || msg.text;
  const structured = findStructuredData(result);
  const usedSkills = result?.metadata?.usedSkills ?? [];
  const timeline = msg.result?.metadata?.timeline;// 新增

  // Debug output
  useEffect(() => {
  console.log('[AITab] timeline changed', timeline);
}, [timeline]);
  console.debug('[AITab] msg.result:', result);
  console.debug('[AITab] structured:', structured);
  console.debug('[AITab] timeline:', timeline);

  return (
    <div className="space-y-2">
      {/* 认知流（规划、执行时间线、聚合） */}
      {isValidTimeline(timeline) && (
  <CognitiveStream timeline={timeline} />
)}

      {/* AI 文本回答 */}
      {text && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
          {text}
        </div>
      )}

      {/* 结构化数据渲染（图表、卡片等） */}
      {structured && <RenderData data={structured} />}

      {/* 使用的技能标签 */}
      {usedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {usedSkills.map((s: string) => (
            <SkillTrace key={s} skillName={s} />
          ))}
        </div>
      )}
    </div>
  );
};

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 leading-none text-sm">Glide AI</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isOnline ? '● Online' : '● Offline'}
            </span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} className="text-xs text-slate-500 hover:text-slate-200 transition px-3 py-1 rounded-lg hover:bg-slate-800">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-2xl flex items-center justify-center">
              <Zap size={24} className="text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-slate-300 text-sm">How can I help you?</p>
              <div className="text-xs mt-3 space-y-2">
                {EXAMPLE_QUERIES.map(ex => (
                  <div key={ex}>
                    <button onClick={() => setInput(ex)} className="text-blue-400 hover:text-blue-300 transition font-mono">
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
            <div className={`p-4 rounded-2xl max-w-[90%] shadow-sm text-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/60'
            }`}>
              {m.role === 'user'
                ? <span>{m.text}</span>
                : <AssistantBubble msg={m} />
              }
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
              {[0, 100, 200].map(d => (
                <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-3 shrink-0">
        <input
          id="chat-input"
          autoComplete="off"
          className="flex-1 bg-slate-800 px-5 py-3 rounded-2xl outline-none border border-slate-700 focus:border-blue-500 transition-all text-sm text-slate-200 placeholder:text-slate-500 disabled:opacity-40"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isOnline ? 'Ask anything...' : 'Backend offline'}
          disabled={!isOnline || chatLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || !isOnline || chatLoading}
          className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-40 shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
