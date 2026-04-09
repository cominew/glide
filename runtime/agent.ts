// runtime/agent.ts — Event-Driven Agent
// agent.execute() fires events, agent.process() wraps for REST fallback.

import path from 'path';
import fs from 'fs/promises';
import { watch } from 'fs';
import { pathToFileURL } from 'url';
import { EventEmitter } from 'events';

import { OllamaClient } from '../kernel/llm/ollama-client';
import { SkillRegistry } from '../kernel/registry';
import { Orchestrator } from './orchestrator/orchestrator';
import { Skill, SkillContext } from '../kernel/types';

interface Turn { role: 'user'|'assistant'; content: string; ts: number; }

export class Agent extends EventEmitter {
  private registry      = new SkillRegistry();
  public  orchestrator: Orchestrator;
  private llm           = new OllamaClient();
  private sessions      = new Map<string, { history: Turn[]; memory: Record<string,unknown> }>();

  constructor(private basePath: string) {
    super();
    this.orchestrator = new Orchestrator(this.registry, this.llm);
  }

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
    for (const f of files)
      if (f.endsWith('.skill.ts') || f.endsWith('.skill.js'))
        await this.loadSkillFile(path.join(dir, f));
  }

  async loadSkillFile(filePath: string) {
    try {
      const mod  = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
      const skill: Skill = mod.skill ?? mod.default;
      if (!skill?.name) return;
      this.registry.register(skill);
      console.log(`[Agent] ✅ ${skill.name}`);
    } catch (err) { console.error(`[Agent] ❌ ${filePath}`, err); }
  }

  private watchSkills() {
    const dir = path.join(this.basePath, 'skills');
    let t: NodeJS.Timeout;
    try {
      watch(dir, (_, f) => {
        if (!f || (!f.endsWith('.ts') && !f.endsWith('.js'))) return;
        clearTimeout(t);
        t = setTimeout(() => this.loadSkillFile(path.join(dir, f!)), 300);
      });
    } catch {}
  }

  // ── Session ───────────────────────────────────────────────────────────────

  private session(id: string) {
    if (!this.sessions.has(id)) this.sessions.set(id, { history: [], memory: {} });
    return this.sessions.get(id)!;
  }

  clearHistory(id: string) {
    const s = this.session(id);
    s.history = []; s.memory = {};
    console.log(`[Agent] 🧹 Session cleared: ${id}`);
  }

  // ── execute() — event-driven, no return value ─────────────────────────────

  async execute(query: string, sessionId = 'default', taskId: string): Promise<void> {
    const s = this.session(sessionId);
    s.history.push({ role: 'user', content: query, ts: Date.now() });

    const context: SkillContext = {
      memory: {
        ...s.memory,
        history: s.history.slice(-10).map(t => ({ role: t.role, content: t.content })),
      },
      logger:        console,
      llm:           this.llm,
      workspace:     this.basePath,
      originalQuery: query,
      sessionId,
    };

    await this.orchestrator.execute(query, context, taskId);

    // We can't easily capture the answer here without listening to events,
    // but Agent.process() does that for the REST fallback.
  }

  // ── process() — REST fallback, wraps execute() ───────────────────────────

  async process(query: string, sessionId = 'default'): Promise<any> {
    const s = this.session(sessionId);
    s.history.push({ role: 'user', content: query, ts: Date.now() });

    const context: SkillContext = {
      memory: {
        ...s.memory,
        history: s.history.slice(-10).map(t => ({ role: t.role, content: t.content })),
      },
      logger:        console,
      llm:           this.llm,
      workspace:     this.basePath,
      originalQuery: query,
      sessionId,
    };

    const result = await this.orchestrator.process(query, context);

    const answer = result?.output?.text ?? '';
    if (answer) s.history.push({ role: 'assistant', content: answer, ts: Date.now() });
    return result;
  }

  async generateTempSkill(name: string, code: string) {
    const dir = path.join(this.basePath, 'skills', 'temp');
    await fs.mkdir(dir, { recursive: true });
    const fp = path.join(dir, `${name}.skill.ts`);
    await fs.writeFile(fp, code, 'utf-8');
    await this.loadSkillFile(fp);
    return true;
  }
}
