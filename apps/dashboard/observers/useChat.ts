// apps/dashboard/observers/useChat.ts
// ─────────────────────────────────────────────────────────────
// Glide v4 — Event-native chat
//
// v4 server has no /api/chat/start.
// A query is emitted via POST /api/query → { eventId }.
//
// The eventId becomes the correlation key.
// We watch the global EventSource for events where
//   event.trace.taskId  matches eventId  (kernel routing)
// or
//   event.payload.eventId matches eventId (direct correlation)
//
// answer.final or answer.end → render result.
// task.silent_complete or task.completed → fallback render.
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import { ChatMessage, AgentResult, Timeline } from '../events/chat';
import { api } from '../gateways/api';

export const CHAT_SESSION_ID = `session-${Date.now()}`;
const TURN_TIMEOUT_MS = 180_000;

const PRELUDE = [
  'Connecting to event field...',
  'Awaiting capability emergence...',
  'Processing...',
];

export default function useChat() {
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [chatLoading,   setChatLoading]   = useState(false);
  const [streamText,    setStreamText]    = useState('');
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  const idRef           = useRef(0);
  const loadingRef      = useRef(false);
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
      // Step 1: emit query into the event field
      const { eventId } = await api.query(query, CHAT_SESSION_ID);
      setCurrentEventId(eventId);

      // Step 2: open scoped EventSource — filter by eventId
      // v4: field routes by input.user eventId, not taskId
      // We accept both trace.taskId and payload.eventId as correlation
      const result = await new Promise<AgentResult>((resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          es.close();
          reject(new Error('No answer from event field after 180s'));
        }, TURN_TIMEOUT_MS);

        // Listen on the global stream — filter for our eventId
        const es = new EventSource(`/api/events/stream`);

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

        // Correlation: does this event belong to our query?
        const mine = (e: MessageEvent): any | null => {
          try {
            const parsed = JSON.parse(e.data);
            const eid = parsed.trace?.taskId
              ?? parsed.payload?.eventId
              ?? parsed.payload?.taskId
              ?? parsed.payload?.correlationId;
            if (eid === eventId) return parsed;
          } catch {}
          return null;
        };

        // skill.output — collect observations and update prelude
        es.addEventListener('skill.output', (e: MessageEvent) => {
          const p = mine(e);
          if (!p) return;
          const skill  = p.payload?.skill;
          const output = p.payload?.output;
          if (skill) usedSkills.push(skill);
          if (output != null) observations.push(output);
          stopPrelude();
          setStreamText(`${skill ?? 'skill'} responded`);
        });


es.addEventListener('answer.ready', (e: MessageEvent) => {
  const p = mine(e);
  if (!p || resolved) return;

  const fragments = p.payload?.fragments ?? [];
  if (fragments.length === 0) {
    done({ type: 'ai', text: '', metadata: { usedSkills: [...usedSkills] } });
    return;
  }

  // 提取结构化数据：fragments[0] 是 skill.output，再往里是 fragment 数组
  const firstOutput = fragments[0];
  const innerFragments = firstOutput?.fragments ?? [];
  
  // 收集所有 fragment 的文本和数据
  const textParts: string[] = [];
  const allData: any[] = [];

  for (const frag of innerFragments) {
    if (frag.value) {
      allData.push(frag.value);
      textParts.push(typeof frag.value === 'string' ? frag.value : JSON.stringify(frag.value, null, 2));
    }
  }

  done({
    type: 'ai',
    text: textParts.join('\n'),
    data: fragments.length === 1 && innerFragments.length === 1 ? innerFragments[0]?.value : fragments,
    metadata: { usedSkills: [firstOutput?.skill ?? 'skill'] },
  });
});

        es.addEventListener('answer.final', (e: MessageEvent) => {
          const p = mine(e);
          if (!p) return;
          const assembled = p.payload?.assembled ?? p.payload?.outputs?.[0];
          done({
            type: 'ai',
            text: typeof assembled === 'string' ? assembled : '',
            data: assembled,
            metadata: { usedSkills: [...usedSkills] },
          });
        });

        // answer.end — legacy alias, same handling
        es.addEventListener('answer.end', (e: MessageEvent) => {
          const p = mine(e);
          if (!p) return;
          const answer = p.payload?.answer;
          if (answer == null) return;
          done({
            type: 'ai',
            text: typeof answer === 'string' ? answer : '',
            data: answer,
            metadata: { usedSkills: [...usedSkills] },
          });
        });

        // task.silent_complete — v4 silence detector
        es.addEventListener('task.silent_complete', (e: MessageEvent) => {
          const p = mine(e);
          if (!p || resolved) return;
          // silence: no skills responded — answer is null
          done({
            type: 'ai',
            text: '',
            data: observations.length ? observations : null,
            metadata: { usedSkills: [...usedSkills] },
          });
        });

        // task.completed — fallback
        es.addEventListener('task.completed', (e: MessageEvent) => {
          const p = mine(e);
          if (!p || resolved) return;
          const result = p.payload?.result;
          const text   = typeof result === 'string' ? result : result?.answer ?? result?.text ?? '';
          done({
            type: 'ai',
            text,
            data: result ?? null,
            metadata: { usedSkills: [...usedSkills] },
          });
        });

        es.addEventListener('task.failed', (e: MessageEvent) => {
          const p = mine(e);
          if (!p) return;
          fail(new Error(p.payload?.error ?? 'Task failed'));
        });

        es.onerror = () => {
          if (!resolved) fail(new Error('SSE connection error'));
        };
      });

      stopPrelude();
      setStreamText('');
      setCurrentEventId(null);
      setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);

    } catch (err) {
      stopPrelude();
      setCurrentEventId(null);
      console.error('[useChat v4]', err);
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
    messages, chatLoading, sendMessage, clearMessages,
    streamText, currentEventId,
  };
}
