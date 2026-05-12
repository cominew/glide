// skills/skill_generator.skill.ts
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';
import fs from 'fs/promises';
import path from 'path';

export const skill: Skill = {
  name: 'skill_generator',
  description: 'Generates and saves new TypeScript skill files based on user requirements.',
  keywords: ['create skill', 'generate tool', 'new skill', 'build skill'],

  canExist(event: GlideEvent): boolean {
    if (event.type !== 'input.user') return false;
    const text = String(event.payload?.input?.message ?? '');
    return /\b(?:create|generate|build|make)\s+(?:a\s+)?(?:new\s+)?skill\b/i.test(text);
  },

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const userRequirement = typeof input === 'string'
      ? input
      : (input.query || input.requirement || input.input?.message);
    if (!userRequirement) {
      return { state: 'partial', confidence: 0, phase: 'synthesis', fragments: [] };
    }

    if (!context?.llm) {
      return {
        state: 'failed',
        confidence: 0,
        phase: 'synthesis',
        fragments: [{
          type: 'data',
          name: 'error',
          value: 'LLM is required for skill generation.',
          source: 'skill_generator.skill',
          phase: 'synthesis',
          confidence: 1.0,
        }],
      };
    }

    const prompt = `
You are an expert TypeScript programmer for the Glide framework.
Generate a new skill file based on this requirement: "${userRequirement}"

Rules:
- Use ESM syntax (import/export).
- Import { Skill, SkillContext, SkillResult } from '../../kernel/types/skill.js'.
- Export a 'skill' object of type 'Skill'.
- Include 'name', 'description', 'keywords', 'canExist', and 'handler'.
- The 'handler' function must handle 'input.query' and return a 'SkillResult' with phase, confidence, fragments.
- Each fragment must have type: 'data', name, value, source, phase, confidence.
- Return ONLY the TypeScript code. No markdown blocks, no explanations.
`;

    try {
      let generatedCode = await context.llm.generate(prompt);
      generatedCode = generatedCode.replace(/```typescript|```ts|```/g, '').trim();

      const skillsDir = context.workspace
        ? path.join(context.workspace, 'skills')
        : path.join(process.cwd(), 'skills');
      const fileName = `gen_${Date.now()}.skill.ts`;
      const filePath = path.join(skillsDir, fileName);

      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(filePath, generatedCode, 'utf-8');

      return {
        state: 'emitted',
        confidence: 0.9,
        phase: 'synthesis',
        fragments: [
          {
            type: 'data',
            name: 'skill_generated',
            value: { fileName, filePath, requirement: userRequirement },
            source: 'skill_generator.skill',
            phase: 'synthesis',
            confidence: 0.9,
            role: 'primary',
          },
          {
            type: 'data',
            name: 'code_preview',
            value: generatedCode.slice(0, 500) + (generatedCode.length > 500 ? '...' : ''),
            source: 'skill_generator.skill',
            phase: 'synthesis',
            confidence: 0.9,
          },
        ],
      };
    } catch (err) {
      return {
        state: 'failed',
        confidence: 0,
        phase: 'synthesis',
        fragments: [{
          type: 'data',
          name: 'error',
          value: `Skill generation failed: ${String(err)}`,
          source: 'skill_generator.skill',
          phase: 'synthesis',
          confidence: 1.0,
        }],
      };
    }
  },
};