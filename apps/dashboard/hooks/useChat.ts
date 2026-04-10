// apps/dashboard/hooks/useChat.ts
import { useState, useRef, useCallback } from 'react';
import { ChatMessage, AgentResult, Timeline } from '../types/chat';

const SESSION_ID = `session-${Date.now()}`;

const PRELUDE_LINES = [
  '🔷 Establishing secure connection to Glide Core...',
  '🧠 Loading neural language model...',
  '📚 Indexing knowledge base...',
  '⚙️ Calibrating reasoning engine...',
  '🌐 Synchronizing with business data...',
  '💡 Glide is thinking deeply about your request...',
  '⏳ High‑quality responses may take a moment on this device.',
  '✨ Almost there, thank you for your patience.',
];

export default function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamTimeline, setStreamTimeline] = useState<Timeline | null>(null);

  const idRef = useRef(0);
  const loadingRef = useRef(false);
  const preludeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || loadingRef.current) return;

    if (preludeTimerRef.current) clearInterval(preludeTimerRef.current);

    loadingRef.current = true;
    setChatLoading(true);
    setStreamText('');
    setStreamTimeline(null);

    const firstLine = PRELUDE_LINES[0];
    setStreamText(firstLine + ' ▋');
    const accumulatedLines: string[] = [firstLine];
    let lineIndex = 1;
    let preludeFinished = false;
    let answerReceived = false;  // 防止重复处理

    preludeTimerRef.current = setInterval(() => {
      if (lineIndex < PRELUDE_LINES.length) {
        accumulatedLines.push(PRELUDE_LINES[lineIndex]);
        lineIndex++;
      } else {
        preludeFinished = true;
      }
      setStreamText(accumulatedLines.join('\n') + ' ▋');
    }, 600);

    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);

    try {
      await streamQuery(
        query,
        SESSION_ID,
        (result) => {
          answerReceived = true;
          if (preludeTimerRef.current) clearInterval(preludeTimerRef.current);
          
          // 如果答案有文本内容，先展示在流式气泡中，再转为正式消息
          if (result.text) {
            setStreamText(result.text);
            setStreamTimeline(result.metadata?.timeline || null);
            setTimeout(() => {
              setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
              setStreamText('');
              setStreamTimeline(null);
            }, 400); // 短暂停留让用户看到答案
          } else {
            setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
            setStreamText('');
            setStreamTimeline(null);
          }
        },
        (partialText, partialTimeline) => {
          if (answerReceived) return;
          const hasContent = partialText.trim().length > 0 ||
                             partialTimeline.thinking ||
                             partialTimeline.plan.steps.length > 0;
          if (hasContent) {
            answerReceived = true;
            if (preludeTimerRef.current) clearInterval(preludeTimerRef.current);
            setStreamText(partialText);
            setStreamTimeline(partialTimeline);
          } else if (preludeFinished) {
            setStreamText('🔄 Processing your request...');
          }
        }
      );
    } catch {
      if (preludeTimerRef.current) clearInterval(preludeTimerRef.current);
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
      if (preludeTimerRef.current) clearInterval(preludeTimerRef.current);
      loadingRef.current = false;
      setChatLoading(false);
    }
  }, []);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setStreamText('');
    setStreamTimeline(null);
    try {
      await fetch('/api/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID }),
      });
    } catch {}
  }, []);

  return { messages, chatLoading, sendMessage, clearMessages, streamText, streamTimeline };
}



