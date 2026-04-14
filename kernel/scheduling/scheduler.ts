// kernel/scheduler.ts

import { GoalEngine } from '../runtime/goal-engine/goal-engine';
import { ConsciousLoop } from './conscious-loop';

export type SchedulerMode =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped';

export class Scheduler {

  private mode: SchedulerMode = 'idle';
  private interval?: NodeJS.Timeout;

  constructor(
    private consciousLoop: ConsciousLoop,
    private goalEngine: GoalEngine
  ) {}


  // ------------------------
  // START
  // ------------------------

  start(tickMs = 1500) {

    if (this.mode === 'running') return;

    console.log('🧭 Scheduler started');

    this.mode = 'running';

    this.interval = setInterval(
      () => this.tick(),
      tickMs
    );
  }

  // ------------------------
  // TICK (AI HEARTBEAT)
  // ------------------------

  private async tick() {

  if (this.mode !== 'running') return;

  try {

      // 🧠  thinking
      await this.consciousLoop.tick();

      // ⚙️ acting
      await this.goalEngine.tick();

    } catch (err) {

      console.error('[Scheduler] Tick error:', err);

    }
  }

  // ------------------------

  pause() {
    this.mode = 'paused';
    console.log('⏸ Scheduler paused');
  }

  resume() {
    this.mode = 'running';
    console.log('▶ Scheduler resumed');
  }

  stop() {

    this.mode = 'stopped';

    if (this.interval)
      clearInterval(this.interval);

    console.log('🛑 Scheduler stopped');
  }

  getState() {
    return this.mode;
  }
}

export function startScheduler(scheduler: Scheduler) {
  scheduler.start();
}