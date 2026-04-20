// runtime/execution/orchestrator.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Orchestrator (Execution Layer)
// Layer: RUNTIME — executes ONLY. No decisions. No proposals.
//
// Key fix: planPrompt now lists ALL registered skills with their
// descriptions, so the LLM can route correctly. Skill routing
// is done by name + description, not by hard-coded list.
// ─────────────────────────────────────────────────────────────

import { SkillRegistry }   from '../../kernel/registry.js';
import { SkillContext, SkillResult, SkillStep, Task } from '../../kernel/types.js';
import { OllamaClient }    from '../../kernel/llm/ollama-client.js';
import { Aggregator }      from './aggregator.js';
import { safeJsonParse }   from '../utils/safe-json.js';
import { EventBus, GlideEvent } from '../../kernel/event-bus/event-bus.js';

import path from 'path';
import fs   from 'fs';

function currentDateContext(): string {
  return `[DATE] ${new Date().toISOString().slice(0, 10)}`;
}

function loadIdentityContext(root: string): string {
  const file = path.join(root, 'constitution', 'identity.md');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf-8').slice(0, 300);
}

export class Orchestrator {

  private aggregator: Aggregator;
  private rootPath:   string;
  private processing = new Set<string>();

  constructor(
    private registry: SkillRegistry,
    private llm:      OllamaClient,
    private context:  SkillContext,
    private bus:      EventBus,
    rootPath?:        string,
  ) {
    this.aggregator = new Aggregator(llm);
    this.rootPath   = rootPath ?? process.cwd();

    console.log('[Orchestrator] Subscribing to task.executing...');

    this.bus.on('task.executing', (event: GlideEvent) => {
      const task = event.payload as Task;
      if (!task?.id) return;
      if (this.processing.has(task.id)) return;

      this.processing.add(task.id);
      console.log(`[Orchestrator] ▶ ${task.id} "${task.intent}"`);

      this.execute(task.intent, this.context, task.id)
        .catch(err => {
          console.error(`[Orchestrator] Error ${task.id}:`, err);
          this.emit('task.failed', { error: String(err) }, task.id);
        })
        .finally(() => this.processing.delete(task.id));
    });

    console.log('[Orchestrator] Subscription registered.');
  }

  // ── Core pipeline ─────────────────────────────────────────

  async execute(query: string, context: SkillContext, taskId: string): Promise<void> {
    const startTime = Date.now();

    this.emit('task.started', { query }, taskId);

    // ── THINK ───────────────────────────────────────────
    this.emit('thinking.start', { query }, taskId);
    let thinking = '';
    try {
      const prompt = `${loadIdentityContext(this.rootPath)}\n${currentDateContext()}\nUser: ${query}`;
      thinking = (await this.llm.generate(prompt))?.trim() ?? '';
    } catch {}
    this.emit('thinking.end', { thinking }, taskId);

    // ── PLAN — dynamic skill list from registry ───────────
    this.emit('planning.start', { query }, taskId);

    let steps: SkillStep[] = [];
    try {
      // Build skill catalog from registry — LLM sees real skill descriptions
      const skills = this.registry.list();
      const skillCatalog = skills.map(s =>
        `- ${s.name}: ${s.description}`
      ).join('\n');

      const planPrompt = skills.length > 0
        ? [
            `You are a business intelligence assistant with access to a customer database.`,
            ``,
            `Available skills:`,
            skillCatalog,
            ``,
            `Query: "${query}"`,
            ``,
            `Rules:`,
            `- Use the "customer" skill for any query about specific customers, people, profiles, contacts, orders, or customer data.`,
            `- Use the "sales" skill for aggregate sales reports, revenue analysis, top customers, country breakdowns.`,
            `- Use "knowledge_retrieval" for product info, documentation, general business questions.`,
            `- Use "reasoning" ONLY when no other skill applies and no specific data lookup is needed.`,
            ``,
            `Return ONLY valid JSON: {"steps":[{"skill":"name","params":{"query":"..."}}]}`,
            `If truly no skill is needed: {"steps":[]}`,
          ].join('\n')
        : `No skills available. Return {"steps":[]}`;

      const raw = await Promise.race<string>([
        this.llm.generate(planPrompt),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Plan timeout')), 90_000)
        ),
      ]);

      const parsed = safeJsonParse(raw);
      steps = Array.isArray(parsed?.steps) ? parsed.steps : [];

      // Post-process: ensure each step has a query param
      steps = steps.map(s => ({
        ...s,
        params: { query, ...(s.params ?? {}) },
      }));

    } catch (err) {
      console.warn('[Orchestrator] Planning failed, falling back:', err);
      steps = [];
    }

    this.emit('planning.end', { steps }, taskId);

    // ── FALLBACK: no skills → direct LLM ─────────────────
    if (!steps.length) {
      let answer = '';
      try { answer = await this.llm.generate(query) ?? ''; }
      catch { answer = 'Unable to generate a response.'; }
      this.emit('answer.end',     { answer }, taskId);
      this.emit('task.completed', { result: answer, duration: Date.now()-startTime }, taskId);
      return;
    }

    // ── EXECUTE skills ────────────────────────────────────
    const observations: any[] = [];
    const usedSkills: string[] = [];

    for (const step of steps) {
      const skill = this.registry.get(step.skill);
      if (!skill) {
        console.warn(`[Orchestrator] Skill not found: ${step.skill}`);
        this.emit('skill.error', { skill: step.skill, error: 'Skill not found' }, taskId);
        continue;
      }

      usedSkills.push(step.skill);
      this.emit('skill.start', { skill: step.skill }, taskId);

      try {
        const result: SkillResult = await skill.execute(
          { query, ...(step.params ?? {}) },
          context,
        );
        observations.push(result.output);
        this.emit('skill.end', { skill: step.skill, output: result.output, duration: 0 }, taskId);
      } catch (err) {
        console.error(`[Orchestrator] Skill ${step.skill} error:`, err);
        this.emit('skill.error', { skill: step.skill, error: String(err) }, taskId);
      }
    }

    // ── AGGREGATE ─────────────────────────────────────────
    let answer = '';
    try {
      answer = await this.aggregator.aggregate(query, observations, context);
    } catch (err) {
      answer = observations.map(o => typeof o === 'string' ? o : JSON.stringify(o)).join('\n');
    }

    this.emit('aggregation.end', { answer }, taskId);
    this.emit('answer.end',      { answer }, taskId);
    this.emit('task.completed',  { result: answer, usedSkills, duration: Date.now()-startTime }, taskId);
  }

  private emit(type: string, payload: any, taskId: string) {
    this.bus.emitEvent(type, { ...payload, taskId }, 'RUNTIME', taskId);
  }
}
