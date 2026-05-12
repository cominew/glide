// cognition/observers/authority-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';
import { ProposalRegistry } from '../proposals/proposal-registry.js';

export function registerAuthorityWitness(bus: EventBus, registry: ProposalRegistry) {
  // 提案产生时，若需要人类权威，则发射 authority.required
  bus.on('proposal.created', (event) => {
    const p = event.payload;
    // 仅高影响或 healing 提案需要人类审批
    if (p.impact === 'high' || p.category === 'healing') {
      bus.emitEvent('authority.required', {
        proposal: {
          proposalId: p.proposalId,
          title: p.title,
          category: p.category,
          impact: p.impact,
          description: p.description,
        },
        timestamp: Date.now(),
      }, 'SYSTEM');
    }
  });

  // 权威决议：人类决定到达
  bus.on('authority.resolved', (event) => {
    const { proposalId, decision } = event.payload;
    if (!proposalId || typeof decision !== 'string') return;

    let resolved = false;
    if (decision === 'approve') {
      const p = registry.approve(proposalId, 'human');
      if (p) resolved = true;
    } else if (decision === 'reject') {
      const success = registry.reject(proposalId, 'human', 'Rejected by user');
      if (success) resolved = true;
    } else if (decision === 'defer') {
      const success = registry.defer(proposalId, 'human', 'User chose to defer');
      if (success) resolved = true;
    }

    // 若决议成功，发射 proposal.resolved (向后兼容) 以及 reality.collapsed
    if (resolved) {
      bus.emitEvent('proposal.resolved', {
        proposalId,
        decision,
        resolvedAt: Date.now(),
      }, 'SYSTEM');

      // ⭐ 缺失的关键事件：现实坍缩
      bus.emitEvent('reality.collapsed', {
        proposalId,
        decision,
        collapsedAt: Date.now(),
      }, 'SYSTEM');
    }
  });
}