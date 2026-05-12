// skills/stabilization-narrator.skill.ts

import type { Skill, SkillResult, SkillFragment, SkillContext } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

export const skill: Skill = {
  name: 'stabilization-narrator',
  description: 'Witnesses stabilization (no fragment emission)',
  keywords: ['stabilization', 'narration'],
  canExist(event: GlideEvent): boolean {
    return event.type === 'causality.closed';
  },

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const fragments = input?.fragments ?? [];

    const summary = fragments.find((f: SkillFragment) =>
      f.name === 'persona.summary' ||
      f.name === 'ai_response' ||
      f.name === 'reasoning_result'
    )?.value;

    const baseFragment: SkillFragment = {
      type: 'data',
      name: summary ? 'final.answer' : 'reality.anomaly',
      value: summary ?? {
        reason: 'empty_answer',
        message: 'Answer incomplete — reality needs repair'
      },
      role: summary ? 'summary' : 'evidence',
      confidence: summary ? 1 : 0,
      source: 'stabilization-narrator.skill',
      phase: 'stabilization',
    };

    return {
      state: summary ? 'emitted' : 'partial',
      phase: 'stabilization',
      confidence: summary ? 1 : 0,
      fragments: [baseFragment],
    };
  }
};