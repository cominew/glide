// kernel/executor.ts
import { Skill, SkillContext, SkillResult } from '../kernel/types';

export class Executor {
  async execute(skill: Skill, input: any, context: SkillContext): Promise<SkillResult> {
    try {
      return await skill.execute(input, context);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}