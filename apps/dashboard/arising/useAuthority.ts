// apps/dashboard/arising/useAuthority.ts
//
// ═══════════════════════════════════════════════════════════════
// Reality Mutation Interface — Constitutional Rewrite
// ═══════════════════════════════════════════════════════════════
//
// Core principle:
//   A button click is NOT a UI state change.
//   A button click IS a Boundary Event injection into the causal field.
//
//   Approve  → proposal.approved  → Reality Created   → new causal chain
//   Reject   → proposal.rejected  → Reality Closed    → causal closure
//   Defer    → proposal.deferred  → Superposition     → field held open
//   Feedback → proposal.feedback  → New Boundary      → repair chain begins
//
//   The UI reflects the resulting event projection.
//   The UI does NOT own the state — the event field does.
//
// Proposal categories:
//   'healing'  — system self-repair, auto-approved (no human gate needed)
//                only surfaced to human if impact === 'high'
//   'approval' — requires explicit human decision before proceeding
//   'suggest'  — informational, human may act or dismiss
//   'feedback' — user-initiated correction, triggers repair causal chain
//
// Constitution compliance:
//   ✓ No setInterval (Article VI)
//   ✓ No persistent state beyond event observation (Article II)
//   ✓ Button = Boundary Event, not state mutation (Article VII)
//   ✓ Governance enforces law, never becomes intelligence (Non-Agency Rule)

import { useState, useEffect, useCallback } from 'react';
import { UIEvent } from '../events/events';
import { api } from '../gateways/api';

// ── Proposal state machine ────────────────────────────────────────────────────
// Draft       → uncollapsed possibility (superposition)
// Approved    → Reality Created
// Rejected    → Reality Closed
// Deferred    → Superposition Maintained
// Feedback    → New Boundary Event injected

export type ProposalState = 'draft' | 'approved' | 'rejected' | 'deferred' | 'feedback';
export type ProposalCategory = 'healing' | 'approval' | 'suggest' | 'feedback' | 'system';

export interface Proposal {
  id:          string;        // proposalId from kernel
  category:    ProposalCategory;
  title:       string;
  description: string;
  impact:      'low' | 'medium' | 'high';
  state:       ProposalState;
  scopeId?:    string;
  createdAt:   number;
  resolvedAt?: number;
  // For feedback proposals — the user's correction text
  feedbackText?: string;
}

interface Props {
  events?: UIEvent[];
}

// ── Filtering: which proposals require human attention ───────────────────────
function requiresHumanGate(p: Proposal): boolean {
  if (p.category === 'approval') return true;
  if (p.category === 'healing' && p.impact === 'high') return true;
  if (p.category === 'feedback') return true;
  // 'suggest' with medium/high impact warrants attention
  if (p.category === 'suggest' && p.impact !== 'low') return true;
  return false;
}

// ── Noise filter: suppress system-boot proposals ────────────────────────────
function isBootNoise(p: Proposal): boolean {
  return p.title === 'System ready' || p.title === 'Glide cognitive field is now active.';
}

