// workspace/skills/skill_generator.skill.ts
import fs from 'fs/promises';
import path from 'path';
import { Skill, SkillContext, SkillResult } from '../../framework/core/types.js';

export const skill: Skill = {
  name: "skill_generator",
  description: "Generates and saves new TypeScript skill files for the OpenClaw system based on user requirements.",
  keywords: ["create skill", "generate tool", "new skill", "build skill"],
  
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    // 1. 获取用户需求（兼容旧版输入）
    const userRequirement = typeof input === 'string' 
      ? input 
      : (input.query || input.requirement);
    if (!userRequirement) {
      return { 
        success: false, 
        output: { error: "No skill requirements provided." } 
      };
    }

    // 2. 检查 LLM 是否可用
    if (!context.llm) {
      return { 
        success: false, 
        output: { error: "LLM is required for skill generation." } 
      };
    }

    // 3. 构建生成代码的提示词
    const prompt = `
You are an expert TypeScript programmer for the OpenClaw framework. 
Generate a new skill file based on this requirement: "${userRequirement}"

Rules:
- Use ESM syntax (import/export).
- Import { Skill, SkillContext, SkillResult } from '../../framework/core/types.js'.
- Export a 'skill' object of type 'Skill'.
- Include 'name', 'description' (clear English), 'keywords' (array), and 'execute'.
- The 'execute' function must handle 'input.query' and return a 'SkillResult'.
- Return ONLY the TypeScript code. No markdown blocks, no explanations.
`;

    try {
      // 4. 生成代码
      let generatedCode = await context.llm.generate(prompt);
      // 清理可能出现的 markdown 标记
      generatedCode = generatedCode.replace(/```typescript|```ts|```/g, '').trim();

      // 5. 确定保存路径
      const skillsDir = context.workspace 
        ? path.join(context.workspace, 'skills') 
        : path.join(process.cwd(), 'workspace', 'skills');
      const fileName = `gen_${Date.now()}.skill.ts`;
      const filePath = path.join(skillsDir, fileName);

      // 6. 写入文件
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(filePath, generatedCode, 'utf-8');

      // 7. 返回结构化结果
      return { 
        success: true, 
        output: {
          type: "skill_generation_result",
          fileName,
          filePath,
          requirement: userRequirement,
          code: generatedCode.slice(0, 500) + (generatedCode.length > 500 ? "..." : "")  // 返回部分代码预览
        }
      };
    } catch (err) {
      return { 
        success: false, 
        output: { error: `Skill generation failed: ${String(err)}` } 
      };
    }
  }
};