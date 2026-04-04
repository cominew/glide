// D:\.openclaw\app\web-dashboard\src\hooks\useChat.ts
import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { ChatMessage } from '../types/chat';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const msgIdRef = useRef(0);
  const chatAbort = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (query: string, onError?: (err: any) => void) => {
    if (!query.trim() || chatLoading) return;

    const userMsg: ChatMessage = { id: ++msgIdRef.current, role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    if (chatAbort.current) chatAbort.current.abort();
    chatAbort.current = new AbortController();

    try {
      const result = await api.ask(query);
      const assistantMsg: ChatMessage = { id: ++msgIdRef.current, role: 'assistant', result };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      onError?.(err);
      const errorMsg: ChatMessage = {
        id: ++msgIdRef.current,
        role: 'assistant',
        result: { type: 'error', text: 'Request failed, please retry.' }
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
      chatAbort.current = null;
    }
  }, [chatLoading]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, chatLoading, sendMessage, clearMessages };
}