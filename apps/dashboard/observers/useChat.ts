// apps/dashboard/hooks/useChat.ts
// ─────────────────────────────────────────────────────────────
// Event-native chat.
//
// A "conversation turn" is:
//   1. POST /api/chat/stream → get X-Task-Id header
//   2. Watch global EventSource (via useGlide) for events
//      where event.taskId === this task's id
//   3. When answer.end or task.completed arrives → render answer
//
// No manual SSE byte-reading. No Promise-wrapped RPC.
// The answer is just an event, observed like any other event.
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage, AgentResult, Timeline } from '../events/chat';
import { UIEvent, EventCategory, EventFilter, ReplaySession } from '../events/events';

export const CHAT_SESSION_ID = `session-${Date.now()}`;

const PRELUDE_LINES = [
  'Connecting to Glide Core...',
  'Loading language model...',
  'Indexing knowledge base...',
  'Processing your request...',
];

// ── ChatTurn — tracks one in-flight conversation turn ─────────

interface ChatTurn {
  taskId:    string;
  query:     string;
  timeline:  Timeline;
  usedSkills: string[];
  observations: unknown[];
  resolve:   (result: AgentResult) => void;
  reject:    (err: Error) => void;
  timeout:   ReturnType<typeof setTimeout>;
}

// ── Hook ──────────────────────────────────────────────────────

