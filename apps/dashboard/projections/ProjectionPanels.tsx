// apps/dashboard/projections/ProjectionPanels.tsx
//
// Fix log:
//
// [FIX-A] AUTHORITY QUEUE — Machine language in proposals
//   proposal.arisen from COGNITION source now has `description` field with
//   human-readable text ("Customer identity could not be fully resolved.").
//   AuthorityPanel now displays description prominently under the title,
//   with reasoning shown as secondary text.
//
// [FIX-B] AGENDA — Duplicate anomaly entries
//   Both `reflection.created` AND `cognition.anomaly.detected` were creating
//   separate Agenda items with the same text. Reflections are now suppressed
//   from Agenda when the same text is already present as an anomaly entry.
//   Also: Agenda items are now deduplicated by text content — same observation
//   text = same item, no matter how many events produced it.
//
// [FIX-C] OBSERVE PANEL — Visual feedback after selection
//   ObservePanel now accepts `currentState` prop and shows which judgment
//   was selected (highlighted button + confirmation line). The four buttons
//   remain visible so the user can change their judgment.
//   Wire up: pass observeStates[msg.id] and observeMessage(msg.id, j) from
//   the parent component (AITab / AssistantBubble).

import React, { useState } from 'react';
import { RealityProjection, ProjectedProposal, ProjectedAgendaItem } from './projection-observer';
import { api } from '../gateways/api';

// ══════════════════════════════════════════════════════
// ObservePanel (standalone — used in AITab/AssistantBubble)
// ══════════════════════════════════════════════════════

