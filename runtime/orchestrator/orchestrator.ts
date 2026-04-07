// runtime/orchestrator/orchestrator.ts
import { SkillRegistry } from '../../kernel/registry.js';
import { SkillContext, SkillResult } from '../../kernel/types.js';
import { OllamaClient } from '../../kernel/llm/ollama-client.js';
import { Aggregator } from './aggregator.js';
import { safeJsonParse } from '../utils/safe-json.js';

interface SkillStep {
  skill: string;
  params: Record<string, any>;
}

interface TimelineStep {
  skill: string;
  input: any;
  output: any;
  duration: number;
  thoughtBefore?: string;
  thoughtAfter?: string;
}

interface ExecutionTimeline {
  plan: { steps: SkillStep[]; raw: string };
  steps: TimelineStep[];
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
    const timeline: ExecutionTimeline = { plan: { steps: [], raw: '' }, steps: [], finalAnswer: '' };

    // Phase 1: Plan
    let steps: SkillStep[] = [];
    let planRaw = '';
    try {
      const planResult = await this.plan(query);
      steps = planResult.steps;
      planRaw = planResult.raw;
    } catch (err) {
      console.error('[Orchestrator] Planning failed:', err);
    }
    timeline.plan = { steps, raw: planRaw };

    if (!steps.length) {
      const answer = await this.directAnswer(query);
      timeline.finalAnswer = answer;
      return this.formatResult(answer, [], [], timeline);
    }

    // Phase 2: Execute skills
    const usedSkills: string[] = [];
    const observations: any[] = [];

    await Promise.all(
      steps.map(async (step) => {
        const skill = this.registry.get(step.skill);
        if (!skill) return;

        usedSkills.push(step.skill);
        const thoughtBefore = `Preparing to execute skill "${step.skill}" with params ${JSON.stringify(step.params)}`;

        const start = Date.now();
        let result: SkillResult;
        try {
          result = await skill.execute({ query, ...step.params }, context);
        } catch (err) {
          result = { success: false, error: String(err) };
        }
        const duration = Date.now() - start;
        const output = result.success ? result.output : { error: result.error };
        const outputType = result.success && output?.type ? output.type : (result.success ? 'success' : 'error');
        const thoughtAfter = `Executed skill "${step.skill}" in ${duration}ms, produced output type: ${outputType}`;

        observations.push(output);
        timeline.steps.push({
          skill: step.skill,
          input: step.params,
          output,
          duration,
          thoughtBefore,
          thoughtAfter,
        });
      })
    );

    // Phase 3: Aggregate
    const answer = await this.aggregator.aggregate(query, observations, context);
    timeline.finalAnswer = answer;

    // Add an aggregator step for UI display
    timeline.steps.push({
      skill: 'aggregator',
      input: observations,
      output: answer,
      duration: 0,
      thoughtBefore: `Aggregating ${observations.length} results`,
      thoughtAfter: `Aggregation completed`,
    });

    return this.formatResult(answer, usedSkills, observations, timeline);
  }

  private async plan(query: string): Promise<{ steps: SkillStep[]; raw: string }> {
  const skillList = this.registry.listSkills().map(s => `- ${s.name}: ${s.description}`).join('\n');
  const prompt = `You are an AI execution planner. Given a user query, decide which skills to call.

Available skills:
${skillList}

User query: "${query}"

RULES:
- For a person's contact details, recent activities, or profile: use BOTH "customer" AND "sales"
- For product features, documentation, "how to", "what is": use "knowledge_retrieval"
- For sales analytics, revenue, orders, rankings: use "sales"

EXAMPLES:
"show me Alex contact detail and recent activities" → {"steps":[{"skill":"customer","params":{"name":"Alex"}},{"skill":"sales","params":{"customerName":"Alex"}}]}
"list key features for Astrion remote" → {"steps":[{"skill":"knowledge_retrieval","params":{"query":"Astrion remote features"}}]}
"top 5 customers by revenue" → {"steps":[{"skill":"sales","params":{"action":"top_customers","limit":5}}]}

Respond ONLY with valid JSON, no markdown, no extra text.`;

  const countryTopMatch = query.match(/top\s+(\d+)?\s*clients?\s+in\s+(\w+)/i);
if (countryTopMatch) {
  const limit = countryTopMatch[1] ? parseInt(countryTopMatch[1]) : 5;
  const country = countryTopMatch[2];
  console.log(`[Orchestrator] Detected top clients in country: ${country}, limit ${limit}`);
  return { steps: [{ skill: 'customer', params: { country } }], raw: '' };
}
  const raw = await this.llm.generate(prompt);
  console.log('[Orchestrator] Plan raw:', raw);

  let parsed;
  try {
    parsed = safeJsonParse(raw);
  } catch (err) {
    console.warn('[Orchestrator] JSON parse failed, attempting regex extraction');
    // 尝试提取技能名
    const skillMatch = raw.match(/"skill"\s*:\s*"([^"]+)"/);
    if (skillMatch) {
      const skillName = skillMatch[1];
      if (this.registry.get(skillName)) {
        parsed = { steps: [{ skill: skillName, params: {} }] };
      }
    }
  }

  if (!parsed || !Array.isArray(parsed?.steps)) {
    // 回退：根据关键词猜测技能
    if (/who is|find|detail|profile|contact|recent activities/i.test(query)) {
      return { steps: [{ skill: 'customer', params: { name: query } }, { skill: 'sales', params: { customerName: query } }], raw };
    }
    if (/feature|how to|what is|integrate|key feature/i.test(query)) {
      return { steps: [{ skill: 'knowledge_retrieval', params: { query } }], raw };
    }
    throw new Error('Plan missing steps array');
  }
  return { steps: parsed.steps as SkillStep[], raw };
}

  private async directAnswer(query: string): Promise<string> {
    try {
      return await this.llm.generate(`Answer helpfully and concisely: "${query}"`);
    } catch {
      return "I'm sorry, I couldn't process that request right now.";
    }
  }

  private formatResult(text: string, usedSkills: string[], observations: any[], timeline: ExecutionTimeline) {
    return {
      output: { type: 'ai', text: text?.trim() || 'Analysis complete.', observations },
      metadata: { usedSkills, timeline },
    };
  }
}