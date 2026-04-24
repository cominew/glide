// kernel/registry.ts

import { Skill } from './types.js';
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
    this.skills.set(skill.name, skill);

    for (const i of skill.inputs || []) {
      if (!this.byInput.has(i)) this.byInput.set(i, new Set());
      this.byInput.get(i)!.add(skill.name);
    }

    for (const o of skill.outputs || []) {
      if (!this.byOutput.has(o)) this.byOutput.set(o, new Set());
      this.byOutput.get(o)!.add(skill.name);
    }
  }

  get(name: string) {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

    matchCapabilities(facts: string[]): Skill[] {
    const matched = new Set<string>();
    for (const fact of facts) {
      const skillsForFact = this.byInput.get(fact);
      if (skillsForFact) {
        for (const name of skillsForFact) matched.add(name);
      }
    }
    return Array.from(matched).map(name => this.skills.get(name)!).filter(Boolean);
  }


  // =========================
  // 🌌 Capability Field
  // =========================

  /** inject new fact into field */
  injectFact(fact: string) {
    this.activeFacts.add(fact);
  }

  injectFacts(facts: string[]) {
    for (const f of facts) {
      this.activeFacts.add(f);
    }
  }

  getActiveFacts(): string[] {
    return Array.from(this.activeFacts);
  }

  clearField() {
    this.activeFacts.clear();
  }


  // =========================
  // 🔥 Emergent Activation
  // =========================

  activate(): Skill[] {
    const activated = new Set<string>();

    for (const fact of this.activeFacts) {
      const skills = this.byInput.get(fact);
      if (!skills) continue;

      for (const s of skills) {
        activated.add(s);
      }
    }

    return Array.from(activated)
      .map(n => this.skills.get(n))
      .filter(Boolean) as Skill[];
  }


  // =========================
  // topology insight
  // =========================

  getFieldConnections() {
    const edges: Array<{ from: string; to: string }> = [];

    for (const skill of this.skills.values()) {
      for (const output of skill.outputs || []) {
        const consumers = this.byInput.get(output);
        if (!consumers) continue;

        for (const c of consumers) {
          edges.push({ from: skill.name, to: c });
        }
      }
    }

    return edges;
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

        const skill = Object.values(imported).find(
          v => v && typeof v === 'object' && 'name' in v
        ) as Skill;

        if (skill) {
          this.register(skill);
        }

      } catch (e) {
        console.error(`[SkillRegistry] load fail`, file, e);
      }
    }
  }
}