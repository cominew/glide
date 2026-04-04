// core/executor.ts
import { Skill, SkillContext, SkillResult } from './types.js';

export class Executor {
  async execute(skill: Skill, input: string, context: SkillContext): Promise<SkillResult> {
    try {
      return await skill.execute({ query: input }, context);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}