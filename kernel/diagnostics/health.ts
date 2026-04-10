import { globalEventBus } from '../event-bus';
import { kernelActivity } from '../state';

export function healthCheck() {
  const idle = Date.now() - kernelActivity.lastActivity;

  if (idle > 30000) {
    console.log('[Health] ⚠ stalled', idle);
    return 'stalled';
  }

  console.log('[Health] ✅ healthy', idle);
  return 'healthy';
}

export class HealthMonitor {
  constructor() {
    setInterval(() => {
      const idleTime = Date.now() - kernelActivity.lastActivity;

      if (idleTime > 60000) {
        console.warn('[Health] Agent stalled (no real activity)');
      }
    }, 30000);
  }
}