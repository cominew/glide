// cognition/observers/existence-witness.ts

import { EventBus } from "../../kernel/event-bus/event-bus";
import { GlideEvent } from "../../kernel/event-bus/event-contract";
import { ProposalProjection } from "../proposals/proposal-projection";


// Existence Witness：见证提案决议与回答的共现，发出存在坍缩事件

export function registerExistenceWitness(bus: EventBus) {
  const answeredChains = new Set<string>();
  const resolvedProposals = new Set<string>();

  bus.on('answer.ready', e => answeredChains.add(e.payload.chainId));
  bus.on('proposal.resolved', e => resolvedProposals.add(e.payload.proposalId));

  // 简单起见，可以在两个事件都触发后发射，但需要关联 chainId 和 proposalId，这里可设计双向监听：
  bus.on('proposal.resolved', e => {
    // 如果该 proposal 相关的 chain 已经回答，发射 existence.manifested
    const chainId = e.payload.proposalId; // 假设 proposalId 与 chainId 相同？需根据实际调整
    if (answeredChains.has(chainId)) {
      bus.emitEvent('existence.manifested', { chainId }, 'COGNITION');
    }
  });

  bus.on('answer.ready', e => {
    // 同样检查是否有已决议的 proposal
    const chainId = e.payload.chainId;
    if (resolvedProposals.has(chainId)) {
      bus.emitEvent('existence.manifested', { chainId }, 'COGNITION');
    }
  });
}