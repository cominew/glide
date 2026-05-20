// apps/dashboard/projections/projection-observer.ts
//
// Fix log:
//   [FIX-B] Agenda deduplication:
//     Both reflection.created and cognition.anomaly.detected were creating
//     separate agenda items with the same text. Now deduplication is done
//     by text content: if an item with the same text (trimmed) already exists,
//     it's not added again. This eliminates the pairs of identical items.
//
//   [FIX-A] Proposal description is now read from multiple locations:
//     proposal.arisen from SYSTEM has the full description field.
//     proposal.arisen from COGNITION now also carries description.
//     Both are captured and merged.

import { UIEvent } from '../events/events';

export type ProposalState    = 'draft' | 'approved' | 'rejected' | 'deferred';
export type ProposalCategory = 'healing' | 'approval' | 'suggest' | 'feedback' | 'system';

export interface ProjectedProposal {
  id:                string;
  category:          ProposalCategory;
  title:             string;
  description:       string;
  impact:            'low' | 'medium' | 'high';
  state:             ProposalState;
  scopeId?:          string;
  createdAt:         number;
  resolvedAt?:       number;
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
          narrative: 'Understanding has crystallized.',
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
          narrative: 'The causal storm is calming.',
          color: '#60a5fa', eventTime: t,
        };
      case 'reality.conflict':
        return {
          phenomenon: 'conflicted', headline: 'Conflicted',
          narrative: 'Multiple realities are competing.',
          subtext: (p.surfaces ?? p.conflictSurfaces ?? []).join(' vs '),
          color: '#f87171', eventTime: t,
        };
      case 'reality.anomaly.detected':
        if (p.reason === 'non_resonant_field_vacuum') break;
        return {
          phenomenon: 'anomalous', headline: 'Anomalous',
          narrative: 'The field has detected an inconsistency.',
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
          narrative: 'A decision requires human presence.',
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
          'knowledge_retrieval': 'Knowledge is being recalled',
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
          narrative: 'Something has broken the silence.',
          subtext: p.summary ? `"${String(p.summary).slice(0, 60)}"` : undefined,
          color: '#f59e0b', eventTime: t,
        };
    }
  }
  return IDLE_STATE;
}

// ── Proposal collapse ─────────────────────────────────────────────────────────

function extractProposalId(raw: any): string | null {
  return raw?.proposalId ?? raw?.id ?? null;
}

