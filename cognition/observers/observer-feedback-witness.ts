// cognition/observers/observer-feedback-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';

export function registerObserverFeedbackWitness(bus: EventBus) {
  bus.on('observer.feedback', (event) => {
    const { judgment, note, targetScope } = event.payload ?? {};

    // 1. 发射反思事件，记录此次观察者对现实的再观察
    bus.emitEvent('reflection.created', {
      scopeId: targetScope,
      observation: `Observer feedback received: ${judgment}${note ? ` — ${note}` : ''}`,
    }, 'COGNITION');

    // 2. 如果是修正类型且有修改说明，将其作为新的 input.user 注入场中
    if (judgment === 'correction' && note) {
      // 发射提案，让修正出现在 Agenda 中
      bus.emitEvent('proposal.created', {
        proposalId: `feedback_${Date.now()}`,
        category: 'healing',
        title: `Revise answer: ${note.slice(0, 80)}`,
        impact: 'medium',
      }, 'COGNITION');

      // 将修正作为新的用户输入重新投入 SkillField
      bus.emitEvent('input.user', {
        input: {
          message: `Correct the previous answer: ${note}`,
          sessionId: `feedback_${targetScope ?? Date.now()}`,
        },
        source: 'observer.feedback',
        scopeId: targetScope ?? '',
      }, 'SYSTEM', {
        origin: event.id,
        cause: 'observer.feedback',
        constraint: { requires: [], conflicts: [] },
        depth: 0,
      });
    }

    // 3. 其他反馈类型（positive/incorrect/style）也生成提案，以便追踪
    if (judgment !== 'correction') {
      const titleMap: Record<string, string> = {
        positive: 'Answer confirmed as useful',
        incorrect: 'Answer flagged as incorrect',
        style: 'Style improvement suggested',
      };
      bus.emitEvent('proposal.created', {
        proposalId: `feedback_${Date.now()}`,
        category: 'optimization',
        title: titleMap[judgment] ?? `Feedback: ${judgment}`,
        impact: 'low',
      }, 'COGNITION');
    }

    // 4. 发射投影事件，让 Mind Surface 感知此次再观察
    bus.emitEvent('observer.feedback.recorded', {
      judgment,
      note,
      targetScope,
      timestamp: Date.now(),
    }, 'COGNITION');
  });
}