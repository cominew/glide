import { Skill } from './types.js';

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}