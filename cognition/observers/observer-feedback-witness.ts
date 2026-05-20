// cognition/observers/observer-feedback-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';

export function registerObserverFeedbackWitness(bus: EventBus) {
  bus.on('observer.feedback', (event) => {
    const { judgment, note, targetScope } = event.payload ?? {};

    // 始终生成一个反思记录
    bus.emitEvent('reflection.created', {
      scopeId: targetScope,
      observation: `Observer feedback received: ${judgment}${note ? ` — ${note}` : ''}`,
    }, 'COGNITION');

    if (judgment === 'correction' && note) {
      // 关键：将修正建议作为新的用户输入，启动技能共振
      bus.emitEvent('input.user', {
        input: {
          message: `Correct the previous answer: ${note}`,
          sessionId: `correction_${Date.now()}`,
          repairMode: true,
          targetScope,
        },
        source: 'observer.feedback',
        scopeId: targetScope ?? '',
      }, 'SYSTEM', {
        origin: event.id,
        cause: 'observer.feedback',
        constraint: { requires: [], conflicts: [] },
        depth: 0,
      });
      return;
    }
    // 其他反馈生成优化提案
    const titleMap: Record<string, string> = {
      positive: 'Answer confirmed as useful', incorrect: 'Answer flagged as incorrect', style: 'Style improvement suggested',
    };
    bus.emitEvent('proposal.created', {
      proposalId: `feedback_${Date.now()}`, category: 'optimization', title: titleMap[judgment] ?? `Feedback: ${judgment}`, impact: 'low', description: note ?? '',
    }, 'COGNITION');
  });
}