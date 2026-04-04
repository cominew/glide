import path from 'path';
import fs from 'fs/promises';
import { watch } from 'fs';  // 用于动态监控
import { pathToFileURL } from 'url';
import { OpenClawKernel } from '../kernel/openclaw-kernel.js';
import { OllamaClient } from '../llm/ollama-client.js';
import { Skill, SkillContext, SkillResult } from './types.js';
import { SkillRegistry } from './registry.js';
import { Orchestrator } from './orchestrator.js';

export class Agent {
  private orchestrator: Orchestrator;
  private kernel: OpenClawKernel;
  private llm: OllamaClient;
  private registry: SkillRegistry;
  private sessionMemory: Map<string, any> = new Map();

  constructor(private basePath: string) {
    this.registry = new SkillRegistry();
    this.llm = new OllamaClient();
    this.orchestrator = new Orchestrator(this.registry, this.llm);
    this.kernel = new OpenClawKernel(basePath);
  }

  async init() {
    await this.kernel.init();
    await this.loadSkills();
    this.watchSkillsDirectory();
    console.log(`[Agent] 🚀 Ready. ${this.registry.listSkills().length} skills active.`);
  }

  private async loadSkills() {
    const skillsDir = path.join(this.basePath, 'workspace', 'skills');
    try {
      const files = await fs.readdir(skillsDir);
      for (const file of files) {
        if (file.endsWith('.skill.ts') || file.endsWith('.skill.js')) {
          try {
            const fullPath = path.resolve(skillsDir, file);
            const module = await import(pathToFileURL(fullPath).href);
            const skill: Skill = module.skill;
            if (skill && skill.name && skill.description) {
              this.registry.register(skill);
            } else {
              console.warn(`[Agent] ⚠️ Skill in ${file} missing name/description.`);
            }
          } catch (skillErr) {
            console.error(`[Agent] ❌ Failed to load skill ${file}:`, skillErr);
          }
        }
      }
    } catch (err) {
      console.error("[Agent] Critical error reading skills directory:", err);
    }
  }

  private watchSkillsDirectory() {
    const skillsDir = path.join(this.basePath, 'workspace', 'skills');
    let timer: NodeJS.Timeout;
    watch(skillsDir, (eventType, filename) => {
      if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          console.log(`[Agent] Detected change: ${filename}, reloading...`);
          this.loadSkillFromPath(path.join(skillsDir, filename));
        }, 500);
      }
    });
  }

  async process(userInput: string, sessionId: string = 'default'): Promise<any> {
    const kCtx = this.kernel.getContext();
    const context: SkillContext = {
      memory: this.getSessionMemory(sessionId),
      kernel: this.kernel,
      logger: kCtx.logger || console,
      llm: this.llm,
      workspace: path.join(this.basePath, 'workspace'),
      originalQuery: userInput,
      sessionId,
    };
    return await this.orchestrator.process(userInput, context);
  }

  private getSessionMemory(sessionId: string): any {
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, {});
    }
    return this.sessionMemory.get(sessionId);
  }

  async loadSkillFromPath(filePath: string): Promise<void> {
    try {
      const module = await import(pathToFileURL(filePath).href);
      const skill: Skill = module.skill;
      if (skill && skill.name && skill.description) {
        this.registry.register(skill);
        console.log(`[Agent] Dynamically loaded skill: ${skill.name}`);
      }
    } catch (err) {
      console.error(`Failed to load skill from ${filePath}:`, err);
    }
  }

  async generateTempSkill(name: string, description: string, code: string): Promise<boolean> {
    const tempDir = path.join(this.basePath, 'workspace', 'skills', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${name}.skill.ts`);
    await fs.writeFile(filePath, code, 'utf-8');
    await this.loadSkillFromPath(filePath);
    return true;
  }
}