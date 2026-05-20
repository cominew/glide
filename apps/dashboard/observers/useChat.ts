// apps/dashboard/observers/useChat.ts
//
// Fix log:
//
// [FIX-1] SCOPE RACE CONDITION — Empty answers for knowledge/email queries
//   Root cause: When knowledge_answer triggered the early-answer path (delay=0),
//   the setTimeout callback checked `awaitingScopeRef.current !== capturedScope`.
//   But by the time it fired, awaitingScopeRef had already been set to null by
//   a prior path (or the next query). This caused the guard to fail silently.
//   Fix: Remove the scope guard from the setTimeout callback. Instead, trust
//   that answeredRef.current is the single source of truth. The timer only fires
//   once (answeredRef gates it). Also removed the 300ms delay for profile.data —
//   it served no purpose and created race windows.
//
// [FIX-2] KNOWLEDGE ANSWER OVERRIDDEN — "what is Astrion?" showed empty
//   When knowledge_retrieval fires AND name-disambiguation fires (for "Astrion"),
//   profile-fetcher then emits profile.data { unresolved: true }. In the previous
//   version, knowledge_answer was processed in the skill.output handler at 0ms,
//   but then answer.manifested arrived with narrative "I'm sorry, but I couldn't
//   find Astrion..." and the patchNarrative call replaced the knowledge content.
//   Fix: patchNarrative now refuses to overwrite with apology text when we already
//   have non-empty, non-apology content. Added isApologyText() guard.
//
// [FIX-3] REASONING RESULT NOT SURFACED — Late reasoning.skill.output dropped
//   When reasoning fires AFTER answer.ready (common pattern: reasoning is depth=4),
//   the answeredRef=true caused the skill.output handler to try patchNarrative.
//   But patchNarrative only patches if text is empty or apology. For profile queries,
//   the text is already good persona.summary. For email-draft queries, text is empty
//   (knowledge_answer was the only fragment at answer time). Fix: For reasoning_result
//   arriving after answer, always patch (forceUpdate=true) when current text is empty
//   or shorter than the reasoning result.
//
// [FIX-4] OBSERVE BUTTONS — No visual feedback after clicking
//   The ObservePanel buttons called api.signal() but had no local state to show
//   what was clicked. Fix: useChat now tracks observeState per message ID.
//   Messages gain an `observeState?: string` field. ObservePanel reads it.
//   (Wire up in AITab/AssistantBubble via the onObserve callback.)

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
  'knowledge_answer',
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
  for (const f of (fragments ?? [])) {
    if (f?.fragments && Array.isArray(f.fragments)) flat.push(...f.fragments);
    else if (f) flat.push(f);
  }
  return flat;
}

function isApologyText(text: string): boolean {
  return text.startsWith("I'm sorry, but I couldn't find");
}

