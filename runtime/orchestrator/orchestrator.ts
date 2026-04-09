// runtime/orchestrator/orchestrator.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SkillRegistry } from '../../kernel/registry.js';
import { SkillContext, SkillResult } from '../../kernel/types.js';
import { OllamaClient } from '../../kernel/llm/ollama-client.js';
import { Aggregator } from './aggregator.js';
import { safeJsonParse } from '../utils/safe-json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

interface SkillStep { skill: string; params: Record<string, any>; }
interface TimelineStep {
  skill: string; input: any; output: any; duration: number;
  thoughtBefore?: string; thoughtAfter?: string;
}
export interface ExecutionTimeline {
  thinking: string;
  plan: { steps: SkillStep[]; raw: string };
  steps: TimelineStep[];
  finalAnswer: string;
}

// ── Known abbreviations ──────────────────────────────────────────────────────
const ABBREV: Record<string, { type: 'city'|'state'|'country'; full: string }> = {
  'la':  { type: 'city',  full: 'Los Angeles' },
  'nyc': { type: 'city',  full: 'New York' },
  'sf':  { type: 'city',  full: 'San Francisco' },
  'dc':  { type: 'city',  full: 'Washington DC' },
  'ca':  { type: 'state', full: 'California' },
  'tx':  { type: 'state', full: 'Texas' },
  'fl':  { type: 'state', full: 'Florida' },
  'ny':  { type: 'state', full: 'New York' },
  'wa':  { type: 'state', full: 'Washington' },
  'nv':  { type: 'state', full: 'Nevada' },
  'az':  { type: 'state', full: 'Arizona' },
  'or':  { type: 'state', full: 'Oregon' },
  'il':  { type: 'state', full: 'Illinois' },
  'uk':  { type: 'country', full: 'United Kingdom' },
  'usa': { type: 'country', full: 'United States' },
  'uae': { type: 'country', full: 'United Arab Emirates' },
};

const STATE_ALIASES: Record<string, string[]> = {
  california: ['california', 'ca'],
  texas: ['texas', 'tx'],
  florida: ['florida', 'fl'],
  'new york': ['new york', 'ny'],
  washington: ['washington', 'wa'],
  nevada: ['nevada', 'nv'],
  arizona: ['arizona', 'az'],
  oregon: ['oregon', 'or'],
  illinois: ['illinois', 'il'],
};

const CITY_ALIASES: Record<string, string[]> = {
  'los angeles': ['los angeles', 'la'],
  'new york': ['new york', 'nyc', 'ny'],
  'san francisco': ['san francisco', 'sf'],
  'las vegas': ['las vegas', 'lv'],
  london: ['london'],
  paris: ['paris'],
  berlin: ['berlin'],
};

function expandAbbreviations(query: string): string {
  return query.replace(/\b([a-z]{2,3})\b/gi, (match) => {
    const info = ABBREV[match.toLowerCase()];
    return info ? info.full : match;
  });
}

function currentDateContext(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prevMm = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYy = now.getMonth() === 0 ? yyyy - 1 : yyyy;
  const lastMonth = `${prevYy}-${String(prevMm).padStart(2, '0')}`;
  return `[DATE] Today: ${yyyy}-${mm}-${String(now.getDate()).padStart(2,'0')}. Current month: ${yyyy}-${mm}. Last month: ${lastMonth}.`;
}

function normaliseDateRange(raw: string): string {
  return raw.replace(/[^0-9-]/g, '').slice(0, 7);
}

export class Orchestrator {
  private aggregator: Aggregator;

  constructor(private registry: SkillRegistry, private llm: OllamaClient) {
    this.aggregator = new Aggregator(llm);
  }

  public async getPlan(userInput: string) { return this.plan(userInput, []); }

