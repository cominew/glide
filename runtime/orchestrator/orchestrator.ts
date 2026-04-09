// runtime/orchestrator/orchestrator.ts
//
// Streaming Cognitive Architecture.
// Orchestrator does NOT return results — it EMITS events.
// Every phase produces events immediately so the frontend sees progress in real time.

import { SkillRegistry } from '../../kernel/registry';
import { SkillContext, SkillResult } from '../../kernel/types';
import { OllamaClient } from '../../kernel/llm/ollama-client';
import { Aggregator } from './aggregator';
import { safeJsonParse } from '../utils/safe-json';
import { globalEventBus } from '../../kernel/event-bus';
import type { EmitFn, SkillStep } from '../../kernel/event-types';
import crypto from 'crypto'; 

// ── Abbreviation expansion ────────────────────────────────────────────────────

const ABBREV: Record<string, { type: 'city'|'state'|'country'; full: string }> = {
  'la':  { type: 'city',    full: 'Los Angeles' },
  'nyc': { type: 'city',    full: 'New York' },
  'sf':  { type: 'city',    full: 'San Francisco' },
  'dc':  { type: 'city',    full: 'Washington DC' },
  'ca':  { type: 'state',   full: 'California' },
  'tx':  { type: 'state',   full: 'Texas' },
  'fl':  { type: 'state',   full: 'Florida' },
  'ny':  { type: 'state',   full: 'New York' },
  'wa':  { type: 'state',   full: 'Washington' },
  'nv':  { type: 'state',   full: 'Nevada' },
  'az':  { type: 'state',   full: 'Arizona' },
  'il':  { type: 'state',   full: 'Illinois' },
  'uk':  { type: 'country', full: 'United Kingdom' },
  'usa': { type: 'country', full: 'United States' },
  'uae': { type: 'country', full: 'United Arab Emirates' },
};

function expandAbbreviations(q: string): string {
  return q.replace(/\b([a-z]{2,3})\b/gi, (m) => ABBREV[m.toLowerCase()]?.full ?? m);
}

function currentDateContext(): string {
  const now    = new Date();
  const yyyy   = now.getFullYear();
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const prevMm = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYy = now.getMonth() === 0 ? yyyy - 1 : yyyy;
  const last   = `${prevYy}-${String(prevMm).padStart(2, '0')}`;
  return `[DATE] Today: ${yyyy}-${mm}-${String(now.getDate()).padStart(2,'0')}. Current month: ${yyyy}-${mm}. Last month: ${last}.`;
}

