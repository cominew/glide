// cognition/proposals/proposal-registry.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';

export type ProposalCategory = 'optimization' | 'evolution' | 'healing' | 'action' | 'memory' | 'learning';
export type ProposalState = 'draft' | 'approved' | 'rejected' | 'deferred';

export interface Proposal {
  id: string;
  category: ProposalCategory;
  title: string;
  description: string;
  reasoning: string;
  impact: 'low' | 'medium' | 'high';
  state: ProposalState;
  createdAt: number;
  expiresAt: number;
  source: string;
  taskId?: string;
  executionIntent?: { type: string; payload: any };
}

export class ProposalRegistry {
  private proposals = new Map<string, Proposal>();
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(private bus: EventBus) {}

  propose(params: Omit<Proposal, 'id' | 'state' | 'createdAt' | 'expiresAt'>): Proposal {
    const proposal: Proposal = {
      ...params,
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      state: 'draft',   // 合于新状态：未坍缩的可能性
      createdAt: Date.now(),
      expiresAt: Date.now() + this.DEFAULT_TTL_MS,
      source: params.source ?? 'field.observation',
    };

    this.proposals.set(proposal.id, proposal);

    this.bus.emitEvent('proposal.created', {
      proposalId: proposal.id,
      category: proposal.category,
      title: proposal.title,
      impact: proposal.impact,
    }, 'COGNITION');

    // 提议同时投射到 Agenda
    this.bus.emitEvent('proposal.arisen', {
      proposal: proposal,
      timestamp: Date.now(),
    }, 'SYSTEM');

    console.log(`[ProposalRegistry] Proposal created: "${proposal.title}" [${proposal.category}]`);
    return proposal;
  }

  // 批准：从草稿变为现实
  approve(id: string, approvedBy: string): Proposal | null {
    const p = this.proposals.get(id);
    if (!p) return null;
    if (p.state !== 'draft' && p.state !== 'deferred') return null;
    p.state = 'approved';
    this.bus.emitEvent('proposal.approved', {
      proposalId: id, title: p.title, approvedBy, executionIntent: p.executionIntent,
    }, 'SYSTEM');
    console.log(`[ProposalRegistry] Proposal APPROVED: "${p.title}" by ${approvedBy}`);
    return p;
  }

  // 拒绝：关闭此可能性
  reject(id: string, rejectedBy: string, reason?: string): boolean {
    const p = this.proposals.get(id);
    if (!p) return false;
    if (p.state !== 'draft' && p.state !== 'deferred') return false;
    p.state = 'rejected';
    this.bus.emitEvent('proposal.rejected', { proposalId: id, title: p.title, rejectedBy, reason }, 'SYSTEM');
    console.log(`[ProposalRegistry] Proposal REJECTED: "${p.title}" by ${rejectedBy}`);
    return true;
  }

  // 搁置：保留叠加态
  defer(id: string, deferredBy: string, reason?: string): boolean {
    const p = this.proposals.get(id);
    if (!p) return false;
    if (p.state !== 'draft' && p.state !== 'deferred') return false; // 只有未决态可被搁置
    p.state = 'deferred';
    this.bus.emitEvent('proposal.deferred', { proposalId: id, title: p.title, deferredBy, reason }, 'SYSTEM');
    console.log(`[ProposalRegistry] Proposal DEFERRED: "${p.title}" by ${deferredBy}`);
    return true;
  }

  // 过期处理：仅对草稿或搁置的提案
  expireOld(): number {
    const now = Date.now();
    let expired = 0;
    for (const [id, p] of this.proposals) {
      if ((p.state === 'draft' || p.state === 'deferred') && now > p.expiresAt) {
        p.state = 'rejected'; // 过期视为关闭
        this.bus.emitEvent('proposal.expired', { proposalId: id, title: p.title }, 'SYSTEM');
        expired++;
      }
    }
    return expired;
  }

  getAll(): Proposal[] { return [...this.proposals.values()]; }
  
  // 待处理：草稿或搁置
  getPending(): Proposal[] {
    return [...this.proposals.values()]
      .filter(p => p.state === 'draft' || p.state === 'deferred')
      .sort((a, b) => ({ high: 3, medium: 2, low: 1 })[b.impact] - ({ high: 3, medium: 2, low: 1 })[a.impact] || a.createdAt - b.createdAt);
  }

  getById(id: string): Proposal | undefined { return this.proposals.get(id); }

  count() {
    const all = [...this.proposals.values()];
    return {
      total: all.length,
      pending: all.filter(p => p.state === 'draft' || p.state === 'deferred').length,
      approved: all.filter(p => p.state === 'approved').length,
      rejected: all.filter(p => p.state === 'rejected').length,
    };
  }
}