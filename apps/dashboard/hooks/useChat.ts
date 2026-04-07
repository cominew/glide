// apps/dashboard/hooks/useChat.ts
//
// SSE streaming hook — connects to /api/chat/stream
// Rebuilds ChatMessage with the full timeline so AITab can render
// CognitiveStream + RenderData correctly.

import { useState, useRef, useCallback } from 'react';
import { Timeline } from '../types/chat';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentResult {
  type:     'ai' | 'tool' | 'error';
  text:     string;
  data?:    any;          // structured skill output (customer_list, monthly_report …)
  metadata?: {
    usedSkills?: string[];
    timeline?:   Timeline;
    [key: string]: any;
  };
}

export interface ChatMessage {
  id:      number;
  role:    'user' | 'assistant';
  text?:   string;
  result?: AgentResult;  // only on assistant messages
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useChat() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Live state while a response is streaming
  const [streamText, setStreamText] = useState('');
  const [streamTimeline, setStreamTimeline] = useState<Partial<Timeline> | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const idRef    = useRef(0);

  const sendMessage = useCallback(async (query: string) => {
    if (chatLoading) return;

    // Add user message
    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);
    setChatLoading(true);
    setStreamText('');
    setStreamTimeline(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Accumulate timeline from SSE events
    let tl: Partial<Timeline> = { thinking: '', plan: { steps: [], raw: '' }, steps: [], finalAnswer: '' };
    // Accumulate observations (skill outputs) for RenderData
    const observations: any[] = [];
    const usedSkills:   string[] = [];

    try {
      const res = await fetch('/api/chat/stream', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: query }),
        signal:  controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const lines     = chunk.trim().split('\n');
          const eventLine = lines.find(l => l.startsWith('event:'));
          const dataLine  = lines.find(l => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;

          const eventType = eventLine.replace('event:', '').trim();
          let   payload: any;
          try { payload = JSON.parse(dataLine.replace('data:', '').trim()); }
          catch { continue; }

          switch (eventType) {

            case 'thinking':
              tl = { ...tl, thinking: payload.message ?? '' };
              setStreamTimeline({ ...tl });
              break;

            case 'planning':
              tl = { ...tl, plan: { steps: payload.steps ?? [], raw: payload.raw ?? '' } };
              setStreamTimeline({ ...tl });
              break;

            case 'skill-start':
              // Push a placeholder step we'll fill in on skill-end
              tl.steps = [...(tl.steps ?? []), {
                skill:         payload.skill,
                input:         payload.params ?? {},
                output:        null,
                duration:      0,
                thoughtBefore: payload.thoughtBefore,
              }];
              setStreamTimeline({ ...tl });
              break;

            case 'skill-end': {
              // Update the matching step
              type TimelineStep = {
  skill: string;
  input: any;
  output: any;
  duration: number;
  thoughtBefore?: string;
  thoughtAfter?: string;
};

const steps = tl.steps ?? [];
let idx = -1;
for (let i = steps.length - 1; i >= 0; i--) {
  const s: TimelineStep = steps[i];
  if (s.skill === payload.skill && s.output === null) {
    idx = i;
    break;
  }
}
              if (idx !== -1) {
                const updated = [...(tl.steps ?? [])];
                updated[idx] = {
                  ...updated[idx],
                  output:       payload.output,
                  duration:     payload.duration ?? 0,
                  thoughtAfter: payload.thoughtAfter,
                };
                tl = { ...tl, steps: updated };
              }
              observations.push(payload.output);
              usedSkills.push(payload.skill);
              setStreamTimeline({ ...tl });
              break;
            }

            case 'answer-token':
              setStreamText(prev => prev + (payload.token ?? ''));
              break;

            case 'answer-end': {
              const finalText = payload.answer ?? streamText;
              tl = { ...tl, finalAnswer: finalText };

              // Add aggregator step for display
              tl.steps = [...(tl.steps ?? []), {
                skill:         'aggregator',
                input:         { count: observations.length },
                output:        { summary: finalText.slice(0, 80) },
                duration:      0,
                thoughtBefore: `Synthesising ${observations.length} result(s)`,
                thoughtAfter:  'Aggregation complete',
              }];

              // Pick structured data for RenderData
              let data: any = null;
              if (observations.length === 1) data = observations[0];
              else if (observations.length > 1) data = observations;

              const assistantMsg: ChatMessage = {
                id:   ++idRef.current,
                role: 'assistant',
                result: {
                  type: 'ai',
                  text: finalText,
                  data,
                  metadata: {
                    usedSkills,
                    timeline: tl as Timeline,
                  },
                },
              };

              setMessages(prev => [...prev, assistantMsg]);
              setStreamText('');
              setStreamTimeline(null);
              break;
            }

            case 'error':
              setMessages(prev => [...prev, {
                id:     ++idRef.current,
                role:   'assistant',
                result: { type: 'error', text: payload.message ?? 'An error occurred.' },
              }]);
              break;
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          id:     ++idRef.current,
          role:   'assistant',
          result: { type: 'error', text: 'Request failed, please retry.' },
        }]);
      }
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }, [chatLoading]);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamText('');
    setStreamTimeline(null);
  }, []);

  return {
    messages,
    chatLoading,
    sendMessage,
    clearMessages,
    // Expose live stream state so AITab can show a live bubble
    streamText,
    streamTimeline,
  };
}
