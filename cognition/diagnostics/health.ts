import { kernelActivity, kernelState } from '../state';

export function healthCheck() {
  const idle = Date.now() - kernelActivity.lastActivity;

  // ⚠️ 只有“长期无活动”才算异常
  if (idle > 60000) {
    console.log('[Health] Agent stalled');
    return 'stalled';
  }

  if (idle > 10000) {
    console.log('[Health] Agent idle');
    return 'idle';
  }

  console.log('[Health] Agent active');
  return 'active';
}


export class HealthMonitor {
  constructor() {
    setInterval(() => {

      // ⭐⭐⭐ 关键行就在这里
      if (kernelState.get() === 'IDLE') {
        return;
      }

      const idleTime = Date.now() - kernelActivity.lastActivity;

      if (idleTime > 60000) {
        console.warn('[Health] Agent stalled (no real activity)');
      }

    }, 30000);
  }
}