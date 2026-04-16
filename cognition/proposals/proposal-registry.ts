// cognition/proposals/proposal-registry.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Proposal Registry
// The Superposition Layer.
//
// Cognition produces proposals. Proposals exist in superposition:
//   - recorded ✔
//   - observable ✔
//   - discussable ✔
//   - NOT executed ✗
//
// Only a human observer can collapse a proposal into reality
// by approving it. Approved proposals enter the Dispatcher.
//
// This is the firewall between AI thinking and AI acting.
// ─────────────────────────────────────────────────────────────

import { EventBus } from '../../kernel/event-bus/event-bus.js';

// ── Proposal types ────────────────────────────────────────────

export type ProposalCategory =
  | 'optimization'      // system could work more efficiently
  | 'evolution'         // system could learn or grow
  | 'healing'           // system detected a problem and proposes a fix
  | 'action'            // proposed action on a device / resource
  | 'memory'            // proposed memory write
  | 'learning';         // proposed behavior update

export type ProposalState =
  | 'superposition'     // exists, not yet observed by human
  | 'presented'         // shown to dashboard / human
  | 'approved'          // human approved — will enter Dispatcher
  | 'rejected'          // human rejected — discarded
  | 'expired';          // TTL exceeded — auto-discarded

export interface Proposal {
  id:          string;
  category:    ProposalCategory;
  title:       string;
  description: string;
  reasoning:   string;       // why cognition generated this
  impact:      'low' | 'medium' | 'high';
  state:       ProposalState;
  createdAt:   number;
  expiresAt:   number;       // proposals auto-expire if not acted on
  source:      string;       // which cognition module generated it
  taskId?:     string;       // linked task if applicable
  // What to execute if approved — passed to Dispatcher
  executionIntent?: {
    type:    string;
    payload: any;
  };
}

// ── ProposalRegistry ──────────────────────────────────────────

export class ProposalRegistry {

  private proposals = new Map<string, Proposal>();
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  constructor(private bus: EventBus) {}

  // ── Create a proposal (Cognition calls this) ──────────────
  // Does NOT emit any execution event.
  // Emits proposal.created so Dashboard can display it.

  propose(params: Omit<Proposal, 'id' | 'state' | 'createdAt' | 'expiresAt'>): Proposal {
    const proposal: Proposal = {
      ...params,
      id:        `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      state:     'superposition',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.DEFAULT_TTL_MS,
    };

    this.proposals.set(proposal.id, proposal);

    // Notify dashboard — this is observation only, not execution
    this.bus.emitEvent('proposal.created', {
      proposalId: proposal.id,
      category:   proposal.category,
      title:      proposal.title,
      impact:     proposal.impact,
    }, 'COGNITION');

    console.log(`[ProposalRegistry] Proposal created: "${proposal.title}" [${proposal.category}]`);
    return proposal;
  }

  // ── Present to dashboard ──────────────────────────────────

  present(id: string): boolean {
    const p = this.proposals.get(id);
    if (!p || p.state !== 'superposition') return false;
    p.state = 'presented';
    this.bus.emitEvent('proposal.presented', { proposalId: id, title: p.title }, 'COGNITION');
    return true;
  }

  // ── Human approves → collapses into Dispatcher ────────────
  // This is the ONLY path from Superposition to Reality.
  // After approval, the caller (http-server or HumanGate)
  // must pass the executionIntent to Dispatcher.

  approve(id: string, approvedBy: string): Proposal | null {
    const p = this.proposals.get(id);
    if (!p) return null;
    if (p.state !== 'superposition' && p.state !== 'presented') return null;

    p.state = 'approved';

    this.bus.emitEvent('proposal.approved', {
      proposalId: id,
      title:      p.title,
      approvedBy,
      executionIntent: p.executionIntent,
    }, 'SYSTEM');

    console.log(`[ProposalRegistry] Proposal APPROVED: "${p.title}" by ${approvedBy}`);

    // Wavefunction collapsed — this proposal is now real
    return p;
  }

  // ── Human rejects ─────────────────────────────────────────

  reject(id: string, rejectedBy: string, reason?: string): boolean {
    const p = this.proposals.get(id);
    if (!p) return false;

    p.state = 'rejected';

    this.bus.emitEvent('proposal.rejected', {
      proposalId: id,
      title:      p.title,
      rejectedBy,
      reason,
    }, 'SYSTEM');

    console.log(`[ProposalRegistry] Proposal REJECTED: "${p.title}" by ${rejectedBy}`);
    return true;
  }

  // ── TTL cleanup ───────────────────────────────────────────
  // Call from Scheduler tick.

  expireOld(): number {
    const now     = Date.now();
    let   expired = 0;
    for (const [id, p] of this.proposals) {
      if (p.state === 'superposition' || p.state === 'presented') {
        if (now > p.expiresAt) {
          p.state = 'expired';
          this.bus.emitEvent('proposal.expired', { proposalId: id, title: p.title }, 'SYSTEM');
          expired++;
        }
      }
    }
    return expired;
  }

  // ── Read-only accessors ───────────────────────────────────

  getAll(): Proposal[] {
    return [...this.proposals.values()];
  }

  getPending(): Proposal[] {
    return [...this.proposals.values()]
      .filter(p => p.state === 'superposition' || p.state === 'presented')
      .sort((a, b) => {
        const impactScore = { high: 3, medium: 2, low: 1 };
        return (impactScore[b.impact] - impactScore[a.impact]) || (a.createdAt - b.createdAt);
      });
  }

  getById(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }

  count(): { total: number; pending: number; approved: number; rejected: number } {
    const all = [...this.proposals.values()];
    return {
      total:    all.length,
      pending:  all.filter(p => p.state === 'superposition' || p.state === 'presented').length,
      approved: all.filter(p => p.state === 'approved').length,
      rejected: all.filter(p => p.state === 'rejected').length,
    };
  }
}
