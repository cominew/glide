// apps/dashboard/projections/projection-observer.ts
//
// Fix log:
//   [FIX-PROJ-1] healing + medium impact was auto-approved and NOT surfaced
//     to human. But the kernel emits authority.required for these proposals,
//     meaning the kernel explicitly wants human review.
//     Rule clarified: auto-approve ONLY when category=healing AND impact=low
//     AND there is no accompanying authority.required event.
//     If authority.required arrives for ANY proposal, it goes to the queue.
//
//   [FIX-PROJ-2] answer.manifested is now a primary answer event (new kernel).
//     Added to cognitive state derivation alongside answer.ready.
//
//   [FIX-PROJ-3] authority.required now correctly resets proposal state to
//     'draft' regardless of prior auto-approval. Agenda no longer has stale
//     state modification logic inside the loop.

import { UIEvent } from '../events/events';

export type ProposalState    = 'draft' | 'approved' | 'rejected' | 'deferred';
export type ProposalCategory = 'healing' | 'approval' | 'suggest' | 'feedback' | 'system';

export interface ProjectedProposal {
  id:              string;
  category:        ProposalCategory;
  title:           string;
  description:     string;
  impact:          'low' | 'medium' | 'high';
  state:           ProposalState;
  scopeId?:        string;
  createdAt:       number;
  resolvedAt?:     number;
  authorityRequired: boolean;
}

export type CognitivePhenomenon =
  | 'idle' | 'awakened' | 'perturbed' | 'arising' | 'resonating'
  | 'anchored' | 'settling' | 'projected' | 'manifested' | 'settled'
  | 'closed' | 'conflicted' | 'anomalous' | 'awaiting' | 'observed_again';

export interface CognitiveState {
  phenomenon: CognitivePhenomenon;
  headline:   string;
  narrative:  string;
  subtext?:   string;
  color:      string;
  eventTime:  number | null;
}

export interface ProjectedAgendaItem {
  id:          string;
  stars:       number;
  text:        string;
  tag:         string;
  tagType:     'approval' | 'suggest' | 'risk' | 'info';
  proposalId?: string;
  scopeId?:    string;
  since:       number;
}

export interface ProjectedReflection {
  id:          string;
  observation: string;
  anomaly:     boolean;
  observedAt:  number;
}

export interface RealityProjection {
  cognitive:    CognitiveState;
  proposals:    Map<string, ProjectedProposal>;
  agenda:       ProjectedAgendaItem[];
  reflections:  ProjectedReflection[];
  lastEventAt:  number | null;
}

const BOOT_NOISE = new Set(['System ready', 'Glide cognitive field is now active.']);

const IDLE_STATE: CognitiveState = {
  phenomenon: 'idle',
  headline:   'At rest',
  narrative:  'The field is silent. Waiting for a boundary to arise.',
  color:      'var(--text-muted)',
  eventTime:  null,
};

