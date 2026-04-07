import { useState, useRef, useCallback } from 'react';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  timeline?: any;
}

export interface Timeline {
  planning?: any;
  currentSkill?: string;
  skills?: { name: string; output: any }[];
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (query: string) => {
    if (isStreaming) return;

    const userMsg: ChatMessage = { id: Date.now(), role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);

    setIsStreaming(true);
    setCurrentAnswer('');
    setTimeline(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;
          const [eventLine, dataLine] = event.split('\n');
          const eventType = eventLine.replace('event: ', '');
          const data = JSON.parse(dataLine.replace('data: ', ''));

          switch (eventType) {
            case 'planning':
              setTimeline(prev => ({ ...prev, planning: data }));
              break;
            case 'skill-start':
              setTimeline(prev => ({ ...prev, currentSkill: data.skill }));
              break;
            case 'skill-end':
              setTimeline(prev => ({
                ...prev,
                skills: [...(prev?.skills || []), { name: data.skill, output: data.output }]
              }));
              break;
            case 'answer-token':
              setCurrentAnswer(prev => prev + data.token);
              break;
            case 'answer-end':
              setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text: currentAnswer, timeline }]);
              setCurrentAnswer('');
              setTimeline(null);
              break;
          }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isStreaming, currentAnswer, timeline]);

  return { messages, isStreaming, currentAnswer, timeline, sendMessage };
}