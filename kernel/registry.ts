// kernel/registry.ts
import { Skill } from './types';

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  // 注册技能
  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  // 获取技能（推荐使用）
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name); // ✅ Map 正确用法
  }

  // 别名
  get(name: string): Skill | undefined {
    return this.getSkill(name);
  }

  // 返回所有技能
  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  listSkills(): Skill[] {
    return this.list();
  }
}