// ── SSE stream reader (保持不变，与之前一致) ─────────────────────────────────
async function streamQuery(
  query: string,
  sessionId: string,
  onDone: (result: AgentResult) => void,
  onProgress?: (text: string, timeline: Timeline) => void
): Promise<void> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const timeline: Timeline = {
    thinking: '',
    plan: { steps: [], raw: '' },
    steps: [],
    finalAnswer: '',
  };
  const usedSkills: string[] = [];
  const observations: unknown[] = [];

  const emitProgress = () => {
    if (onProgress) {
      let displayText = timeline.finalAnswer || '';
      if (!displayText) {
        const lastStep = timeline.steps[timeline.steps.length - 1];
        if (lastStep?.status === 'running') {
          displayText = `⏳ Executing ${lastStep.skill}...`;
        } else if (timeline.thinking) {
          displayText = '💭 Thinking...';
        } else if (timeline.plan.steps.length > 0) {
          displayText = '📋 Planning next steps...';
        } else {
          displayText = '🔄 Synthesizing response...';
        }
      }
      onProgress(displayText, { ...timeline, steps: [...timeline.steps] });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;

      const lines = chunk.split('\n');
      const eventLine = lines.find(l => l.startsWith('event:'));
      const dataLine = lines.find(l => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;

      const eventType = eventLine.replace('event:', '').trim();
      let payload: any;
      try { payload = JSON.parse(dataLine.replace('data:', '').trim()).payload; } catch { continue; }

      switch (eventType) {
        case 'task:start':
        case 'task:heartbeat':
        case 'thinking:start':
          break;

        case 'thinking:end':
          timeline.thinking = payload.thinking ?? '';
          emitProgress();
          break;

        case 'planning:end':
          timeline.plan = { steps: payload.steps ?? [], raw: payload.raw ?? '' };
          emitProgress();
          break;

        case 'skill:start': {
          timeline.steps.push({
            skill: payload.skill,
            params: payload.params ?? {},
            status: 'running',
          });
          emitProgress();
          break;
        }

        case 'skill:end': {
          usedSkills.push(payload.skill);
          observations.push(payload.output);
          let idx = -1;
          for (let i = timeline.steps.length - 1; i >= 0; i--) {
            const s = timeline.steps[i];
            if (s.skill === payload.skill && s.status === 'running') {
              idx = i;
              break;
            }
          }
          if (idx >= 0) {
            timeline.steps[idx] = {
              ...timeline.steps[idx],
              output: payload.output,
              duration: payload.duration,
              outputType: payload.outputType,
              status: 'done',
            };
          } else {
            timeline.steps.push({
              skill: payload.skill,
              params: {},
              output: payload.output,
              duration: payload.duration,
              outputType: payload.outputType,
              status: 'done',
            });
          }
          emitProgress();
          break;
        }

        case 'skill:error': {
          let idx = -1;
          for (let i = timeline.steps.length - 1; i >= 0; i--) {
            const s = timeline.steps[i];
            if (s.skill === payload.skill && s.status === 'running') {
              idx = i;
              break;
            }
          }
          if (idx >= 0) {
            timeline.steps[idx] = { ...timeline.steps[idx], status: 'error' };
          }
          emitProgress();
          break;
        }

        case 'aggregation:start':
          emitProgress();
          break;

        case 'answer:end': {
          timeline.finalAnswer = payload.answer ?? '';
          emitProgress();

          const structured = observations.length === 1
            ? observations[0]
            : observations.length > 1
            ? observations
            : null;
          onDone({
            type: 'ai',
            text: payload.answer ?? '',
            data: structured,
            metadata: {
              usedSkills: [...usedSkills],
              timeline: { ...timeline, steps: [...timeline.steps] },
            },
          });
          return;
        }

        case 'task:error':
          throw new Error(payload.error ?? 'Agent error');
      }
    }
  }

  throw new Error('Stream closed without answer:end event');
}

async function restQuery(query: string, sessionId: string): Promise<AgentResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const obs = raw.output?.observations ?? [];
  return {
    type: 'ai',
    text: raw.output?.text ?? '',
    data: obs.length === 1 ? obs[0] : obs.length > 1 ? obs : null,
    metadata: {
      usedSkills: raw.metadata?.usedSkills ?? [],
      timeline: raw.metadata?.timeline ?? null,
    },
  };
}