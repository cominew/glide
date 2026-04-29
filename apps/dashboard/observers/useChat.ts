// apps/dashboard/observers/useChat.ts
import { useState, useRef, useCallback } from 'react';
import { ChatMessage, AgentResult } from '../events/chat';
import { api } from '../gateways/api';

export const CHAT_SESSION_ID = `session-${Date.now()}`;
const TURN_TIMEOUT_MS = 180_000;

const PRELUDE = [
  'Connecting to event field...',
  'Awaiting capability emergence...',
  'Processing...',
];

export default function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  const idRef = useRef(0);
  const loadingRef = useRef(false);
  const preludeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preludeLinesRef = useRef<string[]>([]);

  const stopPrelude = useCallback(() => {
    if (preludeTimerRef.current) {
      clearInterval(preludeTimerRef.current);
      preludeTimerRef.current = null;
    }
  }, []);

  const startPrelude = useCallback(() => {
    preludeLinesRef.current = [];
    let i = 0;
    const show = () => {
      if (i < PRELUDE.length) {
        preludeLinesRef.current = [...preludeLinesRef.current, PRELUDE[i++]];
        setStreamText(preludeLinesRef.current.join('\n'));
      }
    };
    show();
    preludeTimerRef.current = setInterval(show, 1000);
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || loadingRef.current) return;
    stopPrelude();
    loadingRef.current = true;
    setChatLoading(true);
    setStreamText('');
    setCurrentEventId(null);
    startPrelude();
    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      const { eventId } = await api.query(query, CHAT_SESSION_ID);
      setCurrentEventId(eventId);

      const result = await new Promise<AgentResult>((resolve, reject) => {
        timeoutHandle = setTimeout(() => {
  es.close();
  reject(new Error('Answer not available within time limit. Please try again.'));
}, TURN_TIMEOUT_MS);

        const es = new EventSource('/api/events/stream');
        let resolved = false;
        const usedSkills: string[] = [];
        const observations: unknown[] = [];

        const done = (r: AgentResult) => {
          if (resolved) return;
          resolved = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          es.close();
          resolve(r);
        };

        const fail = (err: Error) => {
          if (resolved) return;
          resolved = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          es.close();
          reject(err);
        };

        const mine = (e: MessageEvent): any | null => {
          try {
            const parsed = JSON.parse(e.data);
            const eid = parsed.trace?.taskId
              ?? parsed.payload?.taskId
              ?? parsed.payload?.correlationId;
            if (eid === eventId) return parsed;
          } catch {}
          return null;
        };

        es.addEventListener('skill.output', (e: MessageEvent) => {
          const p = mine(e);
          if (!p || resolved) return;
          const skill = p.payload?.skill;
          const output = p.payload?.fragments;
          if (skill) usedSkills.push(skill);
          if (output != null) observations.push(output);
          stopPrelude();
          setStreamText(`${skill ?? 'skill'} responded`);
          if (p.payload?.complete) {
            done({
              type: 'ai',
              text: output?.map((f: any) => typeof f.value === 'string' ? f.value : JSON.stringify(f.value, null, 2)).join('\n') ?? '',
              data: output?.length === 1 ? output[0]?.value : output,
              metadata: { usedSkills: [...usedSkills] },
            });
          }
        });

        es.addEventListener('answer.ready', (e: MessageEvent) => {
  const p = mine(e);
  if (!p || resolved) return;
  const fragments = p.payload?.fragments ?? [];

  // 收集所有数据片段
  const allInnerFragments = fragments.map((f: any) => f?.fragments ?? []).flat();
  const dataFragments = allInnerFragments.filter((f: any) => f.type === 'data');

  // 分离叙述性文本和结构化数据
  const narrativeParts: string[] = [];
  const structuredData: any[] = [];

  for (const f of dataFragments) {
    if (f.name === 'persona.summary' || f.name === 'reasoning_result' || f.name === 'ai_response') {
      narrativeParts.push(String(f.value));
    } else {
      structuredData.push({ type: f.name, data: f.value });
    }
  }

  const finalText = narrativeParts.join('\n\n');
  const finalData = structuredData.length === 1 ? structuredData[0] : (structuredData.length > 0 ? structuredData : null);

  done({
    type: 'ai',
    text: finalText || 'No additional details found.',
    data: finalData,
    metadata: { usedSkills: [...usedSkills] },
  });
});

        es.addEventListener('task.silent_complete', (e: MessageEvent) => {
          const p = mine(e);
          if (!p || resolved) return;
          done({
            type: 'ai',
            text: '',
            data: observations.length ? observations : null,
            metadata: { usedSkills: [...usedSkills] },
          });
        });

        es.addEventListener('task.failed', (e: MessageEvent) => {
          const p = mine(e);
          if (!p) return;
          fail(new Error(p.payload?.error ?? 'Task failed'));
        });
    
          let errorCount = 0;
          es.onerror = () => {
            if (resolved) return;
            errorCount++;
            console.warn('[useChat] SSE connection error, attempt:', errorCount);
            // 不立即 reject，给出恢复机会
            if (errorCount >= 3) {
              fail(new Error('Connection lost. Please try again.'));
            }
          };
      });

      stopPrelude();
      setStreamText('');
      setCurrentEventId(null);
      setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
    } catch (err) {
      stopPrelude();
      setCurrentEventId(null);
      console.error('[useChat]', err);
      setMessages(prev => [...prev, {
        id: ++idRef.current,
        role: 'assistant',
        result: { type: 'error', text: 'Request failed. Please retry.' },
      }]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      stopPrelude();
      loadingRef.current = false;
      setChatLoading(false);
    }
  }, [startPrelude, stopPrelude]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setStreamText('');
    setCurrentEventId(null);
  }, []);

  return {
    messages,
    chatLoading,
    sendMessage,
    clearMessages,
    streamText,
    currentEventId,
  };
}