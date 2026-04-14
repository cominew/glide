// runtime/agent.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Agent
// The system entry point for external requests.
// Agent creates Tasks and hands them to Dispatcher.
// It does NOT call Orchestrator directly.
// It does NOT evaluate policy.
// ─────────────────────────────────────────────────────────────

import path            from 'path';
import fs              from 'fs/promises';
import { watch }       from 'fs';
import { pathToFileURL } from 'url';
import { EventEmitter } from 'events';

import { Skill, SkillContext, Task } from '../kernel/types';
import { SkillRegistry }             from '../kernel/registry';
import { OllamaClient }              from '../kernel/llm/ollama-client';
import { Dispatcher }                from '../dispatcher/dispatcher';
import { createTask }                from './tasks/task';

interface Turn { role: 'user' | 'assistant'; content: string; ts: number; }

export class Agent extends EventEmitter {

  private registry = new SkillRegistry();
  private llm      = new OllamaClient();
  private sessions = new Map<string, { history: Turn[]; memory: Record<string, unknown> }>();

  constructor(
    private basePath:   string,
    private dispatcher: Dispatcher,
  ) {
    super();
  }

  async init() {
    await this.loadSkills();
    this.watchSkills();
    console.log(`[Agent] 🚀 Ready — ${this.registry.listSkills().length} skills loaded`);
  }

  // ── Process an incoming user query ───────────────────────
  // Creates a Task, sends it to Dispatcher.
  // Returns the Task in its final state.

  async process(query: string, sessionId = 'default'): Promise<Task> {

    const s = this.session(sessionId);
    s.history.push({ role: 'user', content: query, ts: Date.now() });

    const task = createTask({
      type:      'human_request',
      intent:    query,
      source:    'agent',
      priority:  5,
      risk:      'low',
      sessionId,
      context: {
        history: s.history.slice(-10).map(t => ({
          role:    t.role,
          content: t.content,
        })),
        memory: s.memory,
      },
    });

    console.log(`[Agent] Dispatching task: ${task.id}`);

    // Hand off to Dispatcher — Agent's job ends here
    const result = await this.dispatcher.dispatch(task);

    if (result.result?.output?.text) {
      s.history.push({
        role:    'assistant',
        content: result.result.output.text,
        ts:      Date.now(),
      });
    }

    return result;
  }

  // ── Build skill context (for Orchestrator use) ────────────

  buildContext(sessionId: string, taskId: string): SkillContext {
    const s = this.session(sessionId);
    return {
      memory:        { ...s.memory, history: s.history.slice(-10) },
      logger:        console,
      llm:           this.llm,
      workspace:     this.basePath,
      originalQuery: '',
      sessionId,
      taskId,
    };
  }

  // ── Session management ────────────────────────────────────

  private session(id: string) {
    if (!this.sessions.has(id)) {
      this.sessions.set(id, { history: [], memory: {} });
    }
    return this.sessions.get(id)!;
  }

  clearHistory(sessionId: string) {
    const s = this.session(sessionId);
    s.history = [];
    s.memory  = {};
    console.log(`[Agent] 🧹 Session cleared: ${sessionId}`);
  }

  // ── Skill loading ─────────────────────────────────────────

  private async loadSkills() {
    const dir = path.join(this.basePath, 'skills');
    let files: string[];
    try { files = await fs.readdir(dir); }
    catch { console.warn('[Agent] skills/ not found'); return; }
    for (const f of files) {
      if (f.endsWith('.skill.ts') || f.endsWith('.skill.js')) {
        await this.loadSkillFile(path.join(dir, f));
      }
    }
  }

  async loadSkillFile(filePath: string) {
    try {
      const mod   = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
      const skill: Skill = mod.skill ?? mod.default;
      if (!skill?.name) return;
      this.registry.register(skill);
      console.log(`[Agent] ✅ ${skill.name}`);
    } catch (err) {
      console.error(`[Agent] ❌ ${filePath}`, err);
    }
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

  getRegistry(): SkillRegistry {
    return this.registry;
  }
}
