// kernel/conscious-loop.ts

import { glideEventBus } from './event-bus';
import { Orchestrator } from '../runtime/orchestrator/orchestrator';
import { SkillContext } from './types';

export class ConsciousLoop {

  private running = false;

  constructor(
    private orchestrator: Orchestrator,
    private context: SkillContext
  ) {}

  start() {
    if (this.running) return;
    this.running = true;

    console.log('🧠 Glide Conscious Loop started');

    this.loop();
  }

  stop() {
    this.running = false;
  }

  private async loop() {

    while (this.running) {

      glideEventBus.emit({
        type: 'thinking',
        timestamp: Date.now(),
        payload: 'Background reflection cycle'
      });

      try {

        await this.orchestrator.process(
          'Reflect on system state and suggest next action.',
          this.context
        );

      } catch (err) {
        console.error('[ConsciousLoop]', err);
      }

      await this.sleep(15000); // every 15s
    }
  }

  private sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}// kernel/conscious-loop.ts

import { glideEventBus } from './event-bus.js';
import { Orchestrator } from '../runtime/orchestrator/orchestrator.js';
import { SkillContext } from './types.js';

export class ConsciousLoop {

  private running = false;

  constructor(
    private orchestrator: Orchestrator,
    private context: SkillContext
  ) {}

  start() {
    if (this.running) return;
    this.running = true;

    console.log('🧠 Glide Conscious Loop started');

    this.loop();
  }

  stop() {
    this.running = false;
  }

  private async loop() {

    while (this.running) {

      glideEventBus.emit({
        type: 'thinking',
        timestamp: Date.now(),
        payload: 'Background reflection cycle'
      });

      try {

        await this.orchestrator.process(
          'Reflect on system state and suggest next action.',
          this.context
        );

      } catch (err) {
        console.error('[ConsciousLoop]', err);
      }

      await this.sleep(15000); // every 15s
    }
  }

  private sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}