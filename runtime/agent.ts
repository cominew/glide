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
  private orchestrator: Orchestrator;
  private llm: OllamaClient;
  private sessionMemory = new Map<string, Record<string, any>>();

  constructor(private basePath: string) {
    super();
    this.llm = new OllamaClient();
    this.orchestrator = new Orchestrator(this.registry, this.llm);
  }

  // ── 初始化 ────────────────────────────────
  async init() {
    await this.loadSkills();
    this.watchSkills();
    console.log(`[Agent] 🚀 Ready — ${this.registry.listSkills().length} skills loaded`);
  }

  // ── Skills 加载 ──────────────────────────
  private async loadSkills() {
    const skillsDir = path.join(this.basePath, 'skills');
    let files: string[];

    try {
      files = await fs.readdir(skillsDir);
    } catch {
      console.warn('[Agent] skills/ directory not found, skipping skill load');
      return;
    }

    for (const file of files) {
      if (file.endsWith('.skill.ts') || file.endsWith('.skill.js')) {
        await this.loadSkillFile(path.join(skillsDir, file));
      }
    }
  }

  async loadSkillFile(filePath: string) {
    try {
      const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const mod = await import(url);
      const skill: Skill = mod.skill ?? mod.default;

      if (!skill?.name) {
        console.warn(`[Agent] Invalid skill (no name): ${filePath}`);
        return;
      }

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

  // ── Session Memory ─────────────────────────
  private getSessionMemory(sessionId: string) {
    if (!this.sessionMemory.has(sessionId)) this.sessionMemory.set(sessionId, {});
    return this.sessionMemory.get(sessionId)!;
  }

  // ── SSE / 流式接口所需 ────────────────────
  async getPlan(userInput: string, sessionId = 'default') {
    const context: SkillContext = {
      memory: this.getSessionMemory(sessionId),
      logger: console,
      llm: this.llm,
      workspace: this.basePath,
      originalQuery: userInput,
      sessionId,
    };

    const plan = await this.orchestrator.getPlan(userInput, context);

    // plan 是一个数组，每步包含 skill 和 params
    return plan.steps ?? [];
  }

  async executeSkill(skillName: string, params: Record<string, any> = {}) {
    const skill = this.registry.getSkill(skillName);
    if (!skill) throw new Error(`Skill "${skillName}" not found`);

    const result = await skill.execute(
  { query: params.query ?? '', ...params },  // input
  { memory: {}, llm: this.llm, logger: console, workspace: this.basePath, originalQuery: params.query ?? '', sessionId: 'default' }  // context
);
    // 触发事件给 WebSocket
    this.emit('skill:after', skillName, result);

    return result;
  }

  // ── 常规处理接口 ──────────────────────────
  async process(userInput: string, sessionId = 'default'): Promise<any> {
    const context: SkillContext = {
      memory: this.getSessionMemory(sessionId),
      logger: console,
      llm: this.llm,
      workspace: this.basePath,
      originalQuery: userInput,
      sessionId,
    };

    return this.orchestrator.process(userInput, context);
  }

  // ── 临时技能生成 ──────────────────────────
  async generateTempSkill(name: string, code: string): Promise<boolean> {
    const tempDir = path.join(this.basePath, 'skills', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${name}.skill.ts`);
    await fs.writeFile(filePath, code, 'utf-8');
    await this.loadSkillFile(filePath);
    return true;
  }
}