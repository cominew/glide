// kernel/conscious-loop.ts

import { glideEventBus } from './event-bus';
import { Orchestrator } from '../runtime/orchestrator/orchestrator';
import { SkillContext } from './types';
import { kernelState } from './state';

export class ConsciousLoop {

  constructor(
    private orchestrator: Orchestrator,
    private context: SkillContext
  ) {}

  public start() {
    console.log('🧠 ConsciousLoop started');
    this.loop();
  }

  public stop() {
    console.log('🧠 ConsciousLoop stopped');
  }

  // ⭐ 必须存在（scheduler依赖）
  public tick() {
    return this.orchestrator.reflect();
  }

  private async loop() {
    while (true) {
      try {
        await this.tick();
      } catch (err) {
        console.error('[ConsciousLoop]', err);
      }
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

let loopInstance: ConsciousLoop | null = null;

export function startConsciousLoop(
  orchestrator: Orchestrator,
  context: SkillContext
) {
  return new ConsciousLoop(orchestrator, context);
}
