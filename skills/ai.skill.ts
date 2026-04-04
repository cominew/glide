import { Skill, SkillContext, SkillResult } from "../../framework/core/types.js";

export const skill: Skill = {
  name: "ai",
  description: "General AI assistance using Ollama",
  keywords: ["ai", "assistant", "help", "hello", "hi", "greetings", "good morning", "good afternoon", "good evening", "how are you", "what can you do", "general"],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const query = typeof input === "string" ? input : input.query;
    if (!query) return { success: false, error: "No input provided." };

    if (context.llm) {
      try {
        const response = await context.llm.generate(query);
        return { success: true, output: response };
      } catch (err) {
        return { success: false, error: `LLM error: ${err}` };
      }
    } else {
      return { success: false, error: "No LLM available for AI skill." };
    }
  },
};