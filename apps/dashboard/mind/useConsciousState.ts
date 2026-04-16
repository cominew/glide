// dashboard/mind/useConsciousState.ts
// ─────────────────────────────────────────────────────────────
// Subscribes to conscious.state.updated from the event stream.
// Gives any panel real-time access to what Glide is thinking.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

export type ConsciousPhase =
  | 'idle' | 'receiving' | 'thinking' | 'planning'
  | 'executing' | 'reflecting' | 'waiting_human';

export interface ConsciousState {
  focus:         string;
  thought:       string;
  activeGoal:    string | null;
  cognitiveLoad: number;
  phase:         ConsciousPhase;
  updatedAt:     number;
}

const DEFAULT: ConsciousState = {
  focus:         'System idle',
  thought:       '',
  activeGoal:    null,
  cognitiveLoad: 0,
  phase:         'idle',
  updatedAt:     Date.now(),
};

const PHASE_LABEL: Record<ConsciousPhase, string> = {
  idle:           'Idle',
  receiving:      'Receiving',
  thinking:       'Thinking',
  planning:       'Planning',
  executing:      'Executing',
  reflecting:     'Reflecting',
  waiting_human:  'Waiting for human',
};

const PHASE_COLOR: Record<ConsciousPhase, string> = {
  idle:           'var(--text-muted)',
  receiving:      'var(--accent)',
  thinking:       '#8b5cf6',
  planning:       '#f59e0b',
  executing:      'var(--success)',
  reflecting:     '#ec4899',
  waiting_human:  'var(--warning)',
};

export { PHASE_LABEL, PHASE_COLOR };

export function useConsciousState(streamUrl = '/api/events/stream') {
  const [state, setState] = useState<ConsciousState>(DEFAULT);

  useEffect(() => {
    // Try to fetch current state immediately (from /api/ops)
    fetch('/api/ops')
      .then(r => r.json())
      .then(data => {
        if (data?.consciousState) setState(data.consciousState);
      })
      .catch(() => {});

    // Then subscribe to live updates
    const es = new EventSource(streamUrl);

    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data);
        const payload = event.payload;
        if (payload && payload.phase) {
          setState({
            focus:         payload.focus         ?? DEFAULT.focus,
            thought:       payload.thought        ?? DEFAULT.thought,
            activeGoal:    payload.activeGoal     ?? null,
            cognitiveLoad: payload.cognitiveLoad  ?? 0,
            phase:         payload.phase          ?? 'idle',
            updatedAt:     payload.updatedAt      ?? Date.now(),
          });
        }
      } catch {}
    };

    es.addEventListener('conscious.state.updated', handler);
    es.onerror = () => {};

    return () => {
      es.removeEventListener('conscious.state.updated', handler);
      es.close();
    };
  }, [streamUrl]);

  return state;
}
