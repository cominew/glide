// D:\glide\kernel\kernel.ts
import { SkillContext } from './types';

export class Kernel {
  private context: SkillContext = {};

  getContext(): SkillContext {
    return this.context;
  }
}

new Observer(bus)
new HealthMonitor(bus)