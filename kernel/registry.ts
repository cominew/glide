// kernel/registry.ts
import { Skill } from './types.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';   // ⭐ 新增

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  async loadAll(skillsDir: string) {
    if (!fs.existsSync(skillsDir)) {
      console.warn(`[SkillRegistry] Skills directory not found: ${skillsDir}`);
      return;
    }

    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.skill.ts'));
    for (const file of files) {
      try {
        const modulePath = path.join(skillsDir, file);
        // ⭐ 将 Windows 路径转换为 file:// URL
        const fileUrl = pathToFileURL(modulePath).href;
        const imported = await import(fileUrl);
        const skill = Object.values(imported).find(v => v && typeof v === 'object' && 'name' in v) as Skill;
        if (skill) {
          this.register(skill);
        } else {
          console.warn(`[SkillRegistry] No valid skill export found in ${file}`);
        }
      } catch (err) {
        console.error(`[SkillRegistry] Failed to load ${file}:`, err);
      }
    }
  }
}