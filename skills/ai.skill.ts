// skills/ai.skill.ts
import { Skill, SkillContext, SkillResult } from '../kernel/types.js';

export const skill: Skill = {
  name: 'ai',
  description: 'General AI conversation using Ollama',
  keywords: ['ai', 'chat', 'conversation', 'assistant'],
  inputs: ['query'],
  outputs: ['fragments'],

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const query = typeof input === 'string' ? input : input.query;
    if (!query) {
      return { success: false, error: 'No query provided' };
    }
    if (!context?.llm) {
      return { success: false, error: 'LLM not available' };
    }
    const answer = await context.llm.generate(query);
    return {
      success: true,
      fragments: [
        { type: 'data', name: 'ai_response', value: answer },
      ],
    };
  },
};