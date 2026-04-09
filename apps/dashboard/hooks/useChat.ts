// apps/dashboard/hooks/useChat.ts

import { useState, useRef, useCallback } from 'react';

export interface ChatMessage {
  id:       number;
  role:     'user' | 'assistant';
  text?:    string;
  result?:  AssistantResult;
}

export interface AssistantResult {
  type:      'ai' | 'error';
  text:      string;
  data?:     any;
  metadata?: { usedSkills?: string[]; timeline?: any; };
}

// Stable session ID per browser tab
const SESSION_ID = `session-${Date.now()}`;

export default function useChat() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const idRef      = useRef(0);
  const loadingRef = useRef(false);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || loadingRef.current) return;

    loadingRef.current = true;
    setChatLoading(true);
    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);

    try {
      await sendViaStream(query, SESSION_ID, (result) => {
        setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
      });
    } catch {
      try {
        const result = await sendViaRest(query, SESSION_ID);
        setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
      } catch {
        setMessages(prev => [...prev, {
          id: ++idRef.current, role: 'assistant',
          result: { type: 'error', text: 'Request failed, please retry.' },
        }]);
      }
    } finally {
      loadingRef.current = false;
      setChatLoading(false);
    }
  }, []);

  // Clear frontend messages AND backend session history
  const clearMessages = useCallback(async () => {
    setMessages([]);
    try {
      await fetch('/api/session/clear', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId: SESSION_ID }),
      });
    } catch {}
  }, []);

  return { messages, chatLoading, sendMessage, clearMessages };
}

// ── SSE stream ────────────────────────────────────────────────────────────────

async function sendViaStream(
  query: string, sessionId: string,
  onDone: (result: AssistantResult) => void,
): Promise<void> {
  const res = await fetch('/api/chat/stream', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No body');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  const timeline: any = { thinking:'', plan:{ steps:[], raw:'' }, steps:[], finalAnswer:'' };
  const usedSkills: string[] = [];
  const observations: any[]  = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const lines     = chunk.split('\n');
      const eventLine = lines.find(l => l.startsWith('event:'));
      const dataLine  = lines.find(l => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;
      const eventType = eventLine.replace('event:', '').trim();
      let data: any;
      try { data = JSON.parse(dataLine.replace('data:', '').trim()); } catch { continue; }

      switch (eventType) {
        case 'thinking':  timeline.thinking = data.message ?? ''; break;
        case 'planning':  timeline.plan.steps = data.steps ?? []; break;
        case 'skill-end':
          usedSkills.push(data.skill);
          observations.push(data.output);
          timeline.steps.push({
            skill: data.skill, input: data.params ?? {}, output: data.output,
            duration: data.duration ?? 0, thoughtBefore: data.thoughtBefore, thoughtAfter: data.thoughtAfter,
          });
          break;
        case 'answer-end': {
          const text = data.answer ?? '';
          timeline.finalAnswer = text;
          const structured = observations.length === 1 ? observations[0]
                           : observations.length > 1  ? observations
                           : null;
          onDone({ type:'ai', text, data: structured, metadata:{ usedSkills:[...usedSkills], timeline:{...timeline} } });
          return;
        }
        case 'error': throw new Error(data.message ?? 'Stream error');
      }
    }
  }
  throw new Error('Stream ended without answer-end');
}

// ── REST fallback ─────────────────────────────────────────────────────────────

async function sendViaRest(query: string, sessionId: string): Promise<AssistantResult> {
  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw  = await res.json();
  const obs  = raw.output?.observations ?? [];
  return {
    type:  'ai',
    text:  raw.output?.text ?? raw.text ?? '',
    data:  obs.length === 1 ? obs[0] : obs.length > 1 ? obs : null,
    metadata: { usedSkills: raw.metadata?.usedSkills ?? [], timeline: raw.metadata?.timeline ?? null },
  };
}
