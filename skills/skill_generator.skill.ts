// skills/skill_generator.skill.ts
import fs from 'fs/promises';
import path from 'path';
import { Skill, SkillContext, SkillResult } from '../kernel/types.js';

export const skill: Skill = {
  name: 'skill_generator',
  description: 'Generates and saves new TypeScript skill files based on user requirements.',
  keywords: ['create skill', 'generate tool', 'new skill', 'build skill'],
  inputs: ['query', 'requirement'],
  outputs: ['fragments'],

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const userRequirement = typeof input === 'string'
      ? input
      : (input.query || input.requirement);
    if (!userRequirement) {
      return { success: false, error: 'No skill requirements provided.' };
    }

    if (!context?.llm) {
      return { success: false, error: 'LLM is required for skill generation.' };
    }

    const prompt = `
You are an expert TypeScript programmer for the OpenClaw framework.
Generate a new skill file based on this requirement: "${userRequirement}"

Rules:
- Use ESM syntax (import/export).
- Import { Skill, SkillContext, SkillResult } from '../../kernel/types.js'.
- Export a 'skill' object of type 'Skill'.
- Include 'name', 'description' (clear English), 'keywords' (array), 'inputs', 'outputs', and 'handler'.
- The 'handler' function must handle 'input.query' and return a 'SkillResult' with 'fragments'.
- Return ONLY the TypeScript code. No markdown blocks, no explanations.
`;

    try {
      let generatedCode = await context.llm.generate(prompt);
      generatedCode = generatedCode.replace(/```typescript|```ts|```/g, '').trim();

      const skillsDir = context.workspace
        ? path.join(context.workspace, 'skills')
        : path.join(process.cwd(), 'workspace', 'skills');
      const fileName = `gen_${Date.now()}.skill.ts`;
      const filePath = path.join(skillsDir, fileName);

      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(filePath, generatedCode, 'utf-8');

      return {
        success: true,
        fragments: [
          { type: 'data', name: 'skill_generated', value: { fileName, filePath, requirement: userRequirement } },
          { type: 'data', name: 'code_preview', value: generatedCode.slice(0, 500) + (generatedCode.length > 500 ? '...' : '') },
        ],
      };
    } catch (err) {
      return { success: false, error: `Skill generation failed: ${String(err)}` };
    }
  },
};