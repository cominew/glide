// apps/dashboard/hooks/useChat.ts
import { useState, useRef, useCallback } from 'react';
import { ChatMessage, AgentResult, Timeline } from '../types/chat';

const SESSION_ID = `session-${Date.now()}`;

const PRELUDE_LINES = [
  '🔷 Establishing secure connection to Glide Core... ',
  '🧠 Loading neural language model... ',
  '📚 Indexing knowledge base...',
  '⚙️ Calibrating reasoning engine... ',
  '🌐 Synchronizing with business data... ',
  '💡 Glide is thinking deeply about your request... ',
  '⏳ High‑quality responses may take a moment on this device. ',
  '✨ Almost there, thank you for your patience.',
  '🤖 Your AI assistant is preparing to respond... ',
  '🚀 Glide is launching your answer from the cloud... ',
  '🔍 Analyzing your query with advanced algorithms... ',
  '⚡ Optimizing response generation for your device... ',
  '⏱️ Just a few seconds while Glide crafts the perfect answer... ',
  '🔧 Tuning the AI engine for your specific request... ',
  '💭 Glide is having a thoughtful moment... ',
  '📊 Crunching data and generating insights... ',
  '⛅ Your AI response is being generated in the cloud... ',
  '🕰️ Quality takes time, and Glide is working hard to deliver the best answer... ',
  '🎯 Glide is focused on providing an accurate and helpful response... ',
];

