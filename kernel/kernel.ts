// D:\glide\kernel\kernel.ts
import { SkillContext } from './types.js';

export class Kernel {
  private context: SkillContext = {};

  getContext(): SkillContext {
    return this.context;
  }
}