// runtime/orchestrator/orchestrator.ts

import { SkillRegistry } from '../../kernel/registry.js';
import { SkillContext, SkillResult } from '../../kernel/types.js';
import { OllamaClient } from '../../kernel/llm/ollama-client.js';
import { Aggregator } from './aggregator.js';
import { safeJsonParse } from '../utils/safe-json.js';

interface SkillStep {
  skill:  string;
  params: Record<string, any>;
}

interface TimelineStep {
  skill: string; input: any; output: any; duration: number;
  thoughtBefore?: string; thoughtAfter?: string;
}

export interface ExecutionTimeline {
  thinking: string;
  plan:     { steps: SkillStep[]; raw: string };
  steps:    TimelineStep[];
  finalAnswer: string;
}

// Current date injected into all prompts so LLM knows "last month" etc.
function currentDateContext(): string {
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const prev = now.getMonth() === 0
    ? `${yyyy - 1}-12`
    : `${yyyy}-${String(now.getMonth()).padStart(2, '0')}`;
  return `Today is ${yyyy}-${mm}-${String(now.getDate()).padStart(2, '0')}. Current month: ${yyyy}-${mm}. Last month: ${prev}.`;
}

export class Orchestrator {
  private aggregator: Aggregator;

  constructor(private registry: SkillRegistry, private llm: OllamaClient) {
    this.aggregator = new Aggregator(llm);
  }

  public async getPlan(userInput: string) {
    return this.plan(userInput);
  }

  async process(query: string, context: SkillContext): Promise<any> {
    const timeline: ExecutionTimeline = {
      thinking: '', plan: { steps: [], raw: '' }, steps: [], finalAnswer: '',
    };

    // Phase 0: Think
    try {
      timeline.thinking = await this.think(query);
      console.log('[Orchestrator] Thinking:', timeline.thinking.slice(0, 80) + '...');
    } catch (err) {
      console.warn('[Orchestrator] Thinking skipped:', err);
    }

    // Phase 1: Plan
    let steps: SkillStep[] = [];
    try {
      const r = await this.plan(query);
      steps = r.steps;
      timeline.plan = { steps, raw: r.raw };
    } catch (err) {
      console.error('[Orchestrator] Planning failed:', err);
    }
    console.log('[Orchestrator] Plan steps:', steps);

    if (!steps.length) {
      const answer = await this.directAnswer(query);
      timeline.finalAnswer = answer;
      return this.formatResult(answer, [], [], timeline);
    }

    // Phase 2: Execute skills
    const usedSkills: string[] = [];
    const observations: any[]  = [];

    await Promise.all(steps.map(async (step) => {
      const skill = this.registry.get(step.skill);
      if (!skill) { console.warn(`[Orchestrator] Unknown skill: ${step.skill}`); return; }

      usedSkills.push(step.skill);
      const params = step.params && typeof step.params === 'object' ? step.params : {};
      const thoughtBefore = `Executing "${step.skill}"` +
        (Object.keys(params).length ? ` with ${JSON.stringify(params)}` : '');

      const start = Date.now();
      let result: SkillResult;
      try { result = await skill.execute({ query, ...params }, context); }
      catch (err) { result = { success: false, error: String(err) }; }
      const duration = Date.now() - start;

      const output     = result.success ? result.output : { error: result.error };
      const outputType = output?.type ?? (result.success ? 'success' : 'error');
      console.log(`[Orchestrator] Executed ${step.skill} (${duration}ms): ${outputType}`);
      observations.push(output);
      timeline.steps.push({
        skill: step.skill, input: params, output, duration,
        thoughtBefore,
        thoughtAfter: `"${step.skill}" completed in ${duration}ms → ${outputType}`,
      });
    }));

    // Phase 3: Aggregate
    const answer = await this.aggregator.aggregate(query, observations, context);
    timeline.finalAnswer = answer;
    timeline.steps.push({
      skill: 'aggregator', input: { count: observations.length },
      output: { summary: answer.slice(0, 80) }, duration: 0,
      thoughtBefore: `Synthesising ${observations.length} result(s)`,
      thoughtAfter:  'Aggregation complete',
    });

    return this.formatResult(answer, usedSkills, observations, timeline);
  }

  // ── Think ─────────────────────────────────────────────────────────────────

