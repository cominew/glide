// components/EventViewer.tsx
// ─────────────────────────────────────────────────────────────
// Glide OS — Event Viewer
// The visual cortex. Single UI for all kernel event observation.
// Replaces: LogsTab + LogsPanelRealtime + CognitiveStream
//
// Modes:
//   live    — scrolling real-time event stream
//   replay  — task playback with scrubber
//   inspect — single event detail
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UIEvent, EventFilter, ReplaySession } from '../events/events';
import { EventFilters, CATEGORY_COLORS } from './EventFilters';

// ── Single event row ──────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  ok:      'var(--success)',
  warn:    'var(--warning)',
  error:   'var(--danger)',
  pending: 'var(--accent)',
};

const EventRow: React.FC<{
  event:    UIEvent;
  selected: boolean;
  onClick:  () => void;
  compact?: boolean;
}> = ({ event, selected, onClick, compact }) => {
  const catColor = CATEGORY_COLORS[event.category] ?? '#888';
  const dotColor = STATUS_DOT[event.status ?? 'ok'];
  const ts = new Date(event.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: compact ? '5px 12px' : '8px 14px',
        borderBottom: '0.5px solid var(--border)',
        background: selected ? 'var(--accent-dim)' : 'transparent',
        cursor: 'pointer', transition: 'background .1s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--row-hover)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* Category stripe */}
      <div style={{ width: 3, height: compact ? 28 : 36, borderRadius: 2, background: catColor, flexShrink: 0 }} />

      {/* Status dot */}
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

      {/* Timestamp */}
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0, minWidth: 72 }}>{ts}</span>

      {/* Type pill */}
      <span style={{
        fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
        padding: '1px 6px', borderRadius: 4,
        background: catColor + '18', color: catColor,
        flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{event.type}</span>

      {/* Label */}
      <span style={{
        fontSize: 12, color: 'var(--text-primary)', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{event.label}</span>

      {/* Source */}
      {event.source && !compact && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{event.source}</span>
      )}

      {/* Duration badge */}
      {event.duration !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{event.duration}ms</span>
      )}
    </div>
  );
};

// ── Event detail panel ────────────────────────────────────────

