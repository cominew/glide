// workspace/skills/support.skill.ts – ESM V9
import { Skill, SkillContext, SkillResult } from "../../framework/core/types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE = path.resolve(__dirname, "..");

function loadJSON(relPath: string) {
  const full = path.join(WORKSPACE, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf-8"));
}

const tickets = loadJSON("indexes/support/support.json") || [];

export const skill: Skill = {
  name: "support",
  description: "Retrieve customer support tickets and status.",
  keywords: ["support", "ticket", "help", "issue", "problem", "customer service"],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const query = typeof input === "string" ? input : input.query;
    if (!query) return { success: false, error: "No input provided." };

    const lower = query.toLowerCase();
    const matches = tickets.filter((t: any) =>
      (t.customerName && t.customerName.toLowerCase().includes(lower)) ||
      (t.subject && t.subject.toLowerCase().includes(lower)) ||
      (t.ticketId && t.ticketId.toLowerCase().includes(lower))
    );

    if (matches.length === 0) return { success: false, error: `No support tickets found for "${query}".` };

    return { success: true, output: matches.slice(0, 10), metadata: { usedSkill: 'support' } };
  }
};