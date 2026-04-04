import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { RenderData } from '../components/RenderData';
import { SkillTrace } from '../components/SkillTrace';
import { ChatMessage } from '../types/chat';

interface AITabProps {
  isOnline: boolean;
  messages: ChatMessage[];
  chatLoading: boolean;
  onSend: (msg: string) => void;
  onClear: () => void;
}

export const AITab: React.FC<AITabProps> = ({ isOnline, messages, chatLoading, onSend, onClear }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !chatLoading && isOnline) {
        onSend(input);
        setInput('');
      }
    }
  };

  const RenderResponse: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
    const data = msg.result?.data;
    const text = msg.result?.text || msg.text;
    return (
      <div className="space-y-3">
        {text && <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>}
        {data && <RenderData data={data} />}
        {msg.result?.metadata?.usedSkills?.map((s: string) => (
          <SkillTrace key={s} skillName={s} />
        ))}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in zoom-in-95 duration-300">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <MessageSquare size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 leading-none text-sm">OpenClaw AI</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-200 transition px-3 py-1 rounded-lg hover:bg-slate-800">
            Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center">
              <MessageSquare size={24} className="text-slate-500" />
            </div>
            <div>
              <p className="font-bold text-slate-400 text-sm">How can I help you?</p>
              <div className="text-xs mt-3 space-y-1.5">
                {[
                  '"top 5 customers"',
                  '"customers from UK"',
                  '"find Adam"',
                  '"top countries"',
                  '"sales report 2026-01"',
                  '"what is RosCard?"'
                ].map(ex => (
                  <div key={ex}>
                    <button onClick={() => setInput(ex.replace(/"/g, ''))} className="text-blue-400 hover:text-blue-300 transition">
                      {ex}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm text-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
            }`}>
              {m.role === 'user' ? m.text : <RenderResponse msg={m} />}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex gap-1.5">
              {[0,100,200].map(d => (
                <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-3">
        <input
          id="chat-input"
          autoComplete="off"
          className="flex-1 bg-slate-800 px-5 py-3 rounded-2xl outline-none border border-slate-700 focus:border-blue-500 transition-all text-sm text-slate-200 placeholder:text-slate-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything..."
          disabled={!isOnline || chatLoading}
        />
        <button
          onClick={() => {
            if (input.trim() && !chatLoading && isOnline) {
              onSend(input);
              setInput('');
            }
          }}
          disabled={!input.trim() || !isOnline || chatLoading}
          className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};