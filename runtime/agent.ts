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

// ── Conversation turn ─────────────────────────────────────────────────────────

interface Turn { role: 'user' | 'assistant'; content: string; timestamp: number; }

const MAX_HISTORY = 20; // keep last 20 turns per session

export class Agent extends EventEmitter {
  private registry  = new SkillRegistry();
  public  orchestrator: Orchestrator;
  private llm       = new OllamaClient();

  // Per-session conversation history + KV memory
  private sessions  = new Map<string, { history: Turn[]; memory: Record<string, any> }>();

  constructor(private basePath: string) {
    super();
    this.orchestrator = new Orchestrator(this.registry, this.llm);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async init() {
    await this.loadSkills();
    this.watchSkills();
    console.log(`[Agent] 🚀 Ready — ${this.registry.listSkills().length} skills loaded`);
  }

  // ── Skill loading ─────────────────────────────────────────────────────────

  private async loadSkills() {
    const dir = path.join(this.basePath, 'skills');
    let files: string[];
    try { files = await fs.readdir(dir); }
    catch { console.warn('[Agent] skills/ not found'); return; }
    for (const f of files) {
      if (f.endsWith('.skill.ts') || f.endsWith('.skill.js'))
        await this.loadSkillFile(path.join(dir, f));
    }
  }

  async loadSkillFile(filePath: string) {
    try {
      const url  = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const mod  = await import(url);
      const skill: Skill = mod.skill ?? mod.default;
      if (!skill?.name) { console.warn(`[Agent] Invalid skill: ${filePath}`); return; }
      this.registry.register(skill);
      console.log(`[Agent] ✅ Loaded: ${skill.name}`);
    } catch (err) {
      console.error(`[Agent] ❌ Failed: ${filePath}`, err);
    }
  }

  private watchSkills() {
    const dir = path.join(this.basePath, 'skills');
    let debounce: NodeJS.Timeout;
    try {
      watch(dir, (_, filename) => {
        if (!filename || (!filename.endsWith('.ts') && !filename.endsWith('.js'))) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log(`[Agent] 🔄 Hot-reloading: ${filename}`);
          this.loadSkillFile(path.join(dir, filename));
        }, 300);
      });
    } catch {}
  }

  // ── Session management ────────────────────────────────────────────────────

  private getSession(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { history: [], memory: {} });
    }
    return this.sessions.get(sessionId)!;
  }

  /** Return last N turns as simple role/content pairs for LLM prompts */
  getHistory(sessionId: string, n = MAX_HISTORY): { role: string; content: string }[] {
    return this.getSession(sessionId).history
      .slice(-n)
      .map(t => ({ role: t.role, content: t.content }));
  }

  clearHistory(sessionId: string) {
    const s = this.getSession(sessionId);
    s.history = [];
    s.memory  = {};
    console.log(`[Agent] 🧹 Cleared session: ${sessionId}`);
  }

  // ── Process ───────────────────────────────────────────────────────────────

  async process(userInput: string, sessionId = 'default'): Promise<any> {
    const session = this.getSession(sessionId);

    // Add user turn to history
    session.history.push({ role: 'user', content: userInput, timestamp: Date.now() });
    if (session.history.length > MAX_HISTORY * 2) {
      session.history = session.history.slice(-MAX_HISTORY);
    }

    const context: SkillContext = {
      memory: {
        ...session.memory,
        // Pass conversation history to orchestrator/skills
        history: session.history.slice(-10).map(t => ({ role: t.role, content: t.content })),
      },
      logger:        console,
      llm:           this.llm,
      workspace:     this.basePath,
      originalQuery: userInput,
      sessionId,
    };

    const result = await this.orchestrator.process(userInput, context);

    // Add assistant response to history
    const answerText = result?.output?.text ?? '';
    if (answerText) {
      session.history.push({ role: 'assistant', content: answerText, timestamp: Date.now() });
    }

    return result;
  }

  // ── Helpers for http-server ───────────────────────────────────────────────

  async getPlan(userInput: string, sessionId = 'default') {
    const result = await this.orchestrator.getPlan(userInput);
    return result.steps ?? [];
  }

  async executeSkill(skillName: string, params: Record<string, any> = {}, sessionId = 'default') {
    const skill = this.registry.get(skillName);
    if (!skill) throw new Error(`Skill "${skillName}" not found`);
    const session = this.getSession(sessionId);
    const context: SkillContext = {
      memory: session.memory, logger: console, llm: this.llm,
      workspace: this.basePath, originalQuery: params.query ?? '', sessionId,
    };
    const result = await skill.execute({ query: params.query ?? '', ...params }, context);
    this.emit('skill:after', skillName, result);
    return result;
  }

  async generateTempSkill(name: string, code: string): Promise<boolean> {
    const dir = path.join(this.basePath, 'skills', 'temp');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.skill.ts`);
    await fs.writeFile(filePath, code, 'utf-8');
    await this.loadSkillFile(filePath);
    return true;
  }
}