const EventDetail: React.FC<{ event: UIEvent; onClose: () => void }> = ({ event, onClose }) => (
  <div style={{
    background: 'var(--card-bg)', border: '0.5px solid var(--border)',
    borderRadius: 12, padding: 16, marginTop: 8,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{event.type}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 12px', fontSize: 12 }}>
      {[
        ['ID',        event.id],
        ['Task',      event.taskId ?? '—'],
        ['Category',  event.category],
        ['Source',    event.source ?? '—'],
        ['Status',    event.status ?? '—'],
        ['Time',      new Date(event.timestamp).toISOString()],
      ].map(([k, v]) => (
        <React.Fragment key={k}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{k}</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
    {event.payload && (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Payload</div>
        <pre style={{
          fontSize: 11, fontFamily: 'monospace', background: 'var(--code-bg)',
          borderRadius: 8, padding: 10, overflow: 'auto', maxHeight: 200,
          color: 'var(--text-primary)', margin: 0, border: '0.5px solid var(--border)',
        }}>{JSON.stringify(event.payload, null, 2)}</pre>
      </div>
    )}
  </div>
);

// ── Replay scrubber ───────────────────────────────────────────

const ReplayView: React.FC<{ session: ReplaySession }> = ({ session }) => {
  const [cursor, setCursor] = useState(session.events.length - 1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCursor(c => {
          if (c >= session.events.length - 1) { setPlaying(false); return c; }
          return c + 1;
        });
      }, 400);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, session.events.length]);

  const visible = session.events.slice(0, cursor + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary */}
      {session.summary && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>Duration</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{session.summary.duration}ms</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>Skills</div>
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>{session.summary.skillsUsed.join(', ') || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>Events</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{session.events.length}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setCursor(0)}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ⏮ Start
        </button>
        <button onClick={() => setPlaying(p => !p)}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => setCursor(session.events.length - 1)}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ⏭ End
        </button>
        <input type="range" min={0} max={session.events.length - 1} value={cursor}
          onChange={e => { setPlaying(false); setCursor(Number(e.target.value)); }}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60 }}>{cursor + 1} / {session.events.length}</span>
      </div>

      {/* Visible events */}
      <div style={{ border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
        {visible.map((e, i) => (
          <EventRow key={e.id} event={e} selected={i === cursor} onClick={() => setCursor(i)} compact />
        ))}
      </div>
    </div>
  );
};

// ── Main EventViewer ──────────────────────────────────────────

interface EventViewerProps {
  events:         UIEvent[];
  connected?:     boolean;
  onFilter?:      (f: EventFilter) => UIEvent[];
  getSession?:    (taskId: string) => ReplaySession | null;
  onClear?:       () => void;
  embedded?:      boolean;   // true = no outer card, used inside AITab
  taskId?:        string;    // pre-filter by task
}

export const EventViewer: React.FC<EventViewerProps> = ({
  events, connected = true, onFilter, getSession, onClear, embedded, taskId: propTaskId,
}) => {
  const [preset,       setPreset]     = useState('All');
  const [activeFilter, setActiveFilter] = useState<Partial<EventFilter>>({ patterns: ['*'] });
  const [taskIdFilter, setTaskIdFilter] = useState<string | undefined>(propTaskId);
  const [selected,     setSelected]   = useState<UIEvent | null>(null);
  const [replayId,     setReplayId]   = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const fullFilter: EventFilter = {
    ...activeFilter,
    patterns: activeFilter.patterns ?? ['*'],
    taskId: taskIdFilter,
  };

  const visible = onFilter ? onFilter(fullFilter) : events.filter(e => {
    if (fullFilter.taskId && e.taskId !== fullFilter.taskId) return false;
    if (fullFilter.categories?.length && !fullFilter.categories.includes(e.category)) return false;
    if (fullFilter.status?.length && e.status && !fullFilter.status.includes(e.status)) return false;
    if (fullFilter.patterns?.length && !fullFilter.patterns.includes('*')) {
      return fullFilter.patterns.some(p => {
        if (p.endsWith('.*')) return e.type.startsWith(p.slice(0,-2) + '.');
        return e.type === p;
      });
    }
    return true;
  });

  // Collect unique task IDs for filter dropdown
  const taskIds = [...new Set(events.map(e => e.taskId).filter(Boolean) as string[])].slice(-10);

  // Replay session
  const replaySession = replayId && getSession ? getSession(replayId) : null;

  const wrapper = (children: React.ReactNode) => embedded ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>{children}</div>
  ) : (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {children}
    </div>
  );

  return wrapper(
    <>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Event stream</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{visible.length} events</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {taskIds.length > 0 && (
            <button onClick={() => setReplayId(taskIds[taskIds.length - 1])}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--bg-overlay)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              ▶ Replay last
            </button>
          )}
          {onClear && (
            <button onClick={onClear}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <EventFilters
          active={preset}
          onChange={(label, f) => { setPreset(label); setActiveFilter(f); }}
          taskIds={taskIds}
          onTaskFilter={setTaskIdFilter}
        />
      </div>

      {/* Replay mode */}
      {replaySession && (
        <div style={{ padding: 14, borderBottom: '0.5px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Replay — {replayId?.slice(0,24)}…</span>
            <button onClick={() => setReplayId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕ Exit replay</button>
          </div>
          <ReplayView session={replaySession} />
        </div>
      )}

      {/* Event list */}
      <div ref={scrollRef} onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            {connected ? 'Waiting for events...' : 'Disconnected from event stream'}
          </div>
        )}
        {visible.map(e => (
          <EventRow key={e.id} event={e}
            selected={selected?.id === e.id}
            onClick={() => setSelected(s => s?.id === e.id ? null : e)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ flexShrink: 0, padding: '0 14px 14px', maxHeight: 320, overflowY: 'auto' }}>
          <EventDetail event={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div style={{ padding: '6px 14px', textAlign: 'center', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => { setAutoScroll(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }}
            style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ↓ Jump to latest
          </button>
        </div>
      )}
    </>
  );
};
