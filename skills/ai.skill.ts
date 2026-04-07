// skills/ai.skill.ts
import { Skill, SkillContext, SkillResult } from '../kernel/types';

export const skill: Skill = {
  name: 'ai',
  description: 'General AI conversation using Ollama',
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const query = typeof input === 'string' ? input : input.query;
    if (!query) return { success: false, error: 'No query' };
    if (context.llm) {
      const answer = await context.llm.generate(query);
      return { success: true, output: answer };
    }
    return { success: false, error: 'LLM not available' };
  }
};