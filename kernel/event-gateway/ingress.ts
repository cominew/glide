// kernel/event-gateway/ingress.ts
// ─────────────────────────────────────────────
// Glide OS — Event Ingress
// No Dispatcher
// No Task
// No Runtime
// Only Event Arising
// ─────────────────────────────────────────────

import { EventBus } from '../event-bus/event-bus';
import { E } from '../event-bus/event-contract';

export class Ingress {

  constructor(
    private eventBus: EventBus,
  ) {}

  /**
   * External disturbance enters Glide
   */
  receiveUserInput(text: string) {

    console.log('[Ingress] disturbance detected');

    this.eventBus.emitEvent(
      E.INPUT_USER,
      {
        text,
        timestamp: Date.now(),
      },
      'SYSTEM'
    );  
  }

  /**
   * Internal system disturbance
   */
  receiveSystemSignal(signal: string, data?: any) {

    this.eventBus.emitEvent(
      E.SYSTEM_SIGNAL,
      {
        signal,
        data,
        timestamp: Date.now(),
      },
      'SYSTEM'
    );
  }
}