function normaliseDateRange(raw: string): string {
  return raw.replace(/[^0-9-]/g, '').slice(0, 7);
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class Orchestrator {
  private aggregator: Aggregator;

  constructor(
    private registry: SkillRegistry,
    private llm:      OllamaClient,
  ) {
    this.aggregator = new Aggregator(llm);
  }

  public async getPlan(query: string) { return this.plan(query, []); }

  // ── execute() — the new entry point. No return value. Only events. ─────────

  async execute(
    query:     string,
    context:   SkillContext,
    taskId:    string,
    emit?:     EmitFn,
  ): Promise<void> {

    // Use globalEventBus if no custom emit provided
    const fire: EmitFn = emit ?? ((type, payload, tid) =>
      globalEventBus.emitEvent(type, payload, tid)
    );

    const history: {role:string; content:string}[] = context.memory?.history ?? [];
    const startTime = Date.now();

    fire('task:start', { query, sessionId: context.sessionId ?? 'default' }, taskId);
    globalEventBus.startHeartbeat(taskId, 'starting');

    // ── Phase 0: Expand abbreviations ───────────────────────────────────────
    const expanded = expandAbbreviations(query);
    if (expanded !== query) {
      console.log(`[Orchestrator] Expanded: "${query}" → "${expanded}"`);
      fire('log', { level: 'info', message: `Expanded: "${query}" → "${expanded}"` }, taskId);
    }

    // ── Phase 1: Think ───────────────────────────────────────────────────────
    fire('thinking:start', { query: expanded }, taskId);
    globalEventBus.updateHeartbeatPhase(taskId, 'thinking');

    let thinking = '';
    try {
      thinking = await this.think(expanded, history);
      fire('thinking:end', { thinking }, taskId);
      console.log('[Orchestrator] Thinking:', thinking.slice(0, 80) + '...');
    } catch {
      fire('thinking:end', { thinking: '' }, taskId);
    }

    // ── Phase 2: Plan ────────────────────────────────────────────────────────
    fire('planning:start', { query: expanded }, taskId);
    globalEventBus.updateHeartbeatPhase(taskId, 'planning');

    let steps: SkillStep[] = [];
    let planRaw = '';
    try {
      const r = await this.plan(expanded, history);
      steps   = r.steps;
      planRaw = r.raw;
      fire('planning:end', { steps, raw: planRaw }, taskId);
      console.log('[Orchestrator] Plan steps:', steps);
    } catch (err) {
      console.error('[Orchestrator] Planning failed:', err);
      fire('planning:end', { steps: [], raw: '' }, taskId);
    }

    if (!steps.length) {
      const answer = await this.directAnswer(expanded, history);
      fire('answer:end', { answer, observations: [] }, taskId);
      globalEventBus.stopHeartbeat(taskId);
      fire('task:end', { duration: Date.now() - startTime, usedSkills: [] }, taskId);
      return;
    }

    // ── Phase 3: Execute skills (parallel) ──────────────────────────────────
    globalEventBus.updateHeartbeatPhase(taskId, 'executing');

    const usedSkills:   string[]  = [];
    const observations: unknown[] = [];

    await Promise.all(steps.map(async (step) => {
      const skill = this.registry.get(step.skill);
      if (!skill) {
        console.warn(`[Orchestrator] Unknown skill: ${step.skill}`);
        fire('skill:error', { skill: step.skill, error: 'Skill not found', duration: 0 }, taskId);
        return;
      }

      usedSkills.push(step.skill);
      const params = step.params && typeof step.params === 'object' ? step.params : {};

      // Normalise dateRange before hitting the skill
      const cleanParams = { ...params } as Record<string, unknown>;
      if (typeof cleanParams.dateRange === 'string') {
        cleanParams.dateRange = normaliseDateRange(cleanParams.dateRange);
      }

      fire('skill:start', { skill: step.skill, params: cleanParams }, taskId);

      const t0 = Date.now();
      let result: SkillResult;
      try {
        result = await skill.execute({ query: expanded, ...cleanParams }, context);
      } catch (err) {
        result = { success: false, error: String(err) };
      }
      const duration  = Date.now() - t0;
      const output    = result.success ? result.output : { error: result.error };
      const outputType = (output as any)?.type ?? (result.success ? 'success' : 'error');

      observations.push(output);
      console.log(`[Orchestrator] Executed ${step.skill} (${duration}ms): ${outputType}`);
      fire('skill:end', { skill: step.skill, output, duration, outputType }, taskId);
    }));

    // ── Phase 4: Aggregate ───────────────────────────────────────────────────
    fire('aggregation:start', { observationCount: observations.length }, taskId);
    globalEventBus.updateHeartbeatPhase(taskId, 'aggregating');

    const answer = await this.aggregator.aggregate(expanded, observations as any[], context);

    fire('aggregation:end', { summary: answer.slice(0, 100) }, taskId);
    fire('answer:end', { answer, observations }, taskId);

    globalEventBus.stopHeartbeat(taskId);
    fire('task:end', { duration: Date.now() - startTime, usedSkills }, taskId);

    console.log(`[Orchestrator] Task ${taskId} done in ${Date.now() - startTime}ms`);
  }

  // ── process() — legacy compatibility wrapper (still works for REST fallback) 

  async process(query: string, context: SkillContext): Promise<any> {
    return new Promise((resolve, reject) => {
      const taskId = `rest-${Date.now()}`;
      const history = context.memory?.history ?? [];

      // Accumulate events into a result object
      const usedSkills:   string[]  = [];
      const observations: unknown[] = [];
      const timeline: any = {
        thinking: '', plan: { steps: [], raw: '' }, steps: [], finalAnswer: '',
      };

      const handler = (e: any) => {
        switch (e.type) {
          case 'thinking:end':
            timeline.thinking = e.payload.thinking; break;
          case 'planning:end':
            timeline.plan = { steps: e.payload.steps, raw: e.payload.raw ?? '' }; break;
          case 'skill:end':
            usedSkills.push(e.payload.skill);
            observations.push(e.payload.output);
            timeline.steps.push({
              skill: e.payload.skill, input: {}, output: e.payload.output,
              duration: e.payload.duration, outputType: e.payload.outputType,
            });
            break;
          case 'answer:end':
            timeline.finalAnswer = e.payload.answer;
            globalEventBus.offAny(handler);
            resolve({
              output:   { type: 'ai', text: e.payload.answer, observations },
              metadata: { usedSkills, timeline },
            });
            break;
          case 'task:error':
            globalEventBus.offAny(handler);
            reject(new Error(e.payload.error));
            break;
        }
      };

      globalEventBus.onAny(handler);
      this.execute(query, context, taskId).catch(err => {
        globalEventBus.offAny(handler);
        reject(err);
      });
    });
  }

  // ── Think ─────────────────────────────────────────────────────────────────

  private async think(query: string, history: {role:string;content:string}[]): Promise<string> {
    const names = this.registry.listSkills().map(s => s.name).join(', ');
    const h     = history.slice(-4).map(t => `${t.role}: ${t.content}`).join('\n');
    const prompt =
      `${currentDateContext()}\n\n` +
      `You are Glide, a business intelligence AI. Tools: ${names}.\n\n` +
      (h ? `Recent conversation:\n${h}\n\n` : '') +
      `User: "${query}"\n\n` +
      `Write 2-3 sentences of reasoning (first person). Which tool(s) and why. Plain prose only.`;
    return (await this.llm.generate(prompt))?.trim() ?? '';
  }

  // ── Plan ──────────────────────────────────────────────────────────────────

  private async plan(query: string, history: {role:string;content:string}[]): Promise<{ steps: SkillStep[]; raw: string }> {
    // Fast-path: date report
    const monthMatch = query.match(/\b(last\s+month|this\s+month)\b/i) || query.match(/\b(20\d{2}-\d{2})\b/);
    if (monthMatch && /report|revenue|sales/i.test(query)) {
      const ctx = currentDateContext();
      const last = ctx.match(/Last month: (\d{4}-\d{2})/)?.[1] ?? '';
      const curr = ctx.match(/Current month: (\d{4}-\d{2})/)?.[1] ?? '';
      const raw  = monthMatch[1];
      const dr   = /last/i.test(raw) ? last : /this/i.test(raw) ? curr : normaliseDateRange(raw);
      if (dr) return { steps: [{ skill: 'sales', params: { dateRange: dr } }], raw: '' };
    }

    // Fast-path: location
    const locMatch = query.match(/(?:from|in|clients?\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:\s*$|\?|,)/i);
    if (locMatch && !/profile|order|revenue|sales/i.test(query)) {
      const place = locMatch[1].trim();
      const plc   = place.toLowerCase();
      const stateList = ['california','texas','florida','new york','washington','nevada','arizona','illinois'];
      const cityList  = ['los angeles','new york','london','paris','berlin','sydney'];
      if (stateList.some(s => plc.includes(s)))
        return { steps: [{ skill: 'customer', params: { state: place } }], raw: '' };
      if (cityList.some(c => plc.includes(c)))
        return { steps: [{ skill: 'customer', params: { city: place } }], raw: '' };
      return { steps: [{ skill: 'customer', params: { country: place } }], raw: '' };
    }

    const dateCtx  = currentDateContext();
    const last     = dateCtx.match(/Last month: (\d{4}-\d{2})/)?.[1] ?? '';
    const skillList = this.registry.listSkills().map(s => `- ${s.name}: ${s.description}`).join('\n');
    const h        = history.slice(-4).map(t => `${t.role}: ${t.content}`).join('\n');

    const prompt =
      `${dateCtx}\n\nYou are an execution planner. Choose the minimum skills needed.\n\n` +
      `Skills:\n${skillList}\n\n` +
      (h ? `Context:\n${h}\n\n` : '') +
      `Query: "${query}"\n\n` +
      `RULES:\n` +
      `- params key always required (use {} if empty)\n` +
      `- dateRange: exactly "YYYY-MM" no trailing chars\n` +
      `- profile/activities → customer + sales(customerName only, NO dateRange)\n` +
      `- location → customer(country/city/state) only\n` +
      `- report → sales(dateRange: "${last}")\n` +
      `- docs/features → knowledge_retrieval\n\n` +
      `Examples:\n` +
      `"Adam profile" → [customer(name:Adam), sales(customerName:Adam)]\n` +
      `"from Germany" → [customer(country:Germany)]\n` +
      `"from London" → [customer(city:London)]\n` +
      `"last month" → [sales(dateRange:${last})]\n` +
      `"what is Astrion?" → [knowledge_retrieval(query:Astrion)]\n\n` +
      `JSON only: {"steps":[{"skill":"name","params":{}}]}`;

    const raw = await this.llm.generate(prompt);
    console.log('[Orchestrator] Plan raw:', raw);

    let parsed: any;
    try { parsed = safeJsonParse(raw); }
    catch {
      const m = raw.match(/"skill"\s*:\s*"([^"]+)"/);
      if (m && this.registry.get(m[1])) parsed = { steps: [{ skill: m[1], params: {} }] };
    }

    if (!Array.isArray(parsed?.steps)) {
      if (/detail|profile|contact|activit/i.test(query))
        return { steps: [{ skill:'customer', params:{name:query} }, { skill:'sales', params:{customerName:query} }], raw };
      if (/feature|how to|what is|integrate/i.test(query))
        return { steps: [{ skill:'knowledge_retrieval', params:{query} }], raw };
      throw new Error('No valid plan');
    }

    return {
      steps: parsed.steps.map((s: any) => ({
        skill:  String(s.skill ?? ''),
        params: s.params && typeof s.params === 'object' ? s.params : {},
      })),
      raw,
    };
  }

  private async directAnswer(query: string, history: {role:string;content:string}[]): Promise<string> {
    const h = history.slice(-4).map(t => `${t.role}: ${t.content}`).join('\n');
    try {
      return await this.llm.generate(`${currentDateContext()}\n${h ? `Context:\n${h}\n\n` : ''}Answer: "${query}"`);
    } catch { return "I couldn't process that right now."; }
  }
}
