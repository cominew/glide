import { globalEventBus } from '../event-bus.js';

export class HealthMonitor {
  private lastEvent = Date.now();

  constructor() {
    globalEventBus.onAny(() => {
      this.lastEvent = Date.now();
    });

    setInterval(() => {
      if (Date.now() - this.lastEvent > 10000) {
        console.warn('[Health] Agent stalled');
      }
    }, 3000);
  }
}