// ── Cognitive state derivation ────────────────────────────────────────────────
function deriveCognitive(events: readonly UIEvent[]): CognitiveState {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    const p = e.payload ?? {};
    const t = e.timestamp;

    switch (e.type) {
      case 'system.signal':
        if (p.type === 'observer.feedback') return {
          phenomenon: 'observed_again', headline: 'Observed again',
          narrative: 'The observer has re-entered the field. A second collapse begins.',
          subtext: p.note ? `"${String(p.note).slice(0, 60)}"` : undefined,
          color: '#c084fc', eventTime: t,
        };
        break;
      case 'mind.state.entered':
        if (p.state === 'settled') return {
          phenomenon: 'settled', headline: 'Settled',
          narrative: 'The cognitive cycle has completed. The field returns to silence.',
          color: '#34d399', eventTime: t,
        };
        break;
      case 'answer.manifested':
      case 'answer.ready':
        return {
          phenomenon: 'manifested', headline: 'Manifested',
          narrative: 'The field has collapsed into observable form.',
          color: '#34d399', eventTime: t,
        };
      case 'answer.projected':
        return {
          phenomenon: 'projected', headline: 'Projected',
          narrative: 'Understanding has crystallized. Reality is ready to be observed.',
          color: '#34d399', eventTime: t,
        };
      case 'causality.closed':
        return {
          phenomenon: 'closed', headline: 'Closed',
          narrative: 'The causal chain has reached its natural conclusion.',
          color: '#34d399', eventTime: t,
        };
      case 'entity.anchor.created':
        return {
          phenomenon: 'anchored', headline: 'Identity anchored',
          narrative: 'A presence has become clear in the field.',
          subtext: p.entity,
          color: '#34d399', eventTime: t,
        };
      case 'mind.settling':
        return {
          phenomenon: 'settling', headline: 'Settling',
          narrative: 'The causal storm is calming. A resolution approaches.',
          color: '#60a5fa', eventTime: t,
        };
      case 'reality.conflict':
        return {
          phenomenon: 'conflicted', headline: 'Conflicted',
          narrative: 'Multiple realities are competing for the same anchor point.',
          subtext: (p.surfaces ?? p.conflictSurfaces ?? []).join(' vs '),
          color: '#f87171', eventTime: t,
        };
      case 'reality.anomaly.detected':
        if (p.reason === 'non_resonant_field_vacuum') break;
        return {
          phenomenon: 'anomalous', headline: 'Anomalous',
          narrative: 'The field has detected an inconsistency in the emerging reality.',
          color: '#f87171', eventTime: t,
        };
      case 'cognition.anomaly.detected': {
        if (p.subtype === 'non_resonant_field_vacuum') break;
        const anomalies: string[] = p.anomalies ?? [];
        return {
          phenomenon: 'anomalous', headline: 'Concerned',
          narrative: anomalies[0] ?? 'A quality issue has been noticed.',
          color: '#fbbf24', eventTime: t,
        };
      }
      case 'authority.required':
        return {
          phenomenon: 'awaiting', headline: 'Awaiting',
          narrative: 'A decision requires human presence before reality can proceed.',
          subtext: p.proposal?.title,
          color: '#fbbf24', eventTime: t,
        };
      case 'resonance.observed':
        if ((p.fragmentCount ?? 0) === 0) break;
        return {
          phenomenon: 'resonating', headline: 'Resonating',
          narrative: 'Fragments of reality are connecting.',
          subtext: p.skill,
          color: '#a78bfa', eventTime: t,
        };
      case 'awareness.skill_arising': {
        const skillNames: Record<string, string> = {
          'name-disambiguation': 'An identity is being recognized',
          'profile-fetcher':     'Memory is being retrieved',
          'persona-summary':     'A portrait is taking shape',
          'reasoning':           'Deeper understanding is forming',
          'customer':            'Customer knowledge is surfacing',
          'sales':               'Transaction patterns are being read',
        };
        return {
          phenomenon: 'arising', headline: 'Arising',
          narrative: (skillNames[p.skill ?? ''] ?? 'A capability is manifesting') + '.',
          subtext: p.skill,
          color: '#818cf8', eventTime: t,
        };
      }
      case 'mind.aware':
        return {
          phenomenon: 'awakened', headline: 'Awakened',
          narrative: 'A disturbance has entered the field.',
          subtext: p.cause ? `"${String(p.cause).slice(0, 60)}"` : undefined,
          color: '#60a5fa', eventTime: t,
        };
      case 'awareness.disturbance':
        return {
          phenomenon: 'perturbed', headline: 'Perturbed',
          narrative: 'Something has broken the silence. Attention is forming.',
          subtext: p.summary ? `"${String(p.summary).slice(0, 60)}"` : undefined,
          color: '#f59e0b', eventTime: t,
        };
    }
  }
  return IDLE_STATE;
}

// ── Proposal collapse ─────────────────────────────────────────────────────────
function collapseProposals(events: readonly UIEvent[]): Map<string, ProjectedProposal> {
  const proposals = new Map<string, ProjectedProposal>();

  for (const e of events) {
    const p = e.payload ?? {};

    // 1. 权威要求：强制创建/重置为待审
    if (e.type === 'authority.required') {
      const raw = e.payload?.proposal ?? {};
      const id  = raw.proposalId ?? raw.id;
      if (!id) continue;
      proposals.set(id, {
        id, category: 'approval', title: raw.title ?? 'Authority required',
        description: raw.description ?? '', impact: raw.impact ?? 'medium',
        state: 'draft', scopeId: raw.scopeId, createdAt: e.timestamp, authorityRequired: true,
      });
      continue;
    }

    // 2. 提案创建/浮现
    if (e.type === 'proposal.created' || e.type === 'proposal.arisen') {
      const raw      = p.proposal ?? p;
      const id       = raw.proposalId ?? raw.id ?? e.id;
      const title    = raw.title ?? '';
      const category: ProposalCategory = raw.category ?? 'suggest';
      const impact   = raw.impact ?? 'medium';
      if (BOOT_NOISE.has(title)) continue;
      
      if (proposals.has(id) && proposals.get(id)!.authorityRequired) continue;

      const state = (category === 'healing' && impact === 'low') ? 'approved' : 'draft';
      proposals.set(id, {
        id, category, title, description: raw.description ?? '',
        impact, state, scopeId: raw.scopeId ?? p.scopeId,
        createdAt: e.timestamp, authorityRequired: false,
      });
      continue;
    }

    // 3. 权威决议 (通过 system.signal)
    if (e.type === 'system.signal' && p.type === 'authority.resolved') {
      const id = p.proposalId;
      if (!id) continue;
      const existing = proposals.get(id);
      if (existing) {
        existing.state = p.decision === 'approve' ? 'approved'
                       : p.decision === 'reject' ? 'rejected'
                       : existing.state;
        existing.resolvedAt = e.timestamp;
      }
      continue;
    }

    // ⭐ 4. 现实坍缩 — 最高优先级，确保已决议提案被锁定
    if (e.type === 'reality.collapsed') {
      const id = e.payload?.proposalId;
      if (id && proposals.has(id)) {
        const proposal = proposals.get(id)!;
        proposal.state = e.payload.decision === 'approve' ? 'approved' : 'rejected';
        proposal.resolvedAt = e.timestamp;
      }
    }
  }

  return proposals;
}

