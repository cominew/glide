// apps/dashboard/arising/useAgenda.ts
//
// Agenda = observable surface of causal proposals and anomalies.
// Items are NOT tasks. They are phenomena that have arisen and
// may warrant attention — but the field does not require action.
//
// Filter rules:
//   - Boot noise ("System ready") is suppressed
//   - Low-impact healing proposals that auto-approve are suppressed
//   - Only medium/high impact proposals and genuine anomalies surface

import { useState, useEffect, useCallback } from 'react';
import { UIEvent } from '../events/events';

export type AgendaTagType = 'approval' | 'suggest' | 'risk' | 'info' | 'learning';

export interface AgendaItem {
  id:          string;
  stars:       number;
  text:        string;
  tag:         string;
  tagType:     AgendaTagType;
  proposalId?: string;   // link to authority proposal if applicable
  scopeId?:    string;
  since:       number;
}

const SEED: AgendaItem[] = [{
  id: 'seed-1', stars: 2, tagType: 'info',
  text: 'Field at rest — start an AI task to generate agenda items',
  tag: 'System', since: Date.now(),
}];

const isSeed = (items: AgendaItem[]) =>
  items.length === 1 && items[0].id === 'seed-1';

// Boot noise titles to suppress
const BOOT_NOISE = new Set(['System ready', 'Glide cognitive field is now active.']);

interface Props {
  events?: UIEvent[];
}

export function useAgenda({ events = [] }: Props = {}) {
  const [items,   setItems]   = useState<AgendaItem[]>(SEED);
  const [loading, setLoading] = useState(false);

  const addItem = useCallback((item: AgendaItem) => {
    setItems(prev => {
      const base = isSeed(prev) ? [] : prev;
      if (base.some(i => i.id === item.id)) return base;
      return [item, ...base];
    });
  }, []);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;

    // ── proposal.created / proposal.arisen ───────────────────────────────
    if (last.type === 'proposal.created' || last.type === 'proposal.arisen') {
      const p      = last.payload?.proposal ?? last.payload ?? {};
      const title  = p.title    ?? '';
      const impact = p.impact   ?? 'medium';
      const cat    = p.category ?? 'suggest';

      // Suppress boot noise
      if (BOOT_NOISE.has(title)) return;

      // Suppress low-impact healing (auto-handled by kernel)
      if (cat === 'healing' && impact === 'low') return;

      const proposalId = p.proposalId ?? p.id;

      addItem({
        id:         `agenda_prop_${proposalId ?? last.id}`,
        stars:      impact === 'high' ? 4 : impact === 'medium' ? 3 : 2,
        text:       title,
        tag:        cat === 'healing' ? 'Repair' : cat.charAt(0).toUpperCase() + cat.slice(1),
        tagType:    cat === 'healing' ? 'risk' : cat === 'approval' ? 'approval' : 'suggest',
        proposalId,
        scopeId:    p.scopeId ?? last.payload?.scopeId,
        since:      last.timestamp,
      });
      return;
    }

    // ── authority.required — explicit human gate requested ───────────────
    if (last.type === 'authority.required') {
      const p = last.payload?.proposal ?? {};
      if (BOOT_NOISE.has(p.title ?? '')) return;
      addItem({
        id:         `agenda_auth_${p.proposalId ?? last.id}`,
        stars:      5,
        text:       `⚡ ${p.title ?? 'Authority required'}`,
        tag:        'Approval',
        tagType:    'approval',
        proposalId: p.proposalId,
        since:      last.timestamp,
      });
      return;
    }

    // ── proposal resolved — remove from agenda ───────────────────────────
    if (last.type === 'system.signal' && last.payload?.type === 'authority.resolved') {
      const proposalId = last.payload.proposalId;
      setItems(prev => prev.filter(i => i.proposalId !== proposalId));
      return;
    }

    // ── Genuine cognition anomaly (non-vacuum) ───────────────────────────
    if (last.type === 'cognition.anomaly.detected') {
      const p = last.payload ?? {};
      if (p.subtype === 'non_resonant_field_vacuum') return; // suppress noise
      const anomalies: string[] = p.anomalies ?? [];
      const reason = anomalies.length > 0 ? anomalies.join('; ') : (p.reason ?? 'Unknown anomaly');
      addItem({
        id:      `agenda_anomaly_${last.id}`,
        stars:   4,
        text:    reason,
        tag:     'Anomaly',
        tagType: 'risk',
        scopeId: p.scopeId,
        since:   last.timestamp,
      });
      return;
    }

    // ── reflection.created with meaningful observation ───────────────────
    if (last.type === 'reflection.created') {
      const obs = last.payload?.observation ?? '';
      // Only surface non-trivial reflections
      if (obs === 'Reality stabilized.' || obs === 'Outcome appears consistent and valid.') return;
      addItem({
        id:      `agenda_reflect_${last.id}`,
        stars:   3,
        text:    obs,
        tag:     'Reflection',
        tagType: 'suggest',
        scopeId: last.payload?.scopeId,
        since:   last.timestamp,
      });
      return;
    }

    // ── reality.conflict ─────────────────────────────────────────────────
    if (last.type === 'reality.conflict') {
      const surfaces = last.payload?.surfaces ?? last.payload?.conflictSurfaces ?? [];
      addItem({
        id:      `agenda_conflict_${last.id}`,
        stars:   5,
        text:    `Reality conflict: ${surfaces.join(' vs ')}`,
        tag:     'Conflict',
        tagType: 'risk',
        since:   last.timestamp,
      });
      return;
    }

    // ── meaning.unresolved ───────────────────────────────────────────────
    if (last.type === 'meaning.unresolved') {
      addItem({
        id:      `agenda_meaning_${last.id}`,
        stars:   4,
        text:    `Meaning not closed: ${last.payload?.reason ?? 'unknown'}`,
        tag:     'Cognition',
        tagType: 'risk',
        since:   last.timestamp,
      });
    }
  }, [events, addItem]);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const bump = useCallback((id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx === -1) return prev;
      const item = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      next.unshift({ ...item, stars: Math.min(item.stars + 1, 5) });
      return next;
    });
  }, []);

  return { items, loading, dismiss, bump };
}
