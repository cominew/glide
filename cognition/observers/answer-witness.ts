// cognition/observers/answer-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';
import { GlideEvent } from '../../kernel/event-bus/event-contract.js';

export class AnswerWitness {
  private fragments = new Map<string, any[]>();

  constructor(private bus: EventBus) {
    this.bus.on('skill.output', (event: GlideEvent) => {
      const payload = event.payload as any;
      const correlationId = payload?.taskId ?? payload?.correlationId;
      if (!correlationId) return;

      if (!this.fragments.has(correlationId)) {
        this.fragments.set(correlationId, []);
      }
      this.fragments.get(correlationId)!.push(payload);

      // ⭐ 检测 complete 信号：立即合成答案
      if (payload?.complete === true) {
        setTimeout(() => this.assemble(correlationId), 50);
      }
    });

    this.bus.on('task.silent_complete', (event: GlideEvent) => {
      const correlationId = (event.payload as any)?.taskId;
      if (!correlationId) return;
      this.assemble(correlationId);
    });
  }

  // ⭐ 收集 fragments 并发射 answer.ready
  private assemble(correlationId: string) {
    const fragments = this.fragments.get(correlationId) ?? [];
    this.fragments.delete(correlationId);

    if (fragments.length > 0) {
      this.bus.emitEvent('answer.ready', {
        correlationId,
        fragments,
        assembledAt: Date.now(),
      }, 'COGNITION', correlationId);
    }
  }
}