export default function useChat() {
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [chatLoading,    setChatLoading]    = useState(false);
  const [streamText,     setStreamText]     = useState('');
  const [streamTimeline, setStreamTimeline] = useState<Timeline | null>(null);

  const idRef           = useRef(0);
  const loadingRef      = useRef(false);
  const preludeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preludeLinesRef = useRef<string[]>([]);
  const activeTurnRef   = useRef<ChatTurn | null>(null);

  // ── Prelude helpers ───────────────────────────────────────

  const stopPrelude = useCallback(() => {
    if (preludeTimerRef.current) {
      clearInterval(preludeTimerRef.current);
      preludeTimerRef.current = null;
    }
  }, []);

  const startPrelude = useCallback(() => {
    preludeLinesRef.current = [];
    let lineIndex = 0;
    const show = () => {
      if (lineIndex < PRELUDE_LINES.length) {
        preludeLinesRef.current = [...preludeLinesRef.current, PRELUDE_LINES[lineIndex]];
        setStreamText(preludeLinesRef.current.join('\n'));
        lineIndex++;
      }
    };
    show();
    preludeTimerRef.current = setInterval(show, 900);
  }, []);

  // ── Event observer — called by parent with each UIEvent ───
  // This is what makes useChat event-native:
  // instead of reading bytes, we observe UIEvents.

  const observeEvent = useCallback((event: UIEvent) => {
    const turn = activeTurnRef.current;
    if (!turn) return;
    if (event.taskId !== turn.taskId) return;

    const p = event.payload;

    switch (event.type) {
      case 'thinking.end':
        turn.timeline.thinking = p?.thinking ?? '';
        if (turn.timeline.thinking) {
          stopPrelude();
          setStreamText('Thinking...');
          setStreamTimeline({ ...turn.timeline });
        }
        break;

      case 'planning.end':
        turn.timeline.plan = { steps: p?.steps ?? [], raw: '' };
        if (turn.timeline.plan.steps.length) {
          setStreamText(`Planning: ${turn.timeline.plan.steps.map((s:any)=>s.skill).join(', ')}`);
          setStreamTimeline({ ...turn.timeline });
        }
        break;

      case 'skill.start':
        turn.timeline.steps.push({ skill: p?.skill, params: p?.params ?? {}, status: 'running' });
        setStreamText(`Executing ${p?.skill}...`);
        setStreamTimeline({ ...turn.timeline, steps: [...turn.timeline.steps] });
        break;

      case 'skill.end': {
        turn.usedSkills.push(p?.skill);
        turn.observations.push(p?.output);
        const idx = [...turn.timeline.steps].reverse()
          .findIndex(s => s.skill === p?.skill && s.status === 'running');
        if (idx >= 0) {
          const i = turn.timeline.steps.length - 1 - idx;
          turn.timeline.steps[i] = { ...turn.timeline.steps[i], output: p?.output, duration: p?.duration, status: 'done' };
        }
        setStreamTimeline({ ...turn.timeline, steps: [...turn.timeline.steps] });
        break;
      }

      case 'skill.error': {
        const idx = [...turn.timeline.steps].reverse()
          .findIndex(s => s.skill === p?.skill && s.status === 'running');
        if (idx >= 0) {
          const i = turn.timeline.steps.length - 1 - idx;
          turn.timeline.steps[i] = { ...turn.timeline.steps[i], status: 'error' };
        }
        break;
      }

      case 'aggregation.end': {
        const text = p?.answer ?? p?.summary ?? '';
        if (text && !turn.timeline.finalAnswer) {
          turn.timeline.finalAnswer = text;
          setStreamText(text.slice(0, 100) + '...');
        }
        break;
      }

      case 'answer.end': {
        const text = p?.answer ?? p?.text ?? '';
        if (text) {
          turn.timeline.finalAnswer = text;
          clearTimeout(turn.timeout);
          activeTurnRef.current = null;
          turn.resolve({
            type: 'ai',
            text,
            data: turn.observations.length === 1
              ? turn.observations[0]
              : turn.observations.length > 1 ? turn.observations : null,
            metadata: {
              usedSkills: [...turn.usedSkills],
              timeline:   { ...turn.timeline, steps: [...turn.timeline.steps] },
            },
          });
        }
        break;
      }

      case 'task.completed': {
        // Fallback: if answer.end didn't fire
        if (activeTurnRef.current?.taskId === turn.taskId) {
          const result = p?.result ?? p;
          const text = typeof result === 'string'
            ? result
            : result?.answer ?? result?.text ?? '';
          if (text) {
            turn.timeline.finalAnswer = text;
            clearTimeout(turn.timeout);
            activeTurnRef.current = null;
            turn.resolve({
              type: 'ai', text,
              metadata: { usedSkills: [...turn.usedSkills], timeline: { ...turn.timeline } },
            });
          }
        }
        break;
      }

      case 'task.failed': {
        clearTimeout(turn.timeout);
        activeTurnRef.current = null;
        turn.reject(new Error(p?.error ?? 'Task failed'));
        break;
      }
    }
  }, [stopPrelude]);

  // ── Send message ──────────────────────────────────────────

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || loadingRef.current) return;

    stopPrelude();
    loadingRef.current = true;
    setChatLoading(true);
    setStreamText('');
    setStreamTimeline(null);

    startPrelude();
    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);

    try {
      // Step 1: POST to dispatch task, get taskId from header
      const res = await fetch('/api/chat/stream', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: query, sessionId: CHAT_SESSION_ID }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const taskId = res.headers.get('X-Task-Id');
      if (!taskId) throw new Error('Server did not return X-Task-Id header');

      // Release the response body — we don't need to read it
      // (events come through the global EventSource)
      res.body?.cancel().catch(() => {});

      // Step 2: Register turn — resolves when answer.end arrives via observeEvent()
      const result = await new Promise<AgentResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          activeTurnRef.current = null;
          reject(new Error('No answer after 180s'));
        }, 180_000);

        activeTurnRef.current = {
          taskId,
          query,
          timeline: { thinking:'', plan:{ steps:[], raw:'' }, steps:[], finalAnswer:'' },
          usedSkills: [],
          observations: [],
          resolve,
          reject,
          timeout,
        };
      });

      stopPrelude();
      setStreamText('');
      setStreamTimeline(null);
      setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);

    } catch (err) {
      stopPrelude();
      activeTurnRef.current = null;
      console.error('[useChat] failed:', err);
      setMessages(prev => [...prev, {
        id: ++idRef.current,
        role: 'assistant',
        result: { type: 'error', text: 'Request failed. Please retry.' },
      }]);
    } finally {
      stopPrelude();
      loadingRef.current = false;
      setChatLoading(false);
    }
  }, [startPrelude, stopPrelude]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setStreamText('');
    setStreamTimeline(null);
    activeTurnRef.current = null;
    try {
      await fetch('/api/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: CHAT_SESSION_ID }),
      });
    } catch {}
  }, []);

  return {
    messages, chatLoading, sendMessage, clearMessages,
    streamText, streamTimeline,
    observeEvent,   // ← parent must wire this to the global event stream
  };
}