function collapseProposals(events: readonly UIEvent[]): Map<string, ProjectedProposal> {
  const proposals = new Map<string, ProjectedProposal>();
  const authorityRequired = new Set<string>();

  // First pass: collect authority.required ids
  for (const e of events) {
    if (e.type === 'authority.required') {
      const id = extractProposalId(e.payload?.proposal);
      if (id) authorityRequired.add(id);
    }
  }

  for (const e of events) {
    const p = e.payload ?? {};

    // proposal.created, proposal.arisen (both COGNITION and SYSTEM)
    if (e.type === 'proposal.created' || e.type === 'proposal.arisen') {
      // SYSTEM source has the full proposal object in p.proposal or directly in p
      const raw      = p.proposal ?? p;
      const id       = extractProposalId(raw) ?? e.id;
      const title    = raw.title ?? '';
      const category: ProposalCategory = raw.category ?? 'suggest';
      const impact   = raw.impact ?? 'medium';
      const description = raw.description ?? '';

      if (BOOT_NOISE.has(title)) continue;

      const hasAuthority = authorityRequired.has(id);

      // Auto-approve only low-impact healing with NO authority.required
      if (category === 'healing' && impact === 'low' && !hasAuthority) {
        proposals.set(id, {
          id, category, title, description, impact, state: 'approved',
          scopeId: raw.scopeId, createdAt: e.timestamp, authorityRequired: false,
        });
        continue;
      }

      // Merge: if already exists, update description if we now have a better one
      const existing = proposals.get(id);
      if (existing) {
        if (!existing.description && description) {
          proposals.set(id, { ...existing, description, authorityRequired: existing.authorityRequired || hasAuthority });
        }
      } else {
        proposals.set(id, {
          id, category, title, description, impact,
          state: 'draft',
          scopeId: raw.scopeId ?? p.scopeId,
          createdAt: e.timestamp,
          authorityRequired: hasAuthority,
        });
      }
    }

    // authority.required → upgrade category and ensure proposal exists
    if (e.type === 'authority.required') {
      const raw = e.payload?.proposal ?? {};
      const id  = extractProposalId(raw);
      if (!id || BOOT_NOISE.has(raw.title ?? '')) continue;

      const existing = proposals.get(id);
      const description = raw.description ?? existing?.description ?? '';
      if (existing) {
        proposals.set(id, {
          ...existing, category: 'approval', authorityRequired: true,
          description: description || existing.description,
        });
      } else {
        proposals.set(id, {
          id, category: 'approval',
          title: raw.title ?? 'Authority required',
          description,
          impact: raw.impact ?? 'medium',
          state: 'draft',
          createdAt: e.timestamp,
          authorityRequired: true,
        });
      }
    }

    // authority.resolved
    if (e.type === 'system.signal' && p.type === 'authority.resolved') {
      const id       = p.proposalId;
      const decision = p.decision;
      if (!id) continue;
      const existing = proposals.get(id);
      if (existing) {
        proposals.set(id, {
          ...existing,
          state: decision === 'approve' ? 'approved'
               : decision === 'reject'  ? 'rejected'
               : decision === 'defer'   ? 'deferred'
               : existing.state,
          resolvedAt: e.timestamp,
        });
      }
    }
  }

  return proposals;
}

// ── Agenda collapse ───────────────────────────────────────────────────────────
// [FIX-B] Deduplicate by text content — same text = same item regardless of event

