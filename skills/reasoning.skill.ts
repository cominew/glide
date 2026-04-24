// skills/reasoning.skill.ts
import { Skill, SkillContext, SkillResult } from '../kernel/types.js';

export const skill: Skill = {
  name: 'reasoning',
  description: 'General reasoning and analysis',
  keywords: ['reason', 'analyze', 'think', 'explain'],
  inputs: ['query'],
  outputs: ['fragments'],

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const query = typeof input === 'string' ? input : input.query;
    if (!query) return { success: false, error: 'No query provided' };
    if (!context?.llm) return { success: false, error: 'LLM not available' };

    const prompt = `You are a business assistant. Answer the following query concisely and helpfully:\n\n${query}`;
    const answer = await context.llm.generate(prompt);

    return {
      success: true,
      fragments: [
        { type: 'data', name: 'reasoning_result', value: answer },
      ],
    };
  },
};