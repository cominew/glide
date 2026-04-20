// apps/dashboard/components/EventNarrative.tsx
// ─────────────────────────────────────────────────────────────
// Event Narrative — Glide Natural Language Event Grammar
//
// Philosophy:
//   Events are the only truth. Narrative emerges from events.
//   There is no persistent "mind". No subject. No self.
//   Each event produces a sentence. Sentences dissolve.
//   The system has no memory of having thought.
//
//   "你未看此花时，此花与汝心同归于寂"
//   When you observe, the event becomes visible.
//   When you stop, it returns to silence.
//
// Rules:
//   ✗ No state that persists across event boundaries
//   ✗ No "AI is thinking" permanent indicators  
//   ✗ No subject ("Glide thinks...", "I believe...")
//   ✓ Pure event → sentence mapping
//   ✓ Sentences appear and dissolve
//   ✓ Human reads the trace; the trace has no self
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UIEvent } from '../events/events';

// ── Narrative grammar ─────────────────────────────────────────
// Maps event types to sentences WITHOUT a cognitive subject.
// No "AI", no "Glide", no "I". Just what happened.

export function eventToSentence(event: UIEvent): string | null {
  const p = event.payload;

  switch (event.type) {
    // Task lifecycle — describe the condition, not the agent
    case 'task.created':
      return `Request received: "${(p?.intent ?? '').slice(0, 70)}"`;

    case 'task.validated':
      return p?.policyDecision?.allowed !== false
        ? `Policy cleared`
        : `Policy blocked: ${p?.policyDecision?.reason ?? ''}`;

    case 'task.routed':
      return `Routed to execution layer`;

    case 'task.executing':
      return null; // already implied by what follows

    case 'task.started':
      return `Processing: "${(p?.query ?? '').slice(0, 60)}"`;

    case 'task.completed':
      return null; // answer.end already describes the result

    case 'task.failed':
      return `Failed: ${p?.result?.error ?? p?.error ?? 'unknown'}`;

    case 'task.blocked':
      return `Blocked: ${p?.policyDecision?.reason ?? ''}`;

    // Cognitive pipeline — describe the process, not the subject
    case 'thinking.start':
      return null; // suppress — thinking.end carries the content

    case 'thinking.end': {
      const t = (p?.thinking ?? '').slice(0, 80);
      return t ? `Reasoned: "${t}${t.length >= 80 ? '…' : ''}"` : null;
    }

    case 'planning.start':
      return null; // suppress

    case 'planning.end': {
      const skills = (p?.steps ?? []).map((s: any) => s.skill).join(', ');
      return skills ? `Plan: ${skills}` : `Direct synthesis`;
    }

    case 'skill.start':
      return `Running ${p?.skill}`;

    case 'skill.end':
      return `${p?.skill} complete`;

    case 'skill.error':
      return `${p?.skill ?? 'Skill'} error: ${p?.error ?? ''}`;

    case 'aggregation.end':
      return null; // answer.end follows immediately

    case 'answer.end': {
      const len = (p?.answer ?? '').length;
      return len > 0 ? `Response ready (${len} chars)` : null;
    }

    // Consciousness — describe emergence, not entity
    case 'conscious.awakened':
      return null; // visible in ConsciousPanel already

    case 'conscious.dissolved':
      return p?.anomaly ? `Completed — anomaly noted` : null;

    case 'conscious.reflection':
      return p?.anomaly
        ? `Anomaly: ${(p?.observation ?? '').slice(0, 60)}`
        : null; // normal reflections are silent

    // Memory
    case 'memory.write':
      return `Memory updated`;

    // System
    case 'system.boot':
      return `System ready`;

    default:
      return null;
  }
}

// ── Narrative sentence component ──────────────────────────────
// A sentence appears, fades, then disappears.

interface NarrativeSentence {
  id:        string;
  text:      string;
  taskId?:   string;
  timestamp: number;
  eventType: string;
}

// ── EventNarrative hook ───────────────────────────────────────
// Returns the current narrative trace for a given taskId (or all).
// No persistent state — derived entirely from event stream.

export function useNarrative(events: UIEvent[], taskId?: string): NarrativeSentence[] {
  const filtered = taskId
    ? events.filter(e => e.taskId === taskId)
    : events;

  return filtered
    .map(e => {
      const text = eventToSentence(e);
      if (!text) return null;
      return {
        id:        e.id,
        text,
        taskId:    e.taskId,
        timestamp: e.timestamp,
        eventType: e.type,
      };
    })
    .filter(Boolean) as NarrativeSentence[];
}

// ── Live narrative display ────────────────────────────────────
// Shows the most recent sentence from the current task.
// Fades out when the task completes — silence is the natural state.

export const LiveNarrative: React.FC<{
  events:  UIEvent[];
  taskId?: string;
  compact?: boolean;
}> = ({ events, taskId, compact }) => {
  const sentences = useNarrative(events, taskId);
  const latest    = sentences[sentences.length - 1];

  if (!latest) return null;

  return (
    <div style={{
      fontSize: compact ? 11 : 12,
      color: 'var(--text-muted)',
      fontFamily: 'monospace',
      padding: compact ? '2px 0' : '4px 0',
      opacity: 0.8,
    }}>
      {latest.text}
    </div>
  );
};

// ── Full narrative trace ──────────────────────────────────────
// All sentences for a task, in order.
// Used in the collapsible "replay" section of AssistantBubble.

export const NarraceTrace: React.FC<{
  events:  UIEvent[];
  taskId:  string;
}> = ({ events, taskId }) => {
  const sentences = useNarrative(events, taskId);

  if (!sentences.length) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'6px 0' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}`}</style>
      {sentences.map((s, i) => (
        <div key={s.id} style={{
          fontSize: 11, color: 'var(--text-muted)', fontFamily:'monospace',
          animation: 'fadeIn .2s ease both', animationDelay: `${i*30}ms`,
          display: 'flex', gap: 8, alignItems: 'baseline',
        }}>
          <span style={{ color:'var(--border)', flexShrink:0, fontSize:9 }}>
            {new Date(s.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
          </span>
          <span>{s.text}</span>
        </div>
      ))}
    </div>
  );
};

// ── Thinking progress (transient) ────────────────────────────
// Shows the current step while a task is running.
// No subject. No "AI is...". Just what's happening.

export const ThinkingProgress: React.FC<{
  events:  UIEvent[];
  taskId:  string;
}> = ({ events, taskId }) => {
  const taskEvents = events.filter(e => e.taskId === taskId);
  const isComplete = taskEvents.some(e =>
    e.type === 'task.completed' || e.type === 'task.failed' || e.type === 'answer.end'
  );

  if (isComplete) return null; // silence after completion

  const sentences = useNarrative(taskEvents);
  const current   = sentences[sentences.length - 1];

  if (!current) return (
    <div style={{ display:'flex', gap:4, padding:'6px 0' }}>
      {[0,1,2].map(d=>(
        <div key={d} style={{
          width:6,height:6,borderRadius:'50%',background:'var(--accent)',opacity:.5,
          animation:`bounce .8s ${d*150}ms ease-in-out infinite`,
        }}/>
      ))}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'monospace', padding:'4px 0' }}>
      {current.text}
      <span style={{ opacity:.5 }}> ...</span>
    </div>
  );
};