  // 在 Orchestrator 类中添加
async processStream(
  query: string,
  context: SkillContext,
  onEvent: (type: string, payload: any) => void
): Promise<string> {
  const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const tasksDir = path.join(PROJECT_ROOT, 'runtime', 'tasks');
  if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });

  const history: {role:string; content:string}[] = context.memory?.history ?? [];
  const expandedQuery = expandAbbreviations(query);
  if (expandedQuery !== query) console.log(`[Orchestrator] Expanded: "${query}" → "${expandedQuery}"`);

  const timeline: ExecutionTimeline = {
    thinking: '', plan: { steps: [], raw: '' }, steps: [], finalAnswer: '',
  };

  try {
    // Phase 0: Think
    let thinking = '';
    try {
      thinking = await this.think(expandedQuery, history);
      timeline.thinking = thinking;
      onEvent('thinking', { message: thinking, phase: 'planning' });
      console.log('[Orchestrator] Thinking:', thinking.slice(0, 80) + '...');
    } catch (err) {
      console.warn('[Orchestrator] Thinking skipped:', err);
    }

    // Phase 1: Plan
    let steps: SkillStep[] = [];
    try {
      const r = await this.plan(expandedQuery, history);
      steps = r.steps;
      timeline.plan = { steps, raw: r.raw };
      onEvent('planning', { steps, raw: r.raw });
    } catch (err) {
      console.error('[Orchestrator] Planning failed:', err);
    }
    console.log('[Orchestrator] Plan steps:', steps);

    // Auto‑complete full profile (same as process)
    const isFullProfile = /full profile|complete details|all information|detailed profile/i.test(query);
    if (isFullProfile && steps.some(s => s.skill === 'customer')) {
      const customerName = steps.find(s => s.skill === 'customer')?.params?.name || query;
      if (!steps.some(s => s.skill === 'sales')) steps.push({ skill: 'sales', params: { customerName } });
      if (!steps.some(s => s.skill === 'support')) steps.push({ skill: 'support', params: { customerName } });
      timeline.plan.steps = steps;
    }

    if (!steps.length) {
      const answer = await this.directAnswer(expandedQuery, history);
      timeline.finalAnswer = answer;
      onEvent('answer-end', { answer });
      await this.saveTask(taskId, expandedQuery, timeline, [], answer);
      return answer;
    }

    // Phase 2: Execute skills (with events)
    const usedSkills: string[] = [];
    const observations: any[] = [];

    for (const step of steps) {  // 注意：改为串行执行，以便逐个发送事件
      const skill = this.registry.get(step.skill);
      if (!skill) {
        console.warn(`[Orchestrator] Unknown skill: ${step.skill}`);
        continue;
      }

      usedSkills.push(step.skill);
      const params = step.params && typeof step.params === 'object' ? step.params : {};
      if (params.dateRange) {
        params.dateRange = normaliseDateRange(String(params.dateRange));
        console.log(`[Orchestrator] Normalised dateRange → "${params.dateRange}"`);
      }

      const thoughtBefore = `Executing "${step.skill}"` +
        (Object.keys(params).length ? ` with ${JSON.stringify(params)}` : '');
      onEvent('skill-start', { skill: step.skill, params, thoughtBefore });

      let result: SkillResult;
      let retries = 0;
      const maxRetries = 2;
      while (retries <= maxRetries) {
        const start = Date.now();
        try {
          result = await skill.execute({ query: expandedQuery, ...params }, context);
          const duration = Date.now() - start;
          const output = result.success ? result.output : { error: result.error };
          const outputType = output?.type ?? (result.success ? 'success' : 'error');
          console.log(`[Orchestrator] Executed ${step.skill} (${duration}ms): ${outputType}`);
          observations.push(output);
          timeline.steps.push({
            skill: step.skill, input: params, output, duration, thoughtBefore,
            thoughtAfter: `"${step.skill}" completed in ${duration}ms → ${outputType}`,
          });
          onEvent('skill-end', { skill: step.skill, output, duration, thoughtAfter: timeline.steps[timeline.steps.length-1].thoughtAfter });
          break;
        } catch (err) {
          retries++;
          if (retries > maxRetries) {
            result = { success: false, error: String(err) };
            const failureDir = path.join(PROJECT_ROOT, 'knowledge', 'failures');
            if (!fs.existsSync(failureDir)) fs.mkdirSync(failureDir, { recursive: true });
            const failureFile = path.join(failureDir, `${taskId}-${step.skill}.md`);
            const failureContent = `# Failure: ${step.skill}\n\n**Task**: ${taskId}\n**Query**: ${expandedQuery}\n**Error**: ${err}\n**Params**: ${JSON.stringify(params)}\n**Retries**: ${retries}\n`;
            fs.writeFileSync(failureFile, failureContent, 'utf-8');
            observations.push({ error: String(err) });
            timeline.steps.push({
              skill: step.skill, input: params, output: { error: String(err) }, duration: 0, thoughtBefore,
              thoughtAfter: `"${step.skill}" failed after ${retries} retries`,
            });
            onEvent('skill-end', { skill: step.skill, output: { error: String(err) }, duration: 0, thoughtAfter: `failed after ${retries} retries` });
            break;
          } else {
            console.log(`[Orchestrator] Retry ${retries} for ${step.skill}...`);
            await new Promise(resolve => setTimeout(resolve, 500 * retries));
          }
        }
      }
    }

    // Phase 3: Aggregate
    onEvent('aggregation-start', { count: observations.length });
    const answer = await this.aggregator.aggregate(expandedQuery, observations, context);
    timeline.finalAnswer = answer;
    timeline.steps.push({
      skill: 'aggregator', input: { count: observations.length },
      output: { summary: answer.slice(0, 80) }, duration: 0,
      thoughtBefore: `Synthesising ${observations.length} result(s)`,
      thoughtAfter: 'Aggregation complete',
    });
    onEvent('answer-end', { answer });

    await this.saveTask(taskId, expandedQuery, timeline, usedSkills, answer);
    return answer;
  } catch (err) {
    const failureDir = path.join(PROJECT_ROOT, 'knowledge', 'failures');
    if (!fs.existsSync(failureDir)) fs.mkdirSync(failureDir, { recursive: true });
    const failureFile = path.join(failureDir, `${taskId}-critical.md`);
    const failureContent = `# Critical Failure\n\n**Task**: ${taskId}\n**Query**: ${expandedQuery}\n**Error**: ${err}\n**Plan**: ${JSON.stringify(timeline.plan)}\n`;
    fs.writeFileSync(failureFile, failureContent, 'utf-8');
    onEvent('error', { message: String(err) });
    throw err;
  }
}

