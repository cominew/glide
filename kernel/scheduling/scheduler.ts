// kernel/scheduling/scheduler.ts
// ─────────────────────────────────────────────────────────────
// Kernel Scheduler
// Emits system.clock.pulse for ConsciousLoop tick.
// Clock rate: 5s — slow enough not to flood SSE.
// source = 'KERNEL', visibility = BACKGROUND.
// ─────────────────────────────────────────────────────────────

import { EventBus } from '../event-bus/event-bus';
import { E } from '../event-bus/event-contract';



export class Scheduler {

  private interval?: NodeJS.Timeout;

  constructor(private bus: EventBus) {}

start(intervalMs = 5000) {
  this.interval = setInterval(() => {
    // 仅检查定时任务，不发射任何认知相关事件
    // 未来：调用 goalEngine.checkScheduledTasks()
  }, intervalMs);
  console.log(`   ⏰ Scheduler started (silent mode, ${intervalMs}ms tick for task checks only)`);
}

  stop() {
    if (this.interval) clearInterval(this.interval);
  }
}