export function useAuthority({ events = [] }: Props = {}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);

  // ── Ingest proposals from event stream ───────────────────────────────────
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;

    // ── New proposal arrived ─────────────────────────────────────────────
    if (last.type === 'proposal.created' || last.type === 'proposal.arisen') {
      const p = last.payload?.proposal ?? last.payload ?? {};
      const id = p.proposalId ?? p.id ?? last.id;
      const category: ProposalCategory = p.category ?? 'suggest';

      const proposal: Proposal = {
        id,
        category,
        title:       p.title       ?? 'Unnamed proposal',
        description: p.description ?? '',
        impact:      p.impact      ?? 'medium',
        state:       'draft',
        scopeId:     p.scopeId     ?? last.payload?.scopeId,
        createdAt:   last.timestamp,
      };

      // Filter boot noise
      if (isBootNoise(proposal)) return;

      // Auto-approve low/medium healing proposals — no human gate needed
      // (constitution: self-repair is causal, not intentional agency)
      if (category === 'healing' && proposal.impact !== 'high') {
        // Still record in history but don't surface to human
        setProposals(prev => {
          if (prev.some(x => x.id === proposal.id)) return prev;
          return [...prev, { ...proposal, state: 'approved', resolvedAt: Date.now() }];
        });
        return;
      }

      setProposals(prev => {
        if (prev.some(x => x.id === proposal.id)) return prev;
        return [...prev, proposal];
      });
    }

    // ── authority.required — kernel explicitly requests human gate ───────
    if (last.type === 'authority.required') {
      const p = last.payload?.proposal ?? {};
      const id = p.proposalId ?? p.id;
      if (!id) return;

      setProposals(prev => {
        const existing = prev.find(x => x.id === id);
        if (existing) {
          // Upgrade to approval category if not already
          return prev.map(x =>
            x.id === id ? { ...x, category: 'approval' as ProposalCategory } : x
          );
        }
        // Create new if not seen yet
        const proposal: Proposal = {
          id,
          category:    'approval',
          title:       p.title       ?? 'Authority required',
          description: p.description ?? '',
          impact:      p.impact      ?? 'medium',
          state:       'draft',
          scopeId:     p.scopeId,
          createdAt:   last.timestamp,
        };
        if (isBootNoise(proposal)) return prev;
        return [...prev, proposal];
      });
    }

    // ── system.signal authority.resolved (from kernel auto-approve) ──────
    if (last.type === 'system.signal' && last.payload?.type === 'authority.resolved') {
      const proposalId = last.payload.proposalId;
      const decision   = last.payload.decision;
      if (!proposalId) return;
      setProposals(prev =>
        prev.map(p =>
          p.id === proposalId
            ? { ...p, state: decision === 'approve' ? 'approved' : 'rejected', resolvedAt: Date.now() }
            : p
        )
      );
    }
  }, [events]);

  // ── Reality Mutation Actions ─────────────────────────────────────────────
  // Each action injects a Boundary Event into the causal field.
  // The UI state change is a PROJECTION of the resulting event, not the cause.

  const approve = useCallback(async (proposalId: string) => {
    // ⭐ Boundary Event: proposal.approved → Reality Created
    try {
      await api.signal({
        type:       'authority.resolved',
        proposalId,
        decision:   'approve',
        timestamp:  Date.now(),
      });
    } catch {}
    // Project the approval locally (optimistic — event will confirm)
    setProposals(prev =>
      prev.map(p => p.id === proposalId
        ? { ...p, state: 'approved', resolvedAt: Date.now() }
        : p
      )
    );
  }, []);

  const reject = useCallback(async (proposalId: string) => {
    // ⭐ Boundary Event: proposal.rejected → Reality Closed
    try {
      await api.signal({
        type:       'authority.resolved',
        proposalId,
        decision:   'reject',
        timestamp:  Date.now(),
      });
    } catch {}
    setProposals(prev =>
      prev.map(p => p.id === proposalId
        ? { ...p, state: 'rejected', resolvedAt: Date.now() }
        : p
      )
    );
  }, []);

  const defer = useCallback(async (proposalId: string) => {
    // ⭐ Boundary Event: proposal.deferred → Superposition Maintained
    try {
      await api.signal({
        type:       'authority.resolved',
        proposalId,
        decision:   'defer',
        timestamp:  Date.now(),
      });
    } catch {}
    setProposals(prev =>
      prev.map(p => p.id === proposalId
        ? { ...p, state: 'deferred' }
        : p
      )
    );
  }, []);

  const submitFeedback = useCallback(async (proposalId: string, feedbackText: string) => {
    // ⭐ Boundary Event: user correction → new repair causal chain begins
    // This is NOT a retry. The user's feedback becomes a new input.user-equivalent
    // boundary event that the skill field will process as a fresh causal perturbation.
    if (!feedbackText.trim()) return;
    try {
      await api.signal({
        type:         'proposal.feedback',
        proposalId,
        feedbackText,
        timestamp:    Date.now(),
        // Inject as a new query into the causal field
        injectQuery:  feedbackText,
      });
    } catch {}
    setProposals(prev =>
      prev.map(p => p.id === proposalId
        ? { ...p, state: 'feedback', feedbackText, resolvedAt: Date.now() }
        : p
      )
    );
  }, []);

  const dismiss = useCallback((proposalId: string) => {
    // Local-only: remove from view without injecting an event
    // (dismiss = observer chooses not to observe, field unaffected)
    setProposals(prev => prev.filter(p => p.id !== proposalId));
  }, []);

  // ── Derived views ────────────────────────────────────────────────────────
  const pending  = proposals.filter(p => p.state === 'draft' && requiresHumanGate(p));
  const history  = proposals.filter(p => p.state !== 'draft');
  const allDraft = proposals.filter(p => p.state === 'draft');

  return {
    proposals,
    pending,   // requires human decision
    history,   // already resolved
    allDraft,  // all unresolved (including auto-healing)
    approve,
    reject,
    defer,
    submitFeedback,
    dismiss,
  };
}
