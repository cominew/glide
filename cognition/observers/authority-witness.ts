// cognition/observers/authority-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';

export function registerAuthorityWitness(bus: EventBus) {

  // ── 观察张力，发出人类权威请求 ──
  bus.on('proposal.created', (event) => {
    const p = event.payload;
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
      }, 'SYSTEM', {
        origin: event.id,
        cause: 'proposal.created',
        constraint: { requires: [], conflicts: [] },
        depth: 0,
      });
    }
  });

  // ── 见证坍缩 ──
  bus.on('authority.resolved', (event) => {
    const { proposalId, decision, reason, category, note } = event.payload;
    if (!proposalId || !decision) return;

    // 发射坍缩事件（人类权威裁决）
    bus.emitEvent('reality.collapsed', {
      proposalId,
      decision,
      collapsedAt: Date.now(),
    }, 'SYSTEM', {
      origin: event.id,
      cause: 'authority.resolved',
      constraint: { requires: [], conflicts: [] },
      depth: 0,
    });

    // 修正请求：输入框内带有具体修改意见
    if (decision === 'correct' && note) {
      bus.emitEvent('input.user', {
        input: {
          message: `Correct the previous answer: ${note}`,
          sessionId: `correction_${proposalId}`,
          repairMode: true,
        },
        source: 'authority',
        scopeId: '',
      }, 'SYSTEM', {
        origin: event.id,
        cause: 'authority.correct',
        constraint: { requires: [], conflicts: [] },
        depth: 0,
      });
    }

    // healing 类型的批准：下游通过检查 reality.collapsed 来决定是否触发修复
    if (decision === 'approve' && category === 'healing') {
      bus.emitEvent('healing.requested', {
        proposalId,
        reason: reason ?? 'Human approved healing proposal',
      }, 'SYSTEM');
    }
  });
}