  private async think(query: string): Promise<string> {
    const skillNames = this.registry.listSkills().map(s => s.name).join(', ');
    const prompt =
      `${currentDateContext()}\n\n` +
      `You are Glide, an intelligent business AI with tools: ${skillNames}.\n` +
      `User request: "${query}"\n\n` +
      `Write a brief internal reasoning paragraph (3-5 sentences, first person) covering:\n` +
      `- What the user really wants\n` +
      `- What data you need and which tools you'll use\n` +
      `- Any ambiguities (e.g. exact date range, which customer)\n\n` +
      `Plain prose only. No bullet points. No JSON.`;
    return (await this.llm.generate(prompt))?.trim() ?? '';
  }

  // ── Plan ──────────────────────────────────────────────────────────────────

  private async plan(query: string): Promise<{ steps: SkillStep[]; raw: string }> {
    // Fast-path: "top N clients in/from PLACE"
    const topPlaceMatch = query.match(/top\s+(\d+)?\s*clients?\s+(?:in|from)\s+([a-z\s]+?)(?:\s*$|\?)/i);
    if (topPlaceMatch) {
      const limit = Number(topPlaceMatch[1] ?? 10);
      const place = topPlaceMatch[2].trim();
      return { steps: [{ skill: 'customer', params: { country: place, limit } }], raw: '' };
    }

    const skillList = this.registry.listSkills().map(s => `- ${s.name}: ${s.description}`).join('\n');
    const prompt =
      `${currentDateContext()}\n\n` +
      `You are an AI execution planner.\n\n` +
      `Available skills:\n${skillList}\n\n` +
      `User query: "${query}"\n\n` +
      `RULES:\n` +
      `- ALWAYS include "params" key (use {} if no params needed)\n` +
      `- Contact/profile/recent activity/activities → "customer" + "sales"\n` +
      `- City/state/region filter (e.g. "from California", "from London") → "customer" with city or state param\n` +
      `- Country filter → "customer" with country param\n` +
      `- Revenue/rankings/reports → "sales"\n` +
      `- "last month" means ${currentDateContext().match(/Last month: (\S+)/)?.[1]} — use as dateRange\n` +
      `- Docs/features/"what is"/"how to" → "knowledge_retrieval"\n\n` +
      `EXAMPLES:\n` +
      `"show Adam profile" → {"steps":[{"skill":"customer","params":{"name":"Adam"}},{"skill":"sales","params":{"customerName":"Adam"}}]}\n` +
      `"clients from Germany" → {"steps":[{"skill":"customer","params":{"country":"Germany"}}]}\n` +
      `"any client from California" → {"steps":[{"skill":"customer","params":{"state":"California"}}]}\n` +
      `"clients from London" → {"steps":[{"skill":"customer","params":{"city":"London"}}]}\n` +
      `"top 5 customers" → {"steps":[{"skill":"sales","params":{"action":"top_customers","limit":5}}]}\n` +
      `"sales report last month" → {"steps":[{"skill":"sales","params":{"dateRange":"${currentDateContext().match(/Last month: (\S+)/)?.[1]}"}}]}\n` +
      `"what is RosCard?" → {"steps":[{"skill":"knowledge_retrieval","params":{"query":"RosCard"}}]}\n\n` +
      `Respond ONLY with valid JSON, no markdown.`;

    const raw = await this.llm.generate(prompt);
    console.log('[Orchestrator] Plan raw:', raw);

    let parsed: any;
    try { parsed = safeJsonParse(raw); }
    catch {
      const m = raw.match(/"skill"\s*:\s*"([^"]+)"/);
      if (m && this.registry.get(m[1])) parsed = { steps: [{ skill: m[1], params: {} }] };
    }

    if (!Array.isArray(parsed?.steps)) {
      // Keyword fallbacks
      if (/detail|profile|contact|recent activit/i.test(query))
        return { steps: [{ skill: 'customer', params: { name: query } }, { skill: 'sales', params: { customerName: query } }], raw };
      if (/feature|how to|what is|integrate/i.test(query))
        return { steps: [{ skill: 'knowledge_retrieval', params: { query } }], raw };
      throw new Error('Plan missing steps array');
    }

    const steps: SkillStep[] = parsed.steps.map((s: any) => ({
      skill:  String(s.skill ?? ''),
      params: s.params && typeof s.params === 'object' ? s.params : {},
    }));

    return { steps, raw };
  }

  private async directAnswer(query: string): Promise<string> {
    try { return await this.llm.generate(`${currentDateContext()}\n\nAnswer helpfully: "${query}"`); }
    catch { return "I'm sorry, I couldn't process that request right now."; }
  }

  private formatResult(text: string, usedSkills: string[], observations: any[], timeline: ExecutionTimeline) {
    return {
      output:   { type: 'ai', text: text?.trim() || 'Analysis complete.', observations },
      metadata: { usedSkills, timeline },
    };
  }
}