private async saveTask(taskId: string, query: string, timeline: ExecutionTimeline, usedSkills: string[], answer: string) {
  const tasksDir = path.join(PROJECT_ROOT, 'runtime', 'tasks');
  const taskFile = path.join(tasksDir, `${taskId}.json`);
  const taskRecord = { id: taskId, query, timestamp: Date.now(), timeline, usedSkills, finalAnswer: answer };
  fs.writeFileSync(taskFile, JSON.stringify(taskRecord, null, 2), 'utf-8');
}

  async process(query: string, context: SkillContext): Promise<any> {
    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const tasksDir = path.join(PROJECT_ROOT, 'runtime', 'tasks');
    if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });

    const history: {role:string; content:string}[] = context.memory?.history ?? [];

    const expandedQuery = expandAbbreviations(query);
    if (expandedQuery !== query) {
      console.log(`[Orchestrator] Expanded: "${query}" → "${expandedQuery}"`);
    }

    const timeline: ExecutionTimeline = {
      thinking: '', plan: { steps: [], raw: '' }, steps: [], finalAnswer: '',
    };

    try {
      // Phase 0: Think
      try {
        timeline.thinking = await this.think(expandedQuery, history);
        console.log('[Orchestrator] Thinking:', timeline.thinking.slice(0, 80) + '...');
      } catch (err) {
        console.warn('[Orchestrator] Thinking skipped:', err);
      }

      // Phase 1: Plan
      let steps: SkillStep[] = [];
      try {
        const r = await this.plan(expandedQuery, history);
        steps = r.steps;
        timeline.plan = { steps, raw: r.raw };
      } catch (err) {
        console.error('[Orchestrator] Planning failed:', err);
      }
      console.log('[Orchestrator] Plan steps:', steps);

      // Auto‑complete full profile
      const isFullProfile = /full profile|complete details|all information|detailed profile/i.test(query);
      if (isFullProfile && steps.some(s => s.skill === 'customer')) {
        const customerName = steps.find(s => s.skill === 'customer')?.params?.name || query;
        if (!steps.some(s => s.skill === 'sales')) {
          steps.push({ skill: 'sales', params: { customerName } });
        }
        if (!steps.some(s => s.skill === 'support')) {
          steps.push({ skill: 'support', params: { customerName } });
        }
        timeline.plan.steps = steps;
      }

      if (!steps.length) {
        const answer = await this.directAnswer(expandedQuery, history);
        timeline.finalAnswer = answer;
        return this.finish(taskId, expandedQuery, timeline, [], answer);
      }

      // Phase 2: Execute skills with retry
      const usedSkills: string[] = [];
      const observations: any[] = [];

      await Promise.all(steps.map(async (step) => {
        const skill = this.registry.get(step.skill);
        if (!skill) { console.warn(`[Orchestrator] Unknown skill: ${step.skill}`); return; }

        usedSkills.push(step.skill);
        const params = step.params && typeof step.params === 'object' ? step.params : {};
        if (params.dateRange) {
          params.dateRange = normaliseDateRange(String(params.dateRange));
          console.log(`[Orchestrator] Normalised dateRange → "${params.dateRange}"`);
        }

        const thoughtBefore = `Executing "${step.skill}"` +
          (Object.keys(params).length ? ` with ${JSON.stringify(params)}` : '');

        let result: SkillResult;
        let retries = 0;
        const maxRetries = 2;
        while (retries <= maxRetries) {
          const start = Date.now();
          try {
            result = await skill.execute({ query: expandedQuery, ...params }, context);
            const duration = Date.now() - start;
            const output = result.success ? result.output : { error: result.error };
            const outputType = output?.type ?? (result.success ? 'success' : 'error');
            console.log(`[Orchestrator] Executed ${step.skill} (${duration}ms): ${outputType}`);
            observations.push(output);
            timeline.steps.push({
              skill: step.skill, input: params, output, duration, thoughtBefore,
              thoughtAfter: `"${step.skill}" completed in ${duration}ms → ${outputType}`,
            });
            return;
          } catch (err) {
            retries++;
            if (retries > maxRetries) {
              result = { success: false, error: String(err) };
              const failureDir = path.join(PROJECT_ROOT, 'knowledge', 'failures');
              if (!fs.existsSync(failureDir)) fs.mkdirSync(failureDir, { recursive: true });
              const failureFile = path.join(failureDir, `${taskId}-${step.skill}.md`);
              const failureContent = `# Failure: ${step.skill}\n\n**Task**: ${taskId}\n**Query**: ${expandedQuery}\n**Error**: ${err}\n**Params**: ${JSON.stringify(params)}\n**Retries**: ${retries}\n`;
              fs.writeFileSync(failureFile, failureContent, 'utf-8');
              observations.push({ error: String(err) });
              timeline.steps.push({
                skill: step.skill, input: params, output: { error: String(err) }, duration: 0, thoughtBefore,
                thoughtAfter: `"${step.skill}" failed after ${retries} retries`,
              });
              return;
            } else {
              console.log(`[Orchestrator] Retry ${retries} for ${step.skill}...`);
              await new Promise(resolve => setTimeout(resolve, 500 * retries));
            }
          }
        }
      }));

      // Phase 3: Aggregate
      const answer = await this.aggregator.aggregate(expandedQuery, observations, context);
      timeline.finalAnswer = answer;
      timeline.steps.push({
        skill: 'aggregator', input: { count: observations.length },
        output: { summary: answer.slice(0, 80) }, duration: 0,
        thoughtBefore: `Synthesising ${observations.length} result(s)`,
        thoughtAfter: 'Aggregation complete',
      });

      return this.finish(taskId, expandedQuery, timeline, usedSkills, answer);
    } catch (err) {
      const failureDir = path.join(PROJECT_ROOT, 'knowledge', 'failures');
      if (!fs.existsSync(failureDir)) fs.mkdirSync(failureDir, { recursive: true });
      const failureFile = path.join(failureDir, `${taskId}-critical.md`);
      const failureContent = `# Critical Failure\n\n**Task**: ${taskId}\n**Query**: ${expandedQuery}\n**Error**: ${err}\n**Plan**: ${JSON.stringify(timeline.plan)}\n`;
      fs.writeFileSync(failureFile, failureContent, 'utf-8');
      throw err;
    }
  }

  private finish(taskId: string, query: string, timeline: ExecutionTimeline, usedSkills: string[], answer: string) {
    const tasksDir = path.join(PROJECT_ROOT, 'runtime', 'tasks');
    const taskFile = path.join(tasksDir, `${taskId}.json`);
    const taskRecord = {
      id: taskId,
      query,
      timestamp: Date.now(),
      timeline,
      usedSkills,
      finalAnswer: answer,
    };
    fs.writeFileSync(taskFile, JSON.stringify(taskRecord, null, 2), 'utf-8');
    return this.formatResult(answer, usedSkills, [], timeline);
  }

  private loadConstitutionAndPolicy(): string {
    const sections: string[] = [];
    const constitutionDir = path.join(PROJECT_ROOT, 'constitution');
    if (fs.existsSync(constitutionDir)) {
      const files = fs.readdirSync(constitutionDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(constitutionDir, file), 'utf-8');
        sections.push(`## [CONSTITUTION] ${file.replace('.md', '')}\n${content}`);
      }
    }
    const policyDir = path.join(PROJECT_ROOT, 'policy');
    if (fs.existsSync(policyDir)) {
      const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(policyDir, file), 'utf-8');
        sections.push(`## [POLICY] ${file.replace('.md', '')}\n${content}`);
      }
    }
    return sections.join('\n\n---\n\n');
  }

  private async think(query: string, history: {role:string;content:string}[]): Promise<string> {
    const constitutionPolicy = this.loadConstitutionAndPolicy();
    const skillNames = this.registry.listSkills().map(s => s.name).join(', ');
    const historyText = history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');
    const prompt =
      `${constitutionPolicy}\n\n` +
      `${currentDateContext()}\n\n` +
      `You are Glide, a business intelligence AI. Available tools: ${skillNames}.\n\n` +
      (historyText ? `Recent conversation:\n${historyText}\n\n` : '') +
      `User: "${query}"\n\n` +
      `Write 2-3 sentences of internal reasoning (first person):\n` +
      `- What they want and which tool(s) to use\n` +
      `- Any corrections from prior conversation to apply\n\n` +
      `Prose only. No JSON. No bullet points.`;
    return (await this.llm.generate(prompt))?.trim() ?? '';
  }

  private async plan(query: string, history: {role:string;content:string}[]): Promise<{ steps: SkillStep[]; raw: string }> {
    // Fast‑path: date range report
    const monthMatch = query.match(/\b(last\s+month|this\s+month)\b/i) || query.match(/\b(20\d{2}-\d{2})\b/);
    if (monthMatch && /report|revenue|sales/i.test(query)) {
      const dateCtx = currentDateContext();
      const lastMonth = dateCtx.match(/Last month: (\d{4}-\d{2})/)?.[1] ?? '';
      const thisMonth = dateCtx.match(/Current month: (\d{4}-\d{2})/)?.[1] ?? '';
      const matched = monthMatch[1];
      let dateRange = '';
      if (/last month/i.test(matched)) dateRange = lastMonth;
      else if (/this month/i.test(matched)) dateRange = thisMonth;
      else dateRange = normaliseDateRange(matched);
      if (dateRange) return { steps: [{ skill: 'sales', params: { dateRange } }], raw: '' };
    }

    // Fast‑path: location query
    const locationMatch = query.match(/(?:from|in|clients?\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:\s*$|\?|,)/i);
    if (locationMatch && !/profile|order|revenue|sales/i.test(query)) {
      const place = locationMatch[1].trim();
      const placeLC = place.toLowerCase();
      const matchedState = Object.entries(STATE_ALIASES).find(([_, aliases]) =>
        aliases.some(alias => placeLC === alias || placeLC.includes(alias))
      );
      if (matchedState) return { steps: [{ skill: 'customer', params: { state: matchedState[0] } }], raw: '' };
      const matchedCity = Object.entries(CITY_ALIASES).find(([_, aliases]) =>
        aliases.some(alias => placeLC === alias || placeLC.includes(alias))
      );
      if (matchedCity) return { steps: [{ skill: 'customer', params: { city: matchedCity[0] } }], raw: '' };
      // Check country
      const countryList = ['canada', 'germany', 'france', 'australia', 'uk', 'united kingdom', 'usa', 'united states', 'china', 'japan', 'brazil'];
      const matchedCountry = countryList.find(c => placeLC.includes(c));
      if (matchedCountry) return { steps: [{ skill: 'customer', params: { country: matchedCountry } }], raw: '' };
      return { steps: [{ skill: 'customer', params: { country: place } }], raw: '' };
    }

    // LLM planner
    const dateCtx = currentDateContext();
    const lastMonth = dateCtx.match(/Last month: (\d{4}-\d{2})/)?.[1] ?? '';
    const skillList = this.registry.listSkills().map(s => `- ${s.name}: ${s.description}`).join('\n');
    const historyText = history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');
    const constitutionPolicy = this.loadConstitutionAndPolicy();

    const prompt =
      `${constitutionPolicy}\n\n` +
      `${dateCtx}\n\n` +
      `You are an execution planner. Choose the minimum set of skills needed.\n\n` +
      `Skills:\n${skillList}\n\n` +
      (historyText ? `Recent conversation:\n${historyText}\n\n` : '') +
      `Query: "${query}"\n\n` +
      `STRICT RULES:\n` +
      `- Only add a skill if it directly answers the query\n` +
      `- Customer profile → customer + sales(customerName only, NO dateRange)\n` +
      `- Location search → customer only (country/city/state param)\n` +
      `- Sales report → sales(dateRange: "${lastMonth}") for last month\n` +
      `- docs/features → knowledge_retrieval only\n` +
      `- dateRange: exactly "YYYY-MM", no trailing characters\n\n` +
      `EXAMPLES:\n` +
      `"Adam profile" → [customer(name:Adam), sales(customerName:Adam)]\n` +
      `"clients from Germany" → [customer(country:Germany)]\n` +
      `"clients from California" → [customer(state:California)]\n` +
      `"clients from Los Angeles" → [customer(city:Los Angeles)]\n` +
      `"sales last month" → [sales(dateRange:${lastMonth})]\n` +
      `"what is Astrion?" → [knowledge_retrieval(query:Astrion)]\n\n` +
      `Respond ONLY with valid JSON: {"steps":[{"skill":"name","params":{}}]}`;

    let raw = await this.llm.generate(prompt);
    let parsed: any = null;
    try {
      parsed = safeJsonParse(raw);
    } catch (err) {
      console.warn('[Orchestrator] Plan parse failed, retrying with stricter prompt');
      const retryPrompt = prompt + '\n\nRespond ONLY with valid JSON. No markdown, no extra text.';
      const retryRaw = await this.llm.generate(retryPrompt);
      try {
        parsed = safeJsonParse(retryRaw);
        raw = retryRaw;
      } catch (retryErr) {
        const m = raw.match(/"skill"\s*:\s*"([^"]+)"/) || retryRaw.match(/"skill"\s*:\s*"([^"]+)"/);
        if (m && this.registry.get(m[1])) parsed = { steps: [{ skill: m[1], params: {} }] };
        else throw retryErr;
      }
    }

    if (!Array.isArray(parsed?.steps)) {
      if (/detail|profile|contact|activit/i.test(query))
        return { steps: [{ skill:'customer', params:{name:query} }, { skill:'sales', params:{customerName:query} }], raw };
      if (/feature|how to|what is|integrate/i.test(query))
        return { steps: [{ skill:'knowledge_retrieval', params:{query} }], raw };
      throw new Error('Plan missing steps array');
    }

    const steps: SkillStep[] = parsed.steps.map((s: any) => ({
      skill: String(s.skill ?? ''),
      params: s.params && typeof s.params === 'object' ? s.params : {},
    }));

    return { steps, raw };
  }

  private async directAnswer(query: string, history: {role:string;content:string}[]): Promise<string> {
    const h = history.slice(-4).map(t => `${t.role}: ${t.content}`).join('\n');
    try {
      return await this.llm.generate(
        `${currentDateContext()}\n\n${h ? `Conversation:\n${h}\n\n` : ''}Answer: "${query}"`
      );
    } catch { return "I couldn't process that right now."; }
  }

  private formatResult(text: string, usedSkills: string[], observations: any[], timeline: ExecutionTimeline) {
    return {
      output:   { type:'ai', text: text?.trim() || 'Done.', observations },
      metadata: { usedSkills, timeline },
    };
  }
}