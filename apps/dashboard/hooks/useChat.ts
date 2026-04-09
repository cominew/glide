// apps/dashboard/hooks/useChat.ts
// Frontend Timeline Renderer — never waits for "the whole answer".
// Each event updates UI immediately.

import { useState, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:      number;
  role:    'user' | 'assistant';
  text?:   string;
  result?: AssistantResult;
}

export interface AssistantResult {
  type:      'ai' | 'error';
  text:      string;
  data?:     any;
  metadata?: {
    usedSkills?: string[];
    timeline?:   LiveTimeline;
  };
}

export interface LiveTimeline {
  thinking:    string;
  plan:        { steps: any[]; raw: string };
  steps:       LiveStep[];
  finalAnswer: string;
}

export interface LiveStep {
  skill:       string;
  params:      Record<string,unknown>;
  output?:     unknown;
  duration?:   number;
  outputType?: string;
  status:      'running' | 'done' | 'error';
}

// ── Session ID — stable per browser tab ──────────────────────────────────────

const SESSION_ID = `session-${Date.now()}`;

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useChat() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const idRef      = useRef(0);
  const loadingRef = useRef(false);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || loadingRef.current) return;

    loadingRef.current = true;
    setChatLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);

    try {
      await streamQuery(query, SESSION_ID, (result) => {
        setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
      });
    } catch {
      // SSE failed → REST fallback
      try {
        const result = await restQuery(query, SESSION_ID);
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

// ── SSE stream reader ─────────────────────────────────────────────────────────

async function streamQuery(
  query:     string,
  sessionId: string,
  onDone:    (result: AssistantResult) => void,
): Promise<void> {

  const res = await fetch('/api/chat/stream', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  // ── Accumulated timeline state ────────────────────────────────────────────
  const timeline: LiveTimeline = {
    thinking: '', plan: { steps: [], raw: '' }, steps: [], finalAnswer: '',
  };
  const usedSkills:   string[]  = [];
  const observations: unknown[] = [];

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
      let   payload: any;
      try { payload = JSON.parse(dataLine.replace('data:', '').trim()).payload; } catch { continue; }

      // ── Route each event type ───────────────────────────────────────────

      switch (eventType) {

        case 'task:start':
          // Nothing to render — user message already shown
          break;

        case 'task:heartbeat':
          // Heartbeat prevents UI from looking frozen — no visible change needed
          // but could be used to show a spinner label with elapsed time
          break;

        case 'thinking:start':
          // Phase started — CognitiveStream will show spinner
          break;

        case 'thinking:end':
          timeline.thinking = payload.thinking ?? '';
          break;

        case 'planning:end':
          timeline.plan = { steps: payload.steps ?? [], raw: payload.raw ?? '' };
          break;

        case 'skill:start': {
          // Add a "running" step to the timeline
          timeline.steps.push({
            skill:  payload.skill,
            params: payload.params ?? {},
            status: 'running',
          });
          break;
        }

        case 'skill:end': {
          // Update the matching step to "done"
          usedSkills.push(payload.skill);
          observations.push(payload.output);
          const idx = timeline.steps.findLastIndex(s => s.skill === payload.skill && s.status === 'running');
          if (idx >= 0) {
            timeline.steps[idx] = {
              ...timeline.steps[idx],
              output:     payload.output,
              duration:   payload.duration,
              outputType: payload.outputType,
              status:     'done',
            };
          } else {
            timeline.steps.push({
              skill:      payload.skill,
              params:     {},
              output:     payload.output,
              duration:   payload.duration,
              outputType: payload.outputType,
              status:     'done',
            });
          }
          break;
        }

        case 'skill:error': {
          const idx = timeline.steps.findLastIndex(s => s.skill === payload.skill && s.status === 'running');
          if (idx >= 0) {
            timeline.steps[idx] = { ...timeline.steps[idx], status: 'error' };
          }
          break;
        }

        case 'aggregation:start':
          // Could show "🔄 Synthesising N results..."
          break;

        case 'answer:end': {
          timeline.finalAnswer = payload.answer ?? '';
          const structured = observations.length === 1 ? observations[0]
                           : observations.length > 1  ? observations
                           : null;
          onDone({
            type: 'ai',
            text: payload.answer ?? '',
            data: structured,
            metadata: {
              usedSkills: [...usedSkills],
              timeline:   { ...timeline, steps: [...timeline.steps] },
            },
          });
          return; // Done
        }

        case 'task:error':
          throw new Error(payload.error ?? 'Agent error');
      }
    }
  }

  throw new Error('Stream closed without answer:end event');
}

// ── REST fallback ─────────────────────────────────────────────────────────────

async function restQuery(query: string, sessionId: string): Promise<AssistantResult> {
  const res  = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw  = await res.json();
  const obs  = raw.output?.observations ?? [];
  return {
    type: 'ai',
    text: raw.output?.text ?? '',
    data: obs.length === 1 ? obs[0] : obs.length > 1 ? obs : null,
    metadata: {
      usedSkills: raw.metadata?.usedSkills ?? [],
      timeline:   raw.metadata?.timeline   ?? null,
    },
  };
}