// [FIX-C] Now accepts currentState and onObserve
export const ObservePanel: React.FC<{
  currentState?: string;
  onObserve:     (judgment: string) => void;
}> = ({ currentState, onObserve }) => {
  const judgments = [
    { key: 'useful',   label: 'Useful',   color: '#10b981' },
    { key: 'correct',  label: 'Correct',  color: '#3b82f6' },
    { key: 'wrong',    label: 'Wrong',    color: '#ef4444' },
    { key: 'style',    label: 'Style',    color: '#a855f7' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        Observe:
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {judgments.map(({ key, label, color }) => {
          const active = currentState === key;
          return (
            <button
              key={key}
              onClick={() => onObserve(key)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${active ? color : 'var(--border)'}`,
                background: active ? `${color}22` : 'transparent',
                color: active ? color : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {active ? `✓ ${label}` : label}
            </button>
          );
        })}
      </div>
      {currentState && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Observation recorded · field notified
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// ConsciousPanel
// ══════════════════════════════════════════════════════

export const ConsciousPanel: React.FC<{ projection: RealityProjection }> = ({ projection }) => {
  const { cognitive } = projection;

  const elapsedSec = cognitive.eventTime !== null
    ? Math.round((Date.now() - cognitive.eventTime) / 1000)
    : null;

  const elapsed = elapsedSec === null ? null
    : elapsedSec < 5    ? 'just now'
    : elapsedSec < 60   ? `${elapsedSec}s ago`
    : elapsedSec < 3600 ? `${Math.round(elapsedSec / 60)}m ago`
    : null;

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cognitive.color,
            boxShadow: cognitive.color !== 'var(--text-muted)' ? `0 0 6px ${cognitive.color}` : 'none',
          }} />
          <span style={{ fontSize: 12, color: cognitive.color, fontWeight: 700 }}>{cognitive.headline}</span>
        </div>
        {elapsed && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{elapsed}</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic' }}>
        {cognitive.narrative}
      </div>
      {cognitive.subtext && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cognitive.subtext}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// AgendaPanel
// ══════════════════════════════════════════════════════

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  approval: { bg: '#FAEEDA', color: '#633806' },
  suggest:  { bg: '#E6F1FB', color: '#0C447C' },
  risk:     { bg: '#FCEBEB', color: '#791F1F' },
  info:     { bg: '#EAF3DE', color: '#27500A' },
};

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <span style={{ fontSize: 11, color: '#BA7517', minWidth: 48, flexShrink: 0 }}>
    {'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}
  </span>
);

export const AgendaPanel: React.FC<{
  projection: RealityProjection;
  onDismiss?: (id: string) => void;
}> = ({ projection, onDismiss }) => {
  const { agenda } = projection;

  const SEED: ProjectedAgendaItem = {
    id: 'seed', stars: 2, tagType: 'info',
    text: 'Field at rest — start an AI task to generate agenda items',
    tag: 'System', since: Date.now(),
  };

  const displayItems = agenda.length > 0 ? agenda : [SEED];

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Agenda</div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {agenda.length} item{agenda.length !== 1 ? 's' : ''}
        </span>
      </div>

      {displayItems.map(item => (
        <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          <Stars n={item.stars} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 5 }}>{item.text}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px',
                background: TAG_STYLE[item.tagType]?.bg ?? '#f1f5f9',
                color:      TAG_STYLE[item.tagType]?.color ?? '#475569',
              }}>{item.tag}</span>
              {onDismiss && item.id !== 'seed' && (
                <button onClick={() => onDismiss(item.id)}
                  style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}>
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// AuthorityPanel
// ══════════════════════════════════════════════════════

const STATE_LABEL: Record<string, string> = {
  approved: '✓ Approved',
  rejected: '✕ Rejected',
  deferred: '⟳ Deferred',
};

function requiresGate(p: ProjectedProposal): boolean {
  return p.state === 'draft' && p.authorityRequired === true;
}

// [FIX-A] Human-readable proposal descriptions
function humanizeAnomalyDescription(description: string): { headline: string; detail: string } {
  const d = description ?? '';

  if (d.includes('Currency mismatch')) {
    return {
      headline: 'Currency mismatch in response',
      detail: 'The AI used the wrong currency for this customer\'s country. Approve to let the AI self-correct, or reject to flag it.',
    };
  }
  if (d.includes('Ambiguous identity unresolved')) {
    return {
      headline: 'Multiple customers matched, none chosen',
      detail: 'The query matched several customers but no single one was selected. The response may be incomplete.',
    };
  }
  if (d.includes('Customer identity could not be fully resolved')) {
    return {
      headline: 'Customer not found in records',
      detail: 'No customer matched the name in the query. The response acknowledged this. Approve if the response is acceptable, or reject to retry.',
    };
  }
  if (d.includes('Reasoning generated without concrete profile')) {
    return {
      headline: 'Analysis without verified customer data',
      detail: 'The reasoning skill produced insights without a confirmed customer profile. Results may be speculative.',
    };
  }
  // Generic fallback
  if (d) {
    return { headline: d.split(';')[0].trim(), detail: d };
  }
  return { headline: 'Quality issue detected', detail: 'The outcome evaluator flagged an issue with the previous response.' };
}

const ProposalCard: React.FC<{
  proposal:   ProjectedProposal;
  onApprove:  () => void;
  onReject:   () => void;
  onDefer:    () => void;
  onFeedback: (text: string) => void;
}> = ({ proposal, onApprove, onReject, onDefer, onFeedback }) => {
  const [showInput, setShowInput] = useState(false);
  const [text,      setText]      = useState('');

  // [FIX-A] Use human-readable descriptions
  const { headline, detail } = humanizeAnomalyDescription(proposal.description);

  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-overlay)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{headline}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{detail}</div>

      {showInput && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && text.trim()) { onFeedback(text.trim()); setShowInput(false); setText(''); }
              if (e.key === 'Escape') setShowInput(false);
            }}
            placeholder="Describe the correction..."
            style={{ flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
          />
          <button onClick={() => { if (text.trim()) { onFeedback(text.trim()); setShowInput(false); setText(''); }}}
            style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Send
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button onClick={onApprove} style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Approve</button>
        <button onClick={onReject}  style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Reject</button>
        <button onClick={onDefer}   style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>⟳ Defer</button>
        <button onClick={() => setShowInput(v => !v)}
          style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: '1px solid #8b5cf6', background: showInput ? '#8b5cf6' : 'transparent', color: showInput ? '#fff' : '#8b5cf6', fontSize: 11, cursor: 'pointer' }}>
          ↩ Correct
        </button>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {new Date(proposal.createdAt).toLocaleTimeString()} · {proposal.id.slice(0, 8)}
      </div>
    </div>
  );
};

export const AuthorityPanel: React.FC<{ projection: RealityProjection }> = ({ projection }) => {
  const pending  = Array.from(projection.proposals.values()).filter(requiresGate);
  const resolved = Array.from(projection.proposals.values())
    .filter(p => p.state !== 'draft')
    .slice(-5).reverse();

  const resolve = async (proposalId: string, decision: string, feedbackText?: string) => {
    try {
      await api.signal({
        type: 'authority.resolved', proposalId, decision,
        ...(feedbackText ? { feedbackText, injectQuery: feedbackText } : {}),
        timestamp: Date.now(),
      });
    } catch {}
  };

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Authority queue</div>
        {pending.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--warning)', color: '#412402' }}>
            {pending.length} pending
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
          No decisions awaiting human judgment.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map(p => (
            <ProposalCard key={p.id} proposal={p}
              onApprove={() => resolve(p.id, 'approve')}
              onReject={() => resolve(p.id, 'reject')}
              onDefer={() => resolve(p.id, 'defer')}
              onFeedback={(text) => resolve(p.id, 'feedback', text)}
            />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Recent</div>
          {resolved.map(p => {
            const { headline } = humanizeAnomalyDescription(p.description);
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                  {headline}
                </span>
                <span style={{
                  color: p.state === 'approved' ? 'var(--success)' : p.state === 'rejected' ? 'var(--danger)' : 'var(--warning)',
                  fontWeight: 700, flexShrink: 0,
                }}>
                  {STATE_LABEL[p.state] ?? p.state}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// ReflectionPanel
// ══════════════════════════════════════════════════════

export const ReflectionPanel: React.FC<{ projection: RealityProjection }> = ({ projection }) => {
  const { reflections } = projection;
  const anomalies = reflections.filter(r => r.anomaly);
  const recent    = reflections.slice(-8).reverse();

  const ts = (n: number) =>
    new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Reflections</div>
        {anomalies.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--warning)', color: '#412402' }}>
            {anomalies.length} anomaly
          </span>
        )}
      </div>

      {recent.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No reflections yet.
        </div>
      ) : (
        <div>
          {recent.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: r.anomaly ? 'var(--danger)' : '#8b5cf6', flexShrink: 0, marginTop: 1 }}>
                {r.anomaly ? '⚠' : '○'}
              </span>
              <span style={{ color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{r.observation}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace', fontSize: 10 }}>{ts(r.observedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 16, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
        {[['Total observed', reflections.length], ['Anomalies', anomalies.length]].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
};