export default function useChat() {
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [chatLoading,    setChatLoading]    = useState(false);
  const [streamText,     setStreamText]     = useState('');
  const [streamTimeline, setStreamTimeline] = useState<Timeline | null>(null);

  const idRef          = useRef(0);
  const loadingRef     = useRef(false);
  const preludeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preludeLinesRef = useRef<string[]>([]);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || loadingRef.current) return;

    if (preludeTimerRef.current) clearInterval(preludeTimerRef.current);

    loadingRef.current = true;
    setChatLoading(true);
    setStreamText('');
    setStreamTimeline(null);
    preludeLinesRef.current = [];

    // Show one prelude line at a time, one per 900ms
    let lineIndex = 0;
    const showNextLine = () => {
      if (lineIndex < PRELUDE_LINES.length) {
        preludeLinesRef.current = [...preludeLinesRef.current, PRELUDE_LINES[lineIndex]];
        setStreamText(preludeLinesRef.current.join('\n'));
        lineIndex++;
      }
    };
    showNextLine(); // show first line immediately
    preludeTimerRef.current = setInterval(showNextLine, 900);

    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: query }]);

    const stopPrelude = () => {
      if (preludeTimerRef.current) { clearInterval(preludeTimerRef.current); preludeTimerRef.current = null; }
    };
    console.log('[useChat] Starting SSE stream for query:', query);

    try {
      await streamQuery(
        query,
        SESSION_ID,
        (result) => {
          stopPrelude();
          if (result.text) {
            setStreamText(result.text);
            setStreamTimeline(result.metadata?.timeline ?? null);
            setTimeout(() => {
              setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
              setStreamText('');
              setStreamTimeline(null);
            }, 300);
          } else {
            setMessages(prev => [...prev, { id: ++idRef.current, role: 'assistant', result }]);
            setStreamText('');
            setStreamTimeline(null);
          }
        },
        (partialText, partialTimeline) => {
          const hasContent = partialText.trim().length > 0 ||
            partialTimeline.thinking ||
            partialTimeline.plan.steps.length > 0;
          if (hasContent) {
            stopPrelude();
            setStreamText(partialText);
            setStreamTimeline(partialTimeline);
          }
        }
      );
    } catch {
      stopPrelude();
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
      stopPrelude();
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

// ── SSE stream reader ─────────────────────────────────────────

async function streamQuery(
  query: string,
  sessionId: string,
  onDone: (result: AgentResult) => void,
  onProgress?: (text: string, timeline: Timeline) => void,
): Promise<void> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: query, sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const timeline: Timeline = {
    thinking: '', plan: { steps:[], raw:'' }, steps:[], finalAnswer:'',
  };
  const usedSkills: string[]  = [];
  const observations: unknown[] = [];

  const emitProgress = () => {
    if (!onProgress) return;
    let text = timeline.finalAnswer || '';
    if (!text) {
      const last = timeline.steps[timeline.steps.length - 1];
      if (last?.status === 'running')        text = `Executing ${last.skill}...`;
      else if (timeline.thinking)            text = 'Thinking...';
      else if (timeline.plan.steps.length)   text = 'Planning next steps...';
      else                                   text = 'Processing...';
    }
    onProgress(text, { ...timeline, steps: [...timeline.steps] });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const lines    = chunk.split('\n');
      const evtLine  = lines.find(l => l.startsWith('event:'));
      const dataLine = lines.find(l => l.startsWith('data:'));
      if (!evtLine || !dataLine) continue;

      const type = evtLine.replace('event:', '').trim();
const rawData = dataLine.replace('data:', '').trim();
console.log(`[useChat] 📨 event: ${type}, rawData length: ${rawData.length}`);

let payload: any;
let eventId: string | undefined;
let eventTaskId: string | undefined;
try {
  const parsed = JSON.parse(rawData);
  payload = parsed.payload;
  eventId = parsed.id;
  eventTaskId = parsed.taskId;  // 注意：Orchestrator 将 taskId 放在事件根部
  console.log(`[useChat] 📦 ${type} | eventId: ${eventId} | taskId: ${eventTaskId} | payload keys:`, Object.keys(payload || {}));
} catch (e) {
  console.warn(`[useChat] ❌ Failed to parse data for ${type}:`, rawData.slice(0, 100));
  continue;
}

      switch (type) {
        // Orchestrator events
        case 'thinking.end':
          timeline.thinking = payload?.thinking ?? '';
          emitProgress();
          break;

        case 'planning.end':
          timeline.plan = { steps: payload?.steps ?? [], raw: payload?.raw ?? '' };
          emitProgress();
          break;

        case 'skill.start':
          timeline.steps.push({ skill: payload?.skill, params: payload?.params ?? {}, status: 'running' });
          emitProgress();
          break;

        case 'skill.end': {
          usedSkills.push(payload?.skill);
          observations.push(payload?.output);
          const idx = [...timeline.steps].reverse().findIndex(s => s.skill === payload?.skill && s.status === 'running');
          if (idx >= 0) {
            const real = timeline.steps.length - 1 - idx;
            timeline.steps[real] = { ...timeline.steps[real], output: payload?.output, duration: payload?.duration, status: 'done' };
          }
          emitProgress();
          break;
        }

        case 'skill.error': {
          const idx = [...timeline.steps].reverse().findIndex(s => s.skill === payload?.skill && s.status === 'running');
          if (idx >= 0) timeline.steps[timeline.steps.length - 1 - idx] = { ...timeline.steps[timeline.steps.length - 1 - idx], status: 'error' };
          emitProgress();
          break;
        }

 case 'answer.end': {
  console.log('[useChat] answer.end payload:', payload);
  const answerText = payload?.answer ?? payload?.text ?? payload?.result ?? '';
  if (answerText) {
    timeline.finalAnswer = answerText;
    onDone({
      type: 'ai',
      text: answerText,
      data: observations.length === 1 ? observations[0] : observations,
      metadata: { usedSkills: [...usedSkills], timeline: { ...timeline, steps: [...timeline.steps] } },
    });
    return;
  }
  break;
}

case 'task.completed': {
  console.log('[useChat] task.completed payload:', payload);
  const result = payload?.result ?? payload?.output ?? payload;
  const text = typeof result === 'string' ? result : result?.text ?? result?.answer ?? result?.result ?? '';
  if (text && !timeline.finalAnswer) {
    timeline.finalAnswer = text;
    onDone({
      type: 'ai',
      text,
      metadata: { usedSkills: [...usedSkills], timeline: { ...timeline, steps: [...timeline.steps] } },
    });
    return;
  }
  break;
}

        case 'task.failed':
          throw new Error(payload?.error ?? 'Task failed');
      }
    }
  }

  // Stream closed without answer — return whatever we have
  if (timeline.finalAnswer) {
    onDone({ type: 'ai', text: timeline.finalAnswer, metadata: { usedSkills: [...usedSkills], timeline } });
  } else {
    throw new Error('Stream closed without answer');
  }
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
    type: 'ai', text: raw.output?.text ?? raw.result ?? '',
    data: obs.length === 1 ? obs[0] : obs.length > 1 ? obs : null,
    metadata: { usedSkills: raw.metadata?.usedSkills ?? [], timeline: raw.metadata?.timeline ?? null },
  };
}
