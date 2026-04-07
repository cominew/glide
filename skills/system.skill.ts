// workspace/skills/system.skill.ts – ESM V9
import { Skill, SkillContext, SkillResult } from "../../framework/core/types";
import os from "os";

export const skill: Skill = {
  name: "system",
  description: "Retrieve system information like OS, memory, CPU, and environment.",
  keywords: ["system", "info", "status", "os", "memory", "cpu", "environment"],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const info = {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
      },
      uptime: os.uptime(),
      hostname: os.hostname(),
    };
    return { success: true, output: info, metadata: { usedSkill: 'system' } };
  }
};
