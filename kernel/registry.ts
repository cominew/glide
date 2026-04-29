// kernel/registry.ts

import type { EmergenceSkill } from './types/skill.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export class SkillRegistry {

  private skills = new Map<string, EmergenceSkill>();

  // capability topology
  private byInput = new Map<string, Set<string>>();
  private byOutput = new Map<string, Set<string>>();

  // ⭐ Living Capability Field
  private activeFacts = new Set<string>();


  // =========================
  // Registration
  // =========================

  register(skill: EmergenceSkill) {
  this.skills.set(skill.id, skill);
}

get(name: string): EmergenceSkill | undefined {
  return this.skills.get(name);
}

list(): EmergenceSkill[] {
  return Array.from(this.skills.values());
}


  // =========================
  // Loader
  // =========================

  async loadAll(skillsDir: string) {

    if (!fs.existsSync(skillsDir)) {
      console.warn(`[SkillRegistry] directory missing`);
      return;
    }

    const files = fs.readdirSync(skillsDir)
      .filter(f => f.endsWith('.skill.ts'));

    for (const file of files) {

      try {
        const fileUrl =
          pathToFileURL(path.join(skillsDir, file)).href;

        const imported = await import(fileUrl);

        const skill =
        (imported.skill ?? imported.default) as EmergenceSkill | undefined;

        if (skill) {
          this.register(skill);
        }

      } catch (e) {
        console.error(`[SkillRegistry] load fail`, file, e);
      }
    }
  }
}