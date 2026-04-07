// runtime/orchestrator/orchestrator.ts

// Orchestrator class that manages the overall flow of processing a user query:
// 1. Think: Internal reasoning about the query and which skills to use.
// 2. Plan: Generate a structured plan of which skills to execute with what parameters.
// 3. Execute: Run each skill in parallel, collecting their outputs.
// 4. Aggregate: Synthesize the skill outputs into a final answer.

import { SkillRegistry } from '../../kernel/registry';
import { SkillContext, SkillResult } from '../../kernel/types';
import { OllamaClient } from '../../kernel/llm/ollama-client';
import { Aggregator } from './aggregator';
import { safeJsonParse } from '../utils/safe-json';

interface SkillStep {
  skill:  string;
  params: Record<string, any>;
}

interface TimelineStep {
  skill:          string;
  input:          any;
  output:         any;
  duration:       number;
  thoughtBefore?: string;
  thoughtAfter?:  string;
}

export interface ExecutionTimeline {
  thinking:    string;
  plan:        { steps: SkillStep[]; raw: string };
  steps:       TimelineStep[];
  finalAnswer: string;
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
      const planResult = await this.plan(query);
      steps = planResult.steps;
      timeline.plan = { steps, raw: planResult.raw };
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
    const usedSkills:   string[] = [];
    const observations: any[]    = [];

    await Promise.all(
      steps.map(async (step) => {
        const skill = this.registry.get(step.skill);
        if (!skill) {
          console.warn(`[Orchestrator] Unknown skill: ${step.skill}`);
          return;
        }

        usedSkills.push(step.skill);
        // ── FIX: guard against missing params ────────────────────────────────
        const params = step.params && typeof step.params === 'object' ? step.params : {};

        const thoughtBefore =
          `Executing "${step.skill}"` +
          (Object.keys(params).length ? ` with ${JSON.stringify(params)}` : '');

        const start = Date.now();
        let result: SkillResult;
        try {
          result = await skill.execute({ query, ...params }, context);
        } catch (err) {
          result = { success: false, error: String(err) };
        }
        const duration = Date.now() - start;

        const output     = result.success ? result.output : { error: result.error };
        const outputType = output?.type ?? (result.success ? 'success' : 'error');
        const thoughtAfter = `"${step.skill}" completed in ${duration}ms → ${outputType}`;

        console.log(`[Orchestrator] Executed ${step.skill} (${duration}ms): ${outputType}`);
        observations.push(output);
        timeline.steps.push({ skill: step.skill, input: params, output, duration, thoughtBefore, thoughtAfter });
      })
    );

    // Phase 3: Aggregate
    const answer = await this.aggregator.aggregate(query, observations, context);
    timeline.finalAnswer = answer;
    timeline.steps.push({
      skill: 'aggregator',
      input: { count: observations.length },
      output: { summary: answer.slice(0, 80) },
      duration: 0,
      thoughtBefore: `Synthesising ${observations.length} result(s)`,
      thoughtAfter:  'Aggregation complete',
    });

    return this.formatResult(answer, usedSkills, observations, timeline);
  }

  private async think(query: string): Promise<string> {
    const skillNames = this.registry.listSkills().map(s => s.name).join(', ');
    const prompt =
      `You are Glide, an intelligent business AI with tools: ${skillNames}.\n\n` +
      `User request: "${query}"\n\n` +
      `Write a brief internal reasoning paragraph (3-5 sentences, first person) covering:\n` +
      `- What the user really wants\n` +
      `- What data you need and which tools you'll use\n` +
      `- Any ambiguities you'll resolve\n\n` +
      `Plain prose only, no bullet points, no JSON.`;
    const raw = await this.llm.generate(prompt);
    return raw?.trim() ?? '';
  }

  private async plan(query: string): Promise<{ steps: SkillStep[]; raw: string }> {
    // Fast-path regex
    const countryMatch = query.match(/top\s+(\d+)?\s*clients?\s+(?:in|from)\s+(\w+)/i);
    if (countryMatch) {
      return {
        steps: [{ skill: 'customer', params: { country: countryMatch[2], limit: Number(countryMatch[1] ?? 5) } }],
        raw: '',
      };
    }

    const skillList = this.registry.listSkills().map(s => `- ${s.name}: ${s.description}`).join('\n');
    const prompt =
      `You are an AI execution planner.\n\n` +
      `Available skills:\n${skillList}\n\n` +
      `User query: "${query}"\n\n` +
      `RULES:\n` +
      `- Always include "params" key (can be empty object {})\n` +
      `- Contact/profile/recent activity → "customer" + "sales"\n` +
      `- Docs/features/"what is"/"how to" → "knowledge_retrieval"\n` +
      `- Revenue/rankings/reports → "sales"\n` +
      `- Support tickets → "support"\n\n` +
      `EXAMPLES:\n` +
      `"show Alex profile" → {"steps":[{"skill":"customer","params":{"name":"Alex"}},{"skill":"sales","params":{"customerName":"Alex"}}]}\n` +
      `"top 5 customers" → {"steps":[{"skill":"sales","params":{"action":"top_customers","limit":5}}]}\n` +
      `"sales report 2026-01" → {"steps":[{"skill":"sales","params":{"dateRange":"2026-01"}}]}\n` +
      `"what is RosCard?" → {"steps":[{"skill":"knowledge_retrieval","params":{"query":"RosCard"}}]}\n\n` +
      `Respond ONLY with valid JSON, no markdown.`;

    const raw = await this.llm.generate(prompt);
    console.log('[Orchestrator] Plan raw:', raw);

    let parsed: any;
    try {
      parsed = safeJsonParse(raw);
    } catch {
      const m = raw.match(/"skill"\s*:\s*"([^"]+)"/);
      if (m && this.registry.get(m[1])) {
        parsed = { steps: [{ skill: m[1], params: {} }] };
      }
    }

    if (!Array.isArray(parsed?.steps)) {
      if (/detail|profile|contact|recent activit/i.test(query))
        return { steps: [{ skill: 'customer', params: { name: query } }, { skill: 'sales', params: { customerName: query } }], raw };
      if (/feature|how to|what is|integrate/i.test(query))
        return { steps: [{ skill: 'knowledge_retrieval', params: { query } }], raw };
      throw new Error('Plan missing steps array');
    }

    // ── Ensure every step has a params object ─────────────────────────────────
    const steps: SkillStep[] = parsed.steps.map((s: any) => ({
      skill:  String(s.skill ?? ''),
      params: s.params && typeof s.params === 'object' ? s.params : {},
    }));

    return { steps, raw };
  }

  private async directAnswer(query: string): Promise<string> {
    try { return await this.llm.generate(`Answer helpfully and concisely: "${query}"`); }
    catch { return "I'm sorry, I couldn't process that request right now."; }
  }

  private formatResult(text: string, usedSkills: string[], observations: any[], timeline: ExecutionTimeline) {
    return {
      output:   { type: 'ai', text: text?.trim() || 'Analysis complete.', observations },
      metadata: { usedSkills, timeline },
    };
  }
}
