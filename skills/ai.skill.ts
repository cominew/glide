// skills/ai.skill.ts
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

export const skill: Skill = {
  name: 'ai',
  description: 'Language converter — manifests on causality closure',
  keywords: ['ai', 'chat', 'language'],

  canExist(event: GlideEvent): boolean {
    return event.type === 'causality.closed';   
  },

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const llm = context?.llm;
    if (!llm) {
      return {
        state: 'partial',
        phase: 'synthesis',
        fragments: [],
        confidence: 0,
      };
    }

    let content = '';
    const fragments = input?.fragments ?? [];

    if (fragments.length > 0) {
      content = fragments
        .filter((f: any) => f.type === 'data')
        .map((f: any) => typeof f.value === 'string' ? f.value : JSON.stringify(f.value, null, 2))
        .join('\n\n');
    } else if (typeof input === 'string') {
      content = input;
    } else if (input?.input?.message) {
      content = input.input.message;
    }

    if (!content.trim()) {
      return {
        state: 'partial',
        phase: 'synthesis',
        fragments: [],
        confidence: 0,
      };
    }

    const prompt = `You are a helpful assistant. Answer the following in English, concisely and helpfully:\n\n${content}`;
    const answer = await llm.generate(prompt);

    return {
      state: 'emitted',
      confidence: 0.9,
      phase: 'synthesis',
      fragments: [{
        type: 'data',
        name: 'ai_response',
        value: answer,
        role: 'summary',
        confidence: 0.9,
        source: 'ai.skill',
        phase: 'synthesis',
      }],
    };
  },
};