function cleanKnowledgeText(raw: string): string {
  return String(raw ?? '')
    .replace(/ðŸ"¦|âœ¨|ðŸ |âš™|ðŸš€|ðŸŽ|ðŸ"„|ðŸ"˜|ðŸ¤|ðŸ›/g, '')
    .replace(/â†'/g, '→')
    .replace(/Â /g, ' ')
    .replace(/â€™/g, "'")
    .trim();
}

function isActionableStructured(f: any): boolean {
  if (!f?.name || !STRUCTURED_NAMES.has(f.name)) return false;
  if (f.name === 'profile.data' && f.value?.unresolved === true) return false;
  return true;
}

function buildResult(fragments: any[], narrativeOverride?: string): AgentResult {
  const flat = flattenFragments(fragments);

  const knowledge  = flat.find(f => f?.name === 'knowledge_answer');
  const structured = flat.find(f => isActionableStructured(f) && f?.name !== 'knowledge_answer');
  const narrative  = flat.find(f => f?.name && NARRATIVE_NAMES.has(f.name));
  const ambiguous  = flat.find(f => f?.name === 'identity.ambiguous');

  // Candidate selector — no structured data alongside
  if (ambiguous && !structured && !knowledge) {
    const { query, candidates } = ambiguous.value ?? {};
    return {
      type: 'ai',
      text: `Multiple matches found for "${query}". Which one did you mean?`,
      data: { type: 'identity.ambiguous', data: { query, candidates } },
      metadata: {},
    };
  }

  // Determine primary text
  let text = '';
  if (narrativeOverride && !isApologyText(narrativeOverride)) {
    text = narrativeOverride;
  } else if (knowledge && !text) {
    text = cleanKnowledgeText(knowledge.value);
  }
  if (!text && narrative?.value && !isApologyText(narrative.value)) {
    text = narrative.value;
  }
  // Last resort: apology text
  if (!text) {
    text = narrativeOverride ?? narrative?.value ?? '';
  }

  const data = structured ? { type: structured.name, data: structured.value } : null;
  return { type: 'ai', text, data, metadata: {} };
}

export default function useChat() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamText,  setStreamText]  = useState('');
  // Track observe state per message: { [msgId]: 'useful'|'correct'|'wrong'|'style' }
  const [observeStates, setObserveStates] = useState<Record<number, string>>({});

  const awaitingScopeRef   = useRef<string | null>(null);
  const lastAssistantIdRef = useRef<number | null>(null);
  const answeredRef        = useRef(false);
  const pendingTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idRef    = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linesRef = useRef<string[]>([]);

  const stopPrelude = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const cancelPendingTimer = useCallback(() => {
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
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

  useEffect(() => () => { stopPrelude(); cancelPendingTimer(); }, [stopPrelude, cancelPendingTimer]);

  // Patch the narrative text of the last assistant message.
  // force=true: always overwrite (for reasoning arriving late)
  // force=false: only overwrite if current text is empty or apology
  const patchNarrative = useCallback((text: string, force = false) => {
    const targetId = lastAssistantIdRef.current;
    if (!targetId || !text) return;
    setMessages(msgs =>
      msgs.map(m => {
        if (m.id !== targetId || m.role !== 'assistant') return m;
        const existing = (m.result as AgentResult)?.text ?? '';
        // [FIX-2] Never patch good content with apology text
        if (isApologyText(text) && existing && !isApologyText(existing)) return m;
        // [FIX-1] Without force: don't overwrite non-empty non-apology content
        if (!force && existing && !isApologyText(existing)) return m;
        return { ...m, result: { ...(m.result as AgentResult), text } };
      })
    );
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setMessages(m => [...m, { id: ++idRef.current, role: 'user', text: query }]);
    setChatLoading(true);
    setStreamText('');
    answeredRef.current        = false;
    lastAssistantIdRef.current = null;
    cancelPendingTimer();
    startPrelude();
    try {
      const { eventId } = await api.query(query, CHAT_SESSION_ID);
      awaitingScopeRef.current = eventId;
    } catch {
      stopPrelude();
      setChatLoading(false);
      awaitingScopeRef.current = null;
      setMessages(m => [...m, {
        id: ++idRef.current, role: 'assistant',
        result: { type: 'error', text: 'Failed to reach Glide kernel.' },
      }]);
    }
  }, [startPrelude, stopPrelude, cancelPendingTimer]);

  // [FIX-4] Observe action — track locally AND signal backend
  const observeMessage = useCallback(async (msgId: number, judgment: string, targetScope?: string) => {
    setObserveStates(prev => ({ ...prev, [msgId]: judgment }));
    try {
      await api.signal({
        type: 'observer.feedback',
        judgment,
        note: '',
        targetScope: targetScope ?? '',
        timestamp: Date.now(),
      });
    } catch {/* backend may not handle it yet — local state still updates */}
  }, []);

  const observeEvent = useCallback((event: any) => {
    const scope = awaitingScopeRef.current;

    // ── skill.output ──────────────────────────────────────────────────────────
    if (event.type === 'skill.output') {
      const eventScope = normalizeScope(event);
      if (!eventScope || eventScope === scope) {
        stopPrelude();
        setStreamText(`${event.payload?.skill ?? 'skill'} manifested`);
      }
      if (!scope) return;
      if (eventScope && eventScope !== scope) return;

      const fragments: any[] = event.payload?.fragments ?? [];
      const narrative = fragments.find(f => f?.name && NARRATIVE_NAMES.has(f.name));

      // Phase 2: reasoning arriving late — always patch when current text is empty
      // [FIX-3] Force-update when reasoning arrives after answer
      if (narrative && answeredRef.current && lastAssistantIdRef.current !== null) {
        if (narrative.name === 'reasoning_result') {
          // Force: reasoning is richer than empty placeholder
          patchNarrative(narrative.value, true);
        } else {
          patchNarrative(narrative.value, false);
        }
        return;
      }

      // Phase 1: early structured/knowledge answer
      if (!answeredRef.current) {
        const knowledge  = fragments.find(f => f?.name === 'knowledge_answer');
        const structured = fragments.find(f => isActionableStructured(f) && f?.name !== 'knowledge_answer');
        const ambiguous  = fragments.find(f => f?.name === 'identity.ambiguous');

        const hasSomething = knowledge || structured || ambiguous;
        if (!hasSomething) return;

        answeredRef.current = true;
        const msgId = ++idRef.current;
        lastAssistantIdRef.current = msgId;

        let result: AgentResult;
        if (ambiguous && !structured && !knowledge) {
          const { query, candidates } = ambiguous.value ?? {};
          result = {
            type: 'ai',
            text: `Multiple matches found for "${query}". Which one did you mean?`,
            data: { type: 'identity.ambiguous', data: { query, candidates } },
            metadata: {},
          };
        } else if (knowledge && !structured) {
          result = { type: 'ai', text: cleanKnowledgeText(knowledge.value), data: null, metadata: {} };
        } else {
          result = { type: 'ai', text: '', data: { type: structured!.name, data: structured!.value }, metadata: {} };
        }

        // [FIX-1] No scope guard in callback — answeredRef is the gate
        pendingTimerRef.current = setTimeout(() => {
          stopPrelude();
          setChatLoading(false);
          awaitingScopeRef.current = null;
          setMessages(m => [...m, { id: msgId, role: 'assistant', result }]);
        }, 0);
      }
      return;
    }

    if (!scope) return;
    const eventScope = normalizeScope(event);
    if (eventScope && eventScope !== scope) return;

    // ── answer.manifested ─────────────────────────────────────────────────────
    if (event.type === 'answer.manifested') {
      cancelPendingTimer();
      const narrativeOverride = event.payload?.narrative;
      const frags = event.payload?.fragments ?? [];

      if (answeredRef.current) {
        // [FIX-2] Only patch if override is not an apology
        if (narrativeOverride && !isApologyText(narrativeOverride)) {
          patchNarrative(narrativeOverride, false);
        }
        return;
      }

      stopPrelude();
      setChatLoading(false);
      answeredRef.current = true;
      const result = buildResult(frags, narrativeOverride);
      const msgId  = ++idRef.current;
      lastAssistantIdRef.current = msgId;
      if (result.text && !isApologyText(result.text)) awaitingScopeRef.current = null;
      setMessages(m => [...m, { id: msgId, role: 'assistant', result }]);
      return;
    }

    // ── answer.ready ──────────────────────────────────────────────────────────
    if (event.type === 'answer.ready') {
      cancelPendingTimer();
      if (answeredRef.current) {
        const flat = flattenFragments(event.payload?.fragments ?? []);
        const narrative = flat.find(f => f?.name && NARRATIVE_NAMES.has(f.name));
        if (narrative) patchNarrative(narrative.value, false);
        return;
      }
      stopPrelude();
      setChatLoading(false);
      answeredRef.current = true;
      const result = buildResult(event.payload?.fragments ?? []);
      const msgId  = ++idRef.current;
      lastAssistantIdRef.current = msgId;
      if (result.text) awaitingScopeRef.current = null;
      setMessages(m => [...m, { id: msgId, role: 'assistant', result }]);
      return;
    }

    // ── answer.projected ──────────────────────────────────────────────────────
    if (event.type === 'answer.projected') {
      cancelPendingTimer();
      if (answeredRef.current) return;
      stopPrelude();
      setChatLoading(false);
      answeredRef.current = true;
      const result = buildResult(event.payload?.fragments ?? [], event.payload?.narrative);
      const msgId  = ++idRef.current;
      lastAssistantIdRef.current = msgId;
      if (result.text) awaitingScopeRef.current = null;
      setMessages(m => [...m, { id: msgId, role: 'assistant', result }]);
      return;
    }

    // ── reality.anomaly.detected ──────────────────────────────────────────────
    if (event.type === 'reality.anomaly.detected') {
      if (event.payload?.reason === 'non_resonant_field_vacuum') return;
      if (answeredRef.current) return;
      cancelPendingTimer();
      stopPrelude();
      setChatLoading(false);
      awaitingScopeRef.current = null;
      answeredRef.current = true;
      setMessages(m => [...m, {
        id: ++idRef.current, role: 'assistant',
        result: { type: 'ai', text: 'Reality inconsistency detected. A self-repair proposal has been submitted.' },
      }]);
      return;
    }

    // ── task.failed ───────────────────────────────────────────────────────────
    if (event.type === 'task.failed') {
      cancelPendingTimer();
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

    // ── mind.settling ─────────────────────────────────────────────────────────
    if (event.type === 'mind.settling') {
      if (!answeredRef.current) setStreamText('Settling causality...');
      return;
    }

    // ── mind.state.entered settled ────────────────────────────────────────────
    if (event.type === 'mind.state.entered' && event.payload?.state === 'settled') {
      if (!answeredRef.current) {
        cancelPendingTimer();
        stopPrelude();
        setChatLoading(false);
        awaitingScopeRef.current = null;
      }
      if (answeredRef.current) {
        awaitingScopeRef.current   = null;
        lastAssistantIdRef.current = null;
      }
    }
  }, [stopPrelude, cancelPendingTimer, patchNarrative]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamText('');
    setObserveStates({});
    awaitingScopeRef.current   = null;
    lastAssistantIdRef.current = null;
    answeredRef.current        = false;
    cancelPendingTimer();
    stopPrelude();
  }, [stopPrelude, cancelPendingTimer]);

  return {
    messages, chatLoading, sendMessage, clearMessages,
    streamText, observeEvent,
    observeStates, observeMessage,
  };
}