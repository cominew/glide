// skills/_template/skill-template.ts

/**
 * Glide Skill Canonical Template (v4)
 *
 * ⚠️ Types are defined ONLY in:
 *    kernel/types/skill.ts
 *
 * Never redefine Skill interfaces here.
 */

import type { Skill } from '../../kernel/types/skill.js';

export const exampleSkill: Skill = {

  name: 'example.skill',

  description: 'Example Glide Skill',

  keywords: ['example'],

  canExist(event) {
    return event.type === 'example.event';
  },

  async handler(input, ctx) {

    return {
      success: true,
      state: 'emitted',
      confidence: 1,
      phase: 'analysis',

      fragments: [
        {
          type: 'data',
          name: 'example.fragment',
          value: input,
          role: 'primary',
          source: 'example.skill',
          confidence: 1,
          phase: 'analysis'
        }
      ]
    };
  }
};