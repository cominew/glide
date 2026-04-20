// skill/reasoning.skill.ts

import { Skill, SkillContext } from '../kernel/types.js';

export const ReasoningSkill: Skill = {
  name: 'reasoning',
  description: 'General reasoning and analysis',
  async execute(input: any, context: SkillContext) {
    const query = input.query || input;
    const prompt = `You are a business assistant. Answer the following query concisely and helpfully:\n\n${query}`;
    const answer = await context.llm.generate(prompt);
    return {
      success: true,
      output: { type: 'reasoning_result', answer },
    };
  },
};