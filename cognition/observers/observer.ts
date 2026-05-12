import { globalEventBus } from '../../kernel/event-bus/event-bus';
import type { GlideEvent } from '../../kernel/event-bus/event-contract';

export class Observer {
  private initialized = false;

  constructor() {
    globalEventBus.onAny(this.handleEvent.bind(this));

    globalEventBus.on('input.user', (event: GlideEvent) => {
      globalEventBus.emitEvent(
        'awareness.disturbance',
        {
          source: 'input.user',
          summary: event.payload?.input?.message?.slice(0, 60),
          taskId: event.id,
        },
        'COGNITION'
      );

      if (!this.initialized) {
        this.initialized = true;
        globalEventBus.emitEvent('proposal.created', {
          title: 'System ready',
          description: 'Glide cognitive field is now active.',
          impact: 'low',
        }, 'COGNITION');
      }
    });

    globalEventBus.on('skill.output', (event: GlideEvent) => {
      globalEventBus.emitEvent(
        'awareness.skill_arising',
        {
          skill: event.payload?.skill,
          phase: event.payload?.phase,
          fragmentCount: event.payload?.fragments?.length ?? 0,
          taskId: event.trace?.taskId ?? event.id,
        },
        'COGNITION'
      );
    });
  }

  private handleEvent(event: GlideEvent): void {
    if (event.type === 'task:error' || event.type === 'task.failed') {
      this.recordFailure(event.payload as { error?: string });
    }
    if (event.type === 'skill:end' || event.type === 'skill.error') {
      this.recordPerformance(
        event.payload as { skill?: string; duration?: number }
      );
    }
  }

  private recordFailure(payload: { error?: string }): void {
    console.log('[Observer] Failure detected:', payload.error);
  }

  private recordPerformance(payload: { skill?: string; duration?: number }): void {
    console.log(`[Observer] ${payload.skill ?? 'unknown'} took ${payload.duration ?? 0}ms`);
  }
}