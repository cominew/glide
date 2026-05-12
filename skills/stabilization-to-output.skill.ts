//skills/stabilization-to-output.skill.ts

import type { GlideEvent } from '../kernel/event-bus/event-contract';
import type { Skill, SkillResult } from '../kernel/types/skill';

export const skill: Skill = {
  name: 'stabilization-to-output',

  description:
    'Finalizes stabilized causality into observable answer output.',

  keywords: [
    'stability',
    'answer',
    'collapse',
    'causality',
    'output'
  ],

  // ⭐ 只在因果闭合时存在
  canExist(event: GlideEvent): boolean {
    return event.type === 'causality.closed';
  },

  async handler(input: any): Promise<SkillResult> {

    const fragments = input?.fragments ?? [];

    const narrative = fragments.find((f: any) =>
      f.name === 'persona.summary' ||
      f.name === 'ai_response' ||
      f.name === 'reasoning_result'
    );

    /**
     * =============================
     * REALITY DAMAGE DETECTION
     * =============================
     */

    if (!narrative) {
      return {
        state: 'partial',
        phase: 'synthesis',
        confidence: 0.2,

        fragments: [
          {
            type: 'signal',          // ✅ FIXED
            role: 'supplementary',   // ✅ FIXED
            name: 'reality.repair.proposed',

            value: {
              message:
                'Reality incomplete. Repair proposal submitted.',
              reason: 'missing_narrative',
            },

            confidence: 1,
            source: 'stabilization-to-output.skill',
            phase: 'synthesis',
          },
        ],
      };
    }

    /**
     * =============================
     * FINAL ANSWER COLLAPSE
     * =============================
     */

    return {
      state: 'emitted',
      phase: 'synthesis',
      confidence: 1,

      fragments: [
        {
          type: 'data',          // ✅ FIXED
          role: 'summary',       // ✅ FIXED
          name: 'final.answer',

          value: narrative.value,

          confidence: 1,
          source: 'stabilization-to-output.skill',
          phase: 'synthesis',
        },
      ],
    };
  },
};