// kernel/registry.ts

import type { Skill } from './types/skill.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export class SkillRegistry {

  private skills = new Map<string, Skill>();

  // capability topology
  private byInput = new Map<string, Set<string>>();
  private byOutput = new Map<string, Set<string>>();

  // ⭐ Living Capability Field
  private activeFacts = new Set<string>();


  // =========================
  // Registration
  // =========================

register(skill: Skill) {
  if (this.skills.has(skill.name)) {
    console.warn(`[SkillRegistry] duplicate skill name: ${skill.name}`);
    return;
  }

  this.skills.set(skill.name, skill);

  console.log(`[SkillRegistry] registered skill: ${skill.name}`); 
}

get(name: string): Skill | undefined {
  return this.skills.get(name);
}

list(): Skill[] {
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
          imported.skill as Skill;

        if (skill) {
          this.register(skill);
        }

      } catch (e) {
        console.error(`[SkillRegistry] load fail`, file, e);
      }
    }
  }
}