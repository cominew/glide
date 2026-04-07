// runtime/agent.ts
import path from 'path';
import fs from 'fs/promises';
import { watch } from 'fs';
import { pathToFileURL } from 'url';
import { EventEmitter } from 'events';

import { OllamaClient } from '../kernel/llm/ollama-client.js';
import { SkillRegistry } from '../kernel/registry.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import { Skill, SkillContext } from '../kernel/types.js';

export class Agent extends EventEmitter {
  private registry = new SkillRegistry();
  public  orchestrator: Orchestrator;
  private llm: OllamaClient;
  private sessionMemory = new Map<string, Record<string, any>>();

  constructor(private basePath: string) {
    super();
    this.llm          = new OllamaClient();
    this.orchestrator = new Orchestrator(this.registry, this.llm);
  }

  async init() {
    await this.loadSkills();
    this.watchSkills();
    console.log(`[Agent] 🚀 Ready — ${this.registry.listSkills().length} skills loaded`);
  }

  private async loadSkills() {
    const skillsDir = path.join(this.basePath, 'skills');
    let files: string[];
    try { files = await fs.readdir(skillsDir); }
    catch { console.warn('[Agent] skills/ directory not found'); return; }

    for (const file of files) {
      if (file.endsWith('.skill.ts') || file.endsWith('.skill.js'))
        await this.loadSkillFile(path.join(skillsDir, file));
    }
  }

  async loadSkillFile(filePath: string) {
    try {
      const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const mod = await import(url);
      const skill: Skill = mod.skill ?? mod.default;
      if (!skill?.name) { console.warn(`[Agent] Invalid skill: ${filePath}`); return; }
      this.registry.register(skill);
      console.log(`[Agent] ✅ Loaded: ${skill.name}`);
    } catch (err) {
      console.error(`[Agent] ❌ Failed to load ${filePath}:`, err);
    }
  }

  private watchSkills() {
    const skillsDir = path.join(this.basePath, 'skills');
    let debounce: NodeJS.Timeout;
    try {
      watch(skillsDir, (_, filename) => {
        if (!filename || (!filename.endsWith('.ts') && !filename.endsWith('.js'))) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log(`[Agent] 🔄 Hot-reloading: ${filename}`);
          this.loadSkillFile(path.join(skillsDir, filename));
        }, 300);
      });
    } catch {}
  }

  private getSessionMemory(sessionId: string) {
    if (!this.sessionMemory.has(sessionId)) this.sessionMemory.set(sessionId, {});
    return this.sessionMemory.get(sessionId)!;
  }

  private makeContext(userInput: string, sessionId: string): SkillContext {
    return {
      memory:        this.getSessionMemory(sessionId),
      logger:        console,
      llm:           this.llm,
      workspace:     this.basePath,
      originalQuery: userInput,
      sessionId,
    };
  }

  async getPlan(userInput: string, sessionId = 'default') {
    const plan = await this.orchestrator.getPlan(userInput);
    return (plan as any).steps ?? plan ?? [];
  }

  async executeSkill(skillName: string, params: Record<string, any> = {}, sessionId = 'default') {
    // FIX: registry.get() not registry.getSkill()
    const skill = this.registry.get(skillName);
    if (!skill) throw new Error(`Skill "${skillName}" not found`);

    const context = this.makeContext(params.query ?? '', sessionId);
    const result  = await skill.execute({ query: params.query ?? '', ...params }, context);
    this.emit('skill:after', skillName, result);
    return result;
  }

  async process(userInput: string, sessionId = 'default'): Promise<any> {
    return this.orchestrator.process(userInput, this.makeContext(userInput, sessionId));
  }

  async generateTempSkill(name: string, code: string): Promise<boolean> {
    const tempDir  = path.join(this.basePath, 'skills', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${name}.skill.ts`);
    await fs.writeFile(filePath, code, 'utf-8');
    await this.loadSkillFile(filePath);
    return true;
  }
}
