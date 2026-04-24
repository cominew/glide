// cognition/observers/answer-witness.ts

import { EventBus } from '../../kernel/event-bus/event-bus.js';
import type { GlideEvent, E } from '../../kernel/event-bus/event-contract.js';

export class AnswerWitness {
  private fragments = new Map<string, any[]>();
  private completionState = new Map<string, number>(); 

  constructor(private bus: EventBus) {
    this.bus.on('skill.fragment', (event: GlideEvent) => {
      const payload = event.payload as any;
      const id = payload?.correlationId ?? event.trace?.taskId;
      if (!id) return;

      if (!this.fragments.has(id)) {
        this.fragments.set(id, []);
      }
      this.fragments.get(id)!.push(payload);

      const current = (this.completionState.get(id) || 0) + 1;
      this.completionState.set(id, current);

      const hasCompletion = payload?.complete === true;

      if (hasCompletion) {
        this.emitAnswer(id);
        return;
      }

      if (current >= 2 && this.isStable(id)) {
        this.emitAnswer(id);
      }
    });

  
    this.bus.on('task.silent_complete', (event: GlideEvent) => {
      const id = (event.payload as any)?.correlationId ?? event.trace?.taskId;
      if (id && this.fragments.has(id) && this.fragments.get(id)!.length > 0) {
        this.emitAnswer(id);
      }
    });
  }

  private isStable(taskId: string): boolean {
    const recent = (this.fragments.get(taskId) ?? []).slice(-3);
    return recent.length >= 2; 
  }

  private emitAnswer(correlationId: string) {
    const fragments = this.fragments.get(correlationId) ?? [];
    this.fragments.delete(correlationId);
    this.completionState.delete(correlationId);

    if (fragments.length > 0) {
      this.bus.emitEvent('answer.ready', {
        correlationId,
        fragments,
        assembledAt: Date.now(),
      }, 'COGNITION', correlationId);
    }
  }
}