// kernel/diagnostics/observer.ts
import { globalEventBus } from '../event-bus';
import type { AgentEvent } from '../event-types';

export class Observer {
  constructor() {
    globalEventBus.onAny(this.handleEvent.bind(this));
  }

  private handleEvent(event: AgentEvent<any>): void {
    if (event.type === 'task:error') {
      this.recordFailure(event.payload);
    }
    if (event.type === 'skill:end') {
      this.recordPerformance(event.payload);
    }
  }

  private recordFailure(payload: { error?: string }): void {
    console.log('[Observer] Failure detected:', payload.error);
  }

  private recordPerformance(payload: { skill?: string; duration?: number }): void {
    console.log(`[Observer] ${payload.skill ?? 'unknown'} took ${payload.duration ?? 0}ms`);
  }
}