// apps/dashboard/observers/useChat.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage, AgentResult } from '../events/chat';
import { api } from '../gateways/api';

export const CHAT_SESSION_ID = `session-${Date.now()}`;

const PRELUDE = [
  'Entering event field...',
  'Awaiting causal resonance...',
  'Observing emergence...',
];

const NARRATIVE_NAMES  = new Set(['persona.summary', 'reasoning_result', 'ai_response']);
const STRUCTURED_NAMES = new Set([
  'customer_list', 'top_customers', 'profile.data',
  'overview', 'monthly_report', 'sales_by_country', 'sales_data',
]);

function normalizeScope(event: any): string | null {
  return (
    event?.payload?.scopeId  ??
    event?.payload?.chainId  ??
    event?.trace?.scopeId    ??
    null
  );
}

function flattenFragments(fragments: any[]): any[] {
  const flat: any[] = [];
  for (const f of fragments) {
    if (f.fragments && Array.isArray(f.fragments)) flat.push(...flattenFragments(f.fragments));
    else flat.push(f);
  }
  return flat;
}

// ⭐ Observer Collapse Resolver：将多 fragment 收敛为单一显现场
function resolveReality(fragments: any[], query?: string): AgentResult {
  const flat = flattenFragments(fragments);

  const fact = flat.find(f =>
    f.name === 'profile.data' ||
    f.name === 'customer_list' ||
    f.name === 'overview' ||
    f.name === 'monthly_report' ||
    f.name === 'sales_by_country'
  );

  const narrative = flat.find(f =>
    f.name === 'persona.summary' ||
    f.name === 'reasoning_result' ||
    f.name === 'ai_response'
  );

  let finalText = '';
  if (fact && !fact.value?.unresolved) {
    finalText = JSON.stringify(fact.value, null, 2);
  }
  if (narrative) {
    finalText = finalText
      ? `${finalText}\n\n---\n\n${narrative.value}`
      : narrative.value;
  }

  // ⭐ 回退处理：如果没有任何内容，显示结构化提示
  if (!finalText) {
    finalText = fact
      ? 'Customer identity could not be fully resolved. Try a different name.'
      : 'No matching records found.';
  }

  return {
    type: 'ai',
    text: finalText,
    data: fact && !fact.value?.unresolved ? { type: fact.name, data: fact.value } : null,
    metadata: {},
  };
}

