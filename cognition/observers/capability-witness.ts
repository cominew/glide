// cognition/observers/capability-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus';
import { GlideEvent } from '../../kernel/event-bus/event-contract';

export class CapabilityWitness {
  constructor(private bus: EventBus) {
    // 监听所有可能改变场状态的事件，记录能力的出现与缺失
    this.bus.on('input.user', (e: GlideEvent) => this.observeFieldPerturbation(e, 'input.user'));
    this.bus.on('skill.output', (e: GlideEvent) => this.observeFieldPerturbation(e, 'skill.output'));
    this.bus.on('meaning.unresolved', (e: GlideEvent) => this.observeFieldPerturbation(e, 'meaning.unresolved'));
    this.bus.on('non_resonant_field_vacuum', (e: GlideEvent) => this.observeVacuum(e));

    console.log('[CapabilityWitness] Witnessing capability emergence');
  }

  private observeFieldPerturbation(event: GlideEvent, source: string) {
    const taskId = event.trace?.taskId ?? event.id;
    // 记录每次场扰动，但不预测未来
    this.bus.emitEvent('capability.observed', {
      taskId,
      source,
      phase: event.payload?.phase ?? 'unknown',
      skill: event.payload?.skill ?? 'unknown',
    }, 'COGNITION');
  }

  private observeVacuum(event: GlideEvent) {
    this.bus.emitEvent('capability.missing', {
      taskId: event.payload?.taskId,
      reason: event.payload?.reason,
      originalEventId: event.payload?.originalEventId,
    }, 'COGNITION');
  }
}