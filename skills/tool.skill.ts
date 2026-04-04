// workspace/skills/tool.skill.ts – ESM V9
import { Skill, SkillContext, SkillResult } from "../../framework/core/types";

export const skill: Skill = {
  name: "tool",
  description: "Utility skill for basic calculations, string operations, and tools.",
  keywords: ["tool", "calculate", "math", "convert", "string", "utility", "helper"],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const { action, params } = input || {};
    if (!action) return { success: false, error: "No action specified." };

    try {
      switch (action) {
        case "add":
          return { success: true, output: (params.a || 0) + (params.b || 0) };
        case "subtract":
          return { success: true, output: (params.a || 0) - (params.b || 0) };
        case "multiply":
          return { success: true, output: (params.a || 0) * (params.b || 0) };
        case "divide":
          if (params.b === 0) return { success: false, error: "Division by zero." };
          return { success: true, output: (params.a || 0) / (params.b || 0) };
        case "uppercase":
          return { success: true, output: String(params.text || "").toUpperCase() };
        case "lowercase":
          return { success: true, output: String(params.text || "").toLowerCase() };
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (err) {
      return { success: false, error: `Tool execution error: ${err}` };
    }
  }
};