// ── Agenda collapse ───────────────────────────────────────────────────────────
function collapseAgenda(
  events:    readonly UIEvent[],
  proposals: Map<string, ProjectedProposal>
): ProjectedAgendaItem[] {
  const items = new Map<string, ProjectedAgendaItem>();

  for (const e of events) {
    const p = e.payload ?? {};

    if (e.type === 'proposal.created' || e.type === 'proposal.arisen') {
      const raw      = p.proposal ?? p;
      const id       = raw.proposalId ?? raw.id ?? e.id;
      const title    = raw.title ?? '';
      const impact   = raw.impact ?? 'medium';
      const proposal = proposals.get(id);

      if (BOOT_NOISE.has(title)) continue;
      if (!proposal || proposal.state === 'approved' || proposal.state === 'rejected') continue;

      const itemId = `agenda_prop_${id}`;
      if (!items.has(itemId)) {
        items.set(itemId, {
          id: itemId,
          stars: impact === 'high' ? 4 : 3,
          text:  title,
          tag:   proposal.category === 'healing' ? 'Repair'
                : proposal.category === 'approval' ? 'Approval'
                : proposal.category.charAt(0).toUpperCase() + proposal.category.slice(1),
          tagType: proposal.category === 'healing' ? 'risk'
                  : proposal.category === 'approval' ? 'approval'
                  : 'suggest',
          proposalId: id,
          scopeId: raw.scopeId ?? p.scopeId,
          since: e.timestamp,
        });
      }
    }

    if (e.type === 'cognition.anomaly.detected') {
      if (p.subtype === 'non_resonant_field_vacuum') continue;
      const anomalies: string[] = p.anomalies ?? [];
      const reason = anomalies.length > 0 ? anomalies.join('; ') : (p.reason ?? 'Unknown anomaly');
      const itemId = `agenda_anomaly_${e.id}`;
      if (!items.has(itemId)) {
        items.set(itemId, {
          id: itemId, stars: 4, text: reason,
          tag: 'Anomaly', tagType: 'risk',
          scopeId: p.scopeId, since: e.timestamp,
        });
      }
    }

    if (e.type === 'reflection.created') {
      const obs = p.observation ?? '';
      if (obs === 'Reality stabilized.' || obs === 'Outcome appears consistent and valid.') continue;
      const itemId = `agenda_reflect_${e.id}`;
      if (!items.has(itemId)) {
        items.set(itemId, {
          id: itemId, stars: 3, text: obs,
          tag: 'Reflection', tagType: 'suggest',
          scopeId: p.scopeId, since: e.timestamp,
        });
      }
    }

    if (e.type === 'system.signal' && p.type === 'authority.resolved') {
      const id = p.proposalId;
      for (const [key, item] of items) {
        if (item.proposalId === id) items.delete(key);
      }
    }
  }

  return Array.from(items.values()).reverse();
}

// ── Reflection collapse ───────────────────────────────────────────────────────
function collapseReflections(events: readonly UIEvent[]): ProjectedReflection[] {
  const reflections: ProjectedReflection[] = [];
  for (const e of events) {
    const p = e.payload ?? {};
    if (e.type === 'reflection.created' || e.type === 'conscious.reflection') {
      const obs = p.observation
        ?? p.payload?.anomalies?.join('; ')
        ?? e.type;
      reflections.push({ id: e.id, observation: obs, anomaly: e.type === 'conscious.reflection', observedAt: e.timestamp });
    }
    if (e.type === 'cognition.anomaly.detected' && p.subtype !== 'non_resonant_field_vacuum') {
      const anomalies: string[] = p.anomalies ?? [];
      if (anomalies.length > 0) {
        reflections.push({ id: e.id, observation: anomalies.join('; '), anomaly: true, observedAt: e.timestamp });
      }
    }
  }
  return reflections.slice(-50);
}

// ── Main collapse ─────────────────────────────────────────────────────────────
export function collapseReality(events: readonly UIEvent[]): RealityProjection {
  const proposals   = collapseProposals(events);
  const cognitive   = deriveCognitive(events);
  const agenda      = collapseAgenda(events, proposals);
  const reflections = collapseReflections(events);
  const lastEventAt = events.length > 0 ? events[events.length - 1].timestamp : null;
  return { cognitive, proposals, agenda, reflections, lastEventAt };
}