// D:\.openclaw\app\web-dashboard\src\hooks\useChat.ts
import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
export function useChat() {
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const msgIdRef = useRef(0);
    const chatAbort = useRef(null);
    const sendMessage = useCallback(async (query, onError) => {
        if (!query.trim() || chatLoading)
            return;
        const userMsg = { id: ++msgIdRef.current, role: 'user', text: query };
        setMessages(prev => [...prev, userMsg]);
        setChatLoading(true);
        if (chatAbort.current)
            chatAbort.current.abort();
        chatAbort.current = new AbortController();
        try {
            const result = await api.ask(query);
            const assistantMsg = { id: ++msgIdRef.current, role: 'assistant', result };
            setMessages(prev => [...prev, assistantMsg]);
        }
        catch (err) {
            onError?.(err);
            const errorMsg = {
                id: ++msgIdRef.current,
                role: 'assistant',
                result: { type: 'error', text: 'Request failed, please retry.' }
            };
            setMessages(prev => [...prev, errorMsg]);
        }
        finally {
            setChatLoading(false);
            chatAbort.current = null;
        }
    }, [chatLoading]);
    const clearMessages = useCallback(() => setMessages([]), []);
    return { messages, chatLoading, sendMessage, clearMessages };
}