function collapseAgenda(
  events:    readonly UIEvent[],
  proposals: Map<string, ProjectedProposal>
): ProjectedAgendaItem[] {
  const items      = new Map<string, ProjectedAgendaItem>(); // key → item
  const seenTexts  = new Set<string>(); // normalized text → already added

  const addItem = (item: ProjectedAgendaItem) => {
    const normText = item.text.trim().toLowerCase().slice(0, 120);
    if (seenTexts.has(normText)) return; // [FIX-B] deduplicate by text
    seenTexts.add(normText);
    items.set(item.id, item);
  };

  for (const e of events) {
    const p = e.payload ?? {};

    // Proposals
    if (e.type === 'proposal.created' || e.type === 'proposal.arisen') {
      const raw      = p.proposal ?? p;
      const id       = extractProposalId(raw) ?? e.id;
      const title    = raw.title ?? '';
      const impact   = raw.impact ?? 'medium';
      const category = raw.category ?? 'suggest';
      const proposal = proposals.get(id);

      if (BOOT_NOISE.has(title)) continue;
      if (category === 'healing' && impact === 'low' && !proposal?.authorityRequired) continue;
      if (proposal?.state === 'approved' || proposal?.state === 'rejected') continue;

      const { headline } = humanizeAgendaText(raw.description ?? title, category);
      addItem({
        id: `agenda_prop_${id}`,
        stars: impact === 'high' ? 4 : 3,
        text: headline,
        tag: category === 'healing' ? 'Repair' : category === 'approval' ? 'Approval' : 'Suggest',
        tagType: category === 'healing' ? 'risk' : category === 'approval' ? 'approval' : 'suggest',
        proposalId: id,
        scopeId: raw.scopeId ?? p.scopeId,
        since: e.timestamp,
      });
    }

    // authority.required → high-priority item
    if (e.type === 'authority.required') {
      const raw   = e.payload?.proposal ?? {};
      const id    = extractProposalId(raw);
      const title = raw.title ?? 'Authority required';
      if (!id || BOOT_NOISE.has(title)) continue;
      const proposal = proposals.get(id);
      if (proposal?.state && proposal.state !== 'draft') continue;

      const { headline } = humanizeAgendaText(raw.description ?? title, 'approval');
      addItem({
        id: `agenda_auth_${id}`,
        stars: 5,
        text: `⚡ ${headline}`,
        tag: 'Approval', tagType: 'approval',
        proposalId: id, since: e.timestamp,
      });
    }

    // Genuine anomalies — deduplicated by text
    if (e.type === 'cognition.anomaly.detected') {
      if (p.subtype === 'non_resonant_field_vacuum') continue;
      const anomalies: string[] = p.anomalies ?? [];
      const text = anomalies.length > 0 ? anomalies.join('; ') : (p.reason ?? 'Unknown anomaly');
      addItem({
        id: `agenda_anomaly_${e.id}`,
        stars: 4,
        text,
        tag: 'Anomaly', tagType: 'risk',
        scopeId: p.scopeId,
        since: e.timestamp,
      });
    }

    // Reflections — only non-trivial, deduplicated
    if (e.type === 'reflection.created') {
      const obs = p.observation ?? '';
      if (
        obs === 'Reality stabilized.' ||
        obs === 'Outcome appears consistent and valid.' ||
        obs === 'A reflective observation occurred.'
      ) continue;
      addItem({
        id: `agenda_reflect_${e.id}`,
        stars: 3, text: obs,
        tag: 'Reflection', tagType: 'suggest',
        scopeId: p.scopeId, since: e.timestamp,
      });
    }

    // Remove resolved proposals from agenda
    if (e.type === 'system.signal' && p.type === 'authority.resolved') {
      const id = p.proposalId;
      for (const [key, item] of items) {
        if (item.proposalId === id) {
          seenTexts.delete(item.text.trim().toLowerCase().slice(0, 120));
          items.delete(key);
        }
      }
    }
  }

  return Array.from(items.values()).reverse();
}

// Human-readable agenda text (reuse from AuthorityPanel logic)
function humanizeAgendaText(description: string, category: string): { headline: string } {
  const d = description ?? '';
  if (d.includes('Currency mismatch'))
    return { headline: 'Currency mismatch in response' };
  if (d.includes('Ambiguous identity unresolved'))
    return { headline: 'Multiple customers matched, none chosen' };
  if (d.includes('Customer identity could not be fully resolved'))
    return { headline: 'Customer not found in records' };
  if (d.includes('Reasoning generated without concrete profile'))
    return { headline: 'Analysis without verified customer data' };
  if (d && !d.includes('Anomaly detected'))
    return { headline: d.split(';')[0].trim() };
  if (category === 'healing') return { headline: 'Quality issue detected in previous response' };
  return { headline: 'System attention required' };
}

// ── Reflection collapse ───────────────────────────────────────────────────────

function collapseReflections(events: readonly UIEvent[]): ProjectedReflection[] {
  const reflections: ProjectedReflection[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    const p = e.payload ?? {};

    if (e.type === 'reflection.created' || e.type === 'conscious.reflection') {
      const obs = p.observation
        ?? p.payload?.anomalies?.join('; ')
        ?? e.type;
      const key = obs.trim().slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        reflections.push({ id: e.id, observation: obs, anomaly: e.type === 'conscious.reflection', observedAt: e.timestamp });
      }
    }
    if (e.type === 'cognition.anomaly.detected' && p.subtype !== 'non_resonant_field_vacuum') {
      const anomalies: string[] = p.anomalies ?? [];
      if (anomalies.length > 0) {
        const obs = anomalies.join('; ');
        const key = obs.trim().slice(0, 80);
        if (!seen.has(key)) {
          seen.add(key);
          reflections.push({ id: e.id, observation: obs, anomaly: true, observedAt: e.timestamp });
        }
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