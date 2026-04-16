// runtime/execution/orchestrator.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Orchestrator (Execution Layer)
// Layer: RUNTIME — executes ONLY. No decisions. No proposals.
//
// Receives task.executing events from Dispatcher via EventBus.
// Runs the cognitive pipeline: think → plan → execute → aggregate.
// Emits results back through EventBus with source='RUNTIME'.
//
// Fix applied: deduplication guard prevents processing the same
// task twice when Dispatcher emits task.executing once but
// EventBus propagation causes multiple deliveries.
// ─────────────────────────────────────────────────────────────

import { SkillRegistry }   from '../../kernel/registry.js';
import { SkillContext, SkillResult, SkillStep, Task } from '../../kernel/types.js';
import { OllamaClient }    from '../../kernel/llm/ollama-client.js';
import { Aggregator }      from './aggregator.js';
import { safeJsonParse }   from '../utils/safe-json.js';
import { EventBus, GlideEvent } from '../../kernel/event-bus/event-bus.js';

import path from 'path';
import fs   from 'fs';

// ─────────────────────────────────────────────────────────────

function currentDateContext(): string {
  return `[DATE] ${new Date().toISOString().slice(0, 10)}`;
}

function loadIdentityContext(root: string): string {
  const file = path.join(root, 'constitution', 'identity.md');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf-8').slice(0, 300);
}

// ─────────────────────────────────────────────────────────────

export class Orchestrator {

  private aggregator:  Aggregator;
  private rootPath:    string;
  private processing = new Set<string>();   // dedup guard

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

      if (!task?.id) {
        console.error('[Orchestrator] task.executing received with no task in payload');
        return;
      }

      // Dedup: ignore if already processing this task
      if (this.processing.has(task.id)) {
        console.log(`[Orchestrator] Skipping duplicate task.executing for ${task.id}`);
        return;
      }

      this.processing.add(task.id);
      console.log(`[Orchestrator] ▶ Starting execution: ${task.id} "${task.intent}"`);

      this.execute(task.intent, this.context, task.id)
        .catch(err => {
          console.error(`[Orchestrator] Execution error for ${task.id}:`, err);
          this.emit('task.failed', { error: String(err), taskId: task.id }, task.id);
        })
        .finally(() => {
          this.processing.delete(task.id);
        });
    });

    console.log('[Orchestrator] Subscription registered.');
  }

  // ── Core execution pipeline ───────────────────────────────

  async execute(query: string, context: SkillContext, taskId: string): Promise<void> {
    const startTime = Date.now();

    this.emit('task.started', { query }, taskId);

    // ── THINK ─────────────────────────────────────────────
    this.emit('thinking.start', { query }, taskId);

    let thinking = '';
    try {
      const prompt =
        `${loadIdentityContext(this.rootPath)}\n` +
        `${currentDateContext()}\n` +
        `User: ${query}`;
      thinking = (await this.llm.generate(prompt))?.trim() ?? '';
    } catch (err) {
      console.warn('[Orchestrator] Thinking LLM failed:', err);
    }

    this.emit('thinking.end', { thinking }, taskId);

    // ── PLAN ──────────────────────────────────────────────
    this.emit('planning.start', { query }, taskId);

    let steps: SkillStep[] = [];
    try {
      const planPrompt =
        `You are a business assistant. Return a JSON object with a "steps" array.\n` +
        `Available skills: customer, sales, knowledge_retrieval.\n` +
        `Query: "${query}"\n` +
        `Return ONLY valid JSON: {"steps":[{"skill":"name","params":{}}]}\n` +
        `If no skill is needed, return: {"steps":[]}`;

      const raw = await Promise.race<string>([
        this.llm.generate(planPrompt),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Plan timeout')), 30_000)
        ),
      ]);

      const parsed = safeJsonParse(raw);
      steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    } catch (err) {
      console.warn('[Orchestrator] Planning failed, falling back to direct LLM:', err);
      steps = [];
    }

    this.emit('planning.end', { steps }, taskId);

    // ── FALLBACK: no skills → direct LLM answer ───────────
    if (!steps.length) {
      let answer = '';
      try {
        answer = await this.llm.generate(query) ?? '';
      } catch (err) {
        answer = 'Unable to generate response.';
        console.error('[Orchestrator] Fallback LLM failed:', err);
      }
      this.emit('answer.end',      { answer },   taskId);
      this.emit('task.completed',  { result: answer, duration: Date.now()-startTime }, taskId);
      return;
    }

    // ── EXECUTE skills ────────────────────────────────────
    const observations: any[]  = [];
    const usedSkills:   string[] = [];

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
        const errMsg = String(err);
        console.error(`[Orchestrator] Skill ${step.skill} error:`, err);
        this.emit('skill.error', { skill: step.skill, error: errMsg }, taskId);
      }
    }

    // ── AGGREGATE ─────────────────────────────────────────
    let answer = '';
    try {
      answer = await this.aggregator.aggregate(query, observations, context);
    } catch (err) {
      answer = observations.map(o => JSON.stringify(o)).join('\n');
      console.error('[Orchestrator] Aggregation failed:', err);
    }

    this.emit('aggregation.end', { answer },   taskId);
    this.emit('answer.end',      { answer },   taskId);
    this.emit('task.completed',  { result: answer, usedSkills, duration: Date.now()-startTime }, taskId);
  }

  // ── Event emitter helper ──────────────────────────────────
  // Always emits with source='RUNTIME' and trace.taskId set.

  private emit(type: string, payload: any, taskId: string) {
    this.bus.emitEvent(type, { ...payload, taskId }, 'RUNTIME', taskId);
  }
}
