// cognition/observer.ts

import { BaseEvent, globalEventBus } from '../kernel/event-bus/event-bus';
import type { AgentEvent } from '../kernel/event-bus/event-types';

export class Observer {
  constructor() {
    globalEventBus.onAny(this.handleEvent.bind(this));
  }

  private handleEvent(event: BaseEvent<any>): void {

  if (event.type === 'task:error') {
    this.recordFailure(event.payload as { error?: string });
  }

  if (event.type === 'skill:end') {
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