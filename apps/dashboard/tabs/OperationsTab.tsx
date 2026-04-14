// apps/dashboard/tabs/OperationsTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Glide OS — AI Operational Cockpit
// Pulls live state from /api/ops (see http-server additions below).
// Shows: System Vitals · Agenda · Active Tasks · Outcome Reports · Feedback Loop
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpsState {
  vitals: {
    llm: string; dispatcher: string; tasksRunning: number;
    pendingApproval: number; memoryWrites: string;
    consciousLoop: string; policyEngine: string; scheduler: string;
  };
  activeTasks: Array<{ id: string; name: string; type: string; pct: number; step: number; steps: number; eta: string }>;
  agenda: Array<{ id: string; stars: number; text: string; tag: string; tagType: 'approval'|'suggest'|'risk'|'info' }>;
  outcomes: Array<{ id: string; title: string; score: number; items: Array<{ ok: boolean; text: string }> }>;
  governance: { rules: number; violations: number; awaitingHuman: number };
  reflections: Array<{ id: string; anomaly: boolean; observation: string; eventType: string }>;
}

// ── Mock data (used when /api/ops is unavailable) ────────────────────────────

const MOCK: OpsState = {
  vitals: { llm: 'Idle', dispatcher: 'Listening', tasksRunning: 2, pendingApproval: 1, memoryWrites: 'OK', consciousLoop: 'Observing', policyEngine: 'Ready', scheduler: 'Paused' },
  activeTasks: [
    { id: 't1', name: 'Knowledge index rebuild',     type: 'goal_pursuit',    pct: 60, step: 3, steps: 5, eta: '2m' },
    { id: 't2', name: 'Customer follow-up analysis', type: 'skill_execution', pct: 28, step: 1, steps: 4, eta: '5m' },
  ],
  agenda: [
    { id: 'a1', stars: 4, text: 'Customer Adam Davis — no follow-up in 14 days',         tag: 'Awaiting approval', tagType: 'approval' },
    { id: 'a2', stars: 3, text: 'Rebuild knowledge index — 47 new documents detected',  tag: 'AI suggestion',     tagType: 'suggest' },
    { id: 'a3', stars: 3, text: '3 duplicate tasks detected in queue — suggest merge',   tag: 'Risk flag',         tagType: 'risk' },
    { id: 'a4', stars: 2, text: 'Reflection pending on 2 failed conversations',          tag: 'AI suggestion',     tagType: 'suggest' },
    { id: 'a5', stars: 1, text: 'Sales report for 2026-03 not yet generated',            tag: 'Scheduled',         tagType: 'info' },
  ],
  outcomes: [
    { id: 'o1', title: 'Customer analysis',    score: 4, items: [{ ok: true, text: 'Found 3 high-value customers' }, { ok: true, text: 'Generated follow-up suggestions' }, { ok: false, text: 'Missing price data for 2 records' }] },
    { id: 'o2', title: 'Knowledge retrieval',  score: 5, items: [{ ok: true, text: 'Retrieved 12 relevant documents' }, { ok: true, text: 'Synthesis completed in 3.2s' }] },
  ],
  governance: { rules: 5, violations: 0, awaitingHuman: 1 },
  reflections: [],
};

// ── Feedback state ────────────────────────────────────────────────────────────

type FbState = 'none'|'good'|'bad'|'block';

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{children}</div>
);

const Card: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <div onClick={onClick} style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', cursor: onClick ? 'pointer' : undefined }}>
    {children}
  </div>
);

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  approval: { bg: '#FAEEDA', color: '#633806' },
  suggest:  { bg: '#E6F1FB', color: '#0C447C' },
  risk:     { bg: '#FCEBEB', color: '#791F1F' },
  info:     { bg: '#EAF3DE', color: '#27500A' },
};

const DOT_COLOR: Record<string, string> = {
  Idle: 'var(--success)', Listening: 'var(--success)', OK: 'var(--success)',
  Observing: 'var(--success)', Ready: 'var(--success)',
  Paused: 'var(--warning)', Busy: 'var(--warning)', Thinking: 'var(--warning)',
  Error: 'var(--danger)',
};

// ── Main component ────────────────────────────────────────────────────────────

export const OperationsTab: React.FC = () => {
  const [ops, setOps]       = useState<OpsState>(MOCK);
  const [loading, setLoading] = useState(false);
  const [fb, setFb]         = useState<Record<string, FbState>>({});
  const [fbCount, setFbCount] = useState(0);
  const [fbLog, setFbLog]   = useState('No feedback recorded yet');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/ops');
      if (r.ok) setOps(await r.json());
    } catch {
      // stay with mock
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  function toggleFb(itemId: string, type: FbState) {
    setFb(prev => {
      const was = prev[itemId];
      const next = was === type ? 'none' : type;
      if (next !== 'none') {
        setFbCount(c => c + 1);
        setFbLog(`"${itemId}" ${next === 'good' ? 'approved' : next === 'bad' ? 'rejected' : 'blocked'}`);
      }
      return { ...prev, [itemId]: next };
    });
  }

  const { vitals, activeTasks, agenda, outcomes, governance, reflections } = ops;
  const anomalies = reflections.filter(r => r.anomaly);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Operations</div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Vitals */}
          <Card>
            <SectionLabel>System vitals</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                ['LLM',             vitals.llm],
                ['Dispatcher',      vitals.dispatcher],
                ['Tasks running',   String(vitals.tasksRunning)],
                ['Pending approval',String(vitals.pendingApproval)],
                ['Memory writes',   vitals.memoryWrites],
                ['ConsciousLoop',   vitals.consciousLoop],
                ['Policy engine',   vitals.policyEngine],
                ['Scheduler',       vitals.scheduler],
              ] as [string,string][]).map(([label, val]) => (
                <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: label === 'Pending approval' && vitals.pendingApproval > 0 ? 'var(--warning)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {DOT_COLOR[val] && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLOR[val] ?? 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
                    )}
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Active tasks */}
          <Card>
            <SectionLabel>Active tasks</SectionLabel>
            {activeTasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No active tasks</div>}
            {activeTasks.map(task => (
              <div key={task.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{task.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.pct}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', width: `${task.pct}%`, background: task.type === 'goal_pursuit' ? 'var(--success)' : 'var(--accent)', borderRadius: 2, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Step {task.step}/{task.steps} · ETA {task.eta} · {task.type}</div>
              </div>
            ))}
          </Card>

          {/* Outcome report */}
          <Card>
            <SectionLabel>Outcome report</SectionLabel>
            {outcomes.map(o => (
              <div key={o.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{o.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>Self: {o.score}/5</span>
                </div>
                {o.items.map((item, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 3 }}>
                    <span style={{ color: item.ok ? 'var(--success)' : 'var(--warning)', fontWeight: 700, flexShrink: 0 }}>{item.ok ? '✓' : '⚠'}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            ))}
          </Card>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Agenda */}
          <Card>
            <SectionLabel>Agenda — pending decisions</SectionLabel>
            {agenda.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: '#BA7517', minWidth: 52, paddingTop: 2 }}>
                  {'★'.repeat(item.stars)}{'☆'.repeat(4 - item.stars)}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>{item.text}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px', background: TAG_STYLE[item.tagType].bg, color: TAG_STYLE[item.tagType].color }}>
                    {item.tag}
                  </span>
                </div>
              </div>
            ))}
          </Card>

          {/* Feedback loop */}
          <Card>
            <SectionLabel>Feedback loop — behavior learning</SectionLabel>
            {agenda.slice(0, 3).map(item => {
              const state = fb[item.id] ?? 'none';
              const btn = (type: FbState, label: string) => (
                <button key={type} onClick={() => toggleFb(item.id, type)}
                  style={{ fontSize: 11, border: '0.5px solid var(--border)', borderRadius: 6, padding: '3px 8px', background: state === type ? (type === 'good' ? '#E1F5EE' : type === 'bad' ? '#FCEBEB' : '#FAEEDA') : 'transparent', color: state === type ? (type === 'good' ? '#085041' : type === 'bad' ? '#791F1F' : '#412402') : 'var(--text-muted)', cursor: 'pointer' }}>
                  {label}
                </button>
              );
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{item.text.slice(0, 40)}…</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {btn('good','✓ Good')}
                    {btn('bad','✗ Bad')}
                    {btn('block','⊘ Never')}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>{fbLog}</span>
              <span>Learning events: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fbCount}</span></span>
            </div>
          </Card>

          {/* Governance snapshot */}
          <Card onClick={() => window.dispatchEvent(new CustomEvent('glide:ask', { detail: 'Show current ConstitutionEngine rules and policy state' }))}>
            <SectionLabel>Governance snapshot</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Constitution rules', value: governance.rules,       color: 'var(--text-primary)' },
                { label: 'Violations today',   value: governance.violations,  color: governance.violations > 0 ? 'var(--danger)' : 'var(--success)' },
                { label: 'Awaiting human',     value: governance.awaitingHuman, color: governance.awaitingHuman > 0 ? 'var(--warning)' : 'var(--text-primary)' },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>tap to inspect ↗</div>
          </Card>

          {/* ConsciousLoop reflections */}
          {anomalies.length > 0 && (
            <Card>
              <SectionLabel>ConsciousLoop — anomalies</SectionLabel>
              {anomalies.slice(0, 5).map(r => (
                <div key={r.id} style={{ fontSize: 12, color: 'var(--danger)', padding: '5px 0', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 8 }}>
                  <span>⚠</span><span>{r.observation}</span>
                </div>
              ))}
            </Card>
          )}

        </div>
      </div>
    </div>
  );
};