export default function useChat() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamText,  setStreamText]  = useState('');

  const awaitingScopeRef   = useRef<string | null>(null);
  const lastAssistantIdRef = useRef<number | null>(null);
  const answeredRef        = useRef(false);

  const idRef    = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linesRef = useRef<string[]>([]);

  const stopPrelude = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startPrelude = useCallback(() => {
    linesRef.current = [];
    let i = 0;
    const tick = () => {
      if (i < PRELUDE.length) {
        linesRef.current = [...linesRef.current, PRELUDE[i++]];
        setStreamText(linesRef.current.join('\n'));
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => () => stopPrelude(), [stopPrelude]);

  const patchNarrative = useCallback((text: string) => {
    const targetId = lastAssistantIdRef.current;
    if (targetId === null) return;
    setMessages(msgs =>
      msgs.map(m =>
        m.id === targetId && m.role === 'assistant'
          ? { ...m, result: { ...(m.result as AgentResult), text } }
          : m
      )
    );
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setMessages(m => [...m, { id: ++idRef.current, role: 'user', text: query }]);
    setChatLoading(true);
    setStreamText('');
    answeredRef.current        = false;
    lastAssistantIdRef.current = null;
    startPrelude();
    try {
      const { eventId } = await api.query(query, CHAT_SESSION_ID);
      awaitingScopeRef.current = eventId;
    } catch (err) {
      console.error('[useChat] emit failed', err);
      stopPrelude();
      setChatLoading(false);
      awaitingScopeRef.current = null;
      setMessages(m => [...m, {
        id: ++idRef.current, role: 'assistant',
        result: { type: 'error', text: 'Failed to reach Glide kernel.' },
      }]);
    }
  }, [startPrelude, stopPrelude]);

  const observeEvent = useCallback((event: any) => {
    const scope = awaitingScopeRef.current;

    // ── skill.output：进度 + 补丁入口 ────────────────
    if (event.type === 'skill.output') {
      const eventScope = normalizeScope(event);

      if (!eventScope || eventScope === scope) {
        stopPrelude();
        setStreamText(`${event.payload?.skill ?? 'skill'} manifested`);
      }

      if (!scope) return;
      if (eventScope && eventScope !== scope) return;

      const fragments: any[] = event.payload?.fragments ?? [];
      const narrative = fragments.find(f => NARRATIVE_NAMES.has(f.name));

      // 叙事补丁
      if (narrative && answeredRef.current && lastAssistantIdRef.current !== null) {
        patchNarrative(narrative.value);
        return;
      }

      // 首次获得结构化数据 => 占位，等待叙事
      if (!answeredRef.current) {
        const structured = fragments.find(f => STRUCTURED_NAMES.has(f.name));
        if (structured) {
          answeredRef.current = true;
          const msgId = ++idRef.current;
          lastAssistantIdRef.current = msgId;
          stopPrelude();
          setChatLoading(false);
          setMessages(m => [...m, {
            id: msgId, role: 'assistant',
            result: { type: 'ai', text: '', data: { type: structured.name, data: structured.value }, metadata: {} },
          }]);
        }
      }
      return;
    }

    // ── 其他事件需要 scope ─────────────────────────────
    if (!scope) return;
    const eventScope = normalizeScope(event);
    if (eventScope && eventScope !== scope) return;

    // ── answer.ready ─────────────────────────────────────
    if (event.type === 'answer.ready') {
      if (answeredRef.current) {
        const flat = flattenFragments(event.payload?.fragments ?? []);
        const narrative = flat.find(f => NARRATIVE_NAMES.has(f.name));
        if (narrative && lastAssistantIdRef.current !== null) {
          patchNarrative(narrative.value);
        }
        return;
      }

      stopPrelude();
      setChatLoading(false);
      answeredRef.current = true;

      const result = resolveReality(event.payload?.fragments ?? []);
      const msgId  = ++idRef.current;
      lastAssistantIdRef.current = msgId;
      setMessages(m => [...m, { id: msgId, role: 'assistant', result }]);
      return;
    }

    // ── answer.projected ────────────────────────────────
    if (event.type === 'answer.projected') {
      if (answeredRef.current) return;
      stopPrelude();
      setChatLoading(false);
      answeredRef.current = true;

      const result = resolveReality(event.payload?.fragments ?? []);
      const msgId  = ++idRef.current;
      lastAssistantIdRef.current = msgId;
      setMessages(m => [...m, { id: msgId, role: 'assistant', result }]);
      return;
    }

    // ── reality.anomaly.detected（抑制真空噪音）─────────
    if (event.type === 'reality.anomaly.detected') {
      if (event.payload?.reason === 'non_resonant_field_vacuum') return;
      if (answeredRef.current) return;
      stopPrelude();
      setChatLoading(false);
      awaitingScopeRef.current = null;
      answeredRef.current = true;
      setMessages(m => [...m, {
        id: ++idRef.current, role: 'assistant',
        result: { type: 'ai', text: 'Reality inconsistency detected.\nA self-repair proposal has been submitted.' },
      }]);
      return;
    }

    // ── task.failed ──────────────────────────────────────
    if (event.type === 'task.failed') {
      stopPrelude();
      setChatLoading(false);
      awaitingScopeRef.current = null;
      answeredRef.current = true;
      setMessages(m => [...m, {
        id: ++idRef.current, role: 'assistant',
        result: { type: 'error', text: event.payload?.error ?? 'Task failed.' },
      }]);
      return;
    }

    // mind.settling：若尚未有答案，显示进展提示
    if (event.type === 'mind.settling') {
      if (!answeredRef.current) setStreamText('Causality collapsing...');
    }

    // mind.state.entered：心智已定，关闭 scope
    if (event.type === 'mind.state.entered' && event.payload?.state === 'settled') {
      awaitingScopeRef.current = null;
      lastAssistantIdRef.current = null;
      if (!answeredRef.current) {
        stopPrelude();
        setChatLoading(false);
        answeredRef.current = true;
      }
    }
  }, [stopPrelude, patchNarrative]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamText('');
    awaitingScopeRef.current   = null;
    lastAssistantIdRef.current = null;
    answeredRef.current        = false;
    stopPrelude();
  }, [stopPrelude]);

  return { messages, chatLoading, sendMessage, clearMessages, streamText, observeEvent };
}