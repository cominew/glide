// runtime/orchestrator/orchestrator.ts

import { SkillRegistry } from '../../kernel/registry.js';
import { SkillContext, SkillResult } from '../../kernel/types.js';
import { OllamaClient } from '../../kernel/llm/ollama-client.js';
import { Aggregator } from './aggregator.js';
import { safeJsonParse } from '../utils/safe-json.js';
import { globalEventBus } from '../../kernel/event-bus.js';
import type { EmitFn, SkillStep } from '../../kernel/event-types.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { kernelActivity, kernelState } from '../../kernel/state.js';
import { runtimeLock } from '../../kernel/runtime-lock.js';
import { trace } from '../trace.js';
import { PolicyEngine } from '../../kernel/policy-engine.js';

const ABBREV: Record<string, { type: 'city' | 'state' | 'country'; full: string }> = {
    'la': { type: 'city', full: 'Los Angeles' },
    'nyc': { type: 'city', full: 'New York' },
    'sf': { type: 'city', full: 'San Francisco' },
    'dc': { type: 'city', full: 'Washington DC' },
    'ca': { type: 'state', full: 'California' },
    'tx': { type: 'state', full: 'Texas' },
    'fl': { type: 'state', full: 'Florida' },
    'ny': { type: 'state', full: 'New York' },
    'wa': { type: 'state', full: 'Washington' },
    'nv': { type: 'state', full: 'Nevada' },
    'az': { type: 'state', full: 'Arizona' },
    'il': { type: 'state', full: 'Illinois' },
    'uk': { type: 'country', full: 'United Kingdom' },
    'usa': { type: 'country', full: 'United States' },
    'uae': { type: 'country', full: 'United Arab Emirates' },
};

function expandAbbreviations(q: string): string {
    return q.replace(/\b([a-z]{2,3})\b/gi, (m) => ABBREV[m.toLowerCase()]?.full ?? m);
}

function currentDateContext(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prevMm = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYy = now.getMonth() === 0 ? yyyy - 1 : yyyy;
    const last = `${prevYy}-${String(prevMm).padStart(2, '0')}`;
    return `[DATE] Today: ${yyyy}-${mm}-${String(now.getDate()).padStart(2, '0')}. Current: ${yyyy}-${mm}. Last month: ${last}.`;
}

function normaliseDateRange(raw: string): string {
    return raw.replace(/[^0-9-]/g, '').slice(0, 7);
}

// Load ONLY identity.md from constitution/ — keep prompt short for small LLMs
function loadIdentityContext(root: string): string {
    const file = path.join(root, 'constitution', 'identity.md');
    if (!fs.existsSync(file)) return '';
    try {
        const content = fs.readFileSync(file, 'utf-8');
        // Extract just the first 300 chars — enough for role context, not too much
        return `[IDENTITY]\n${content.slice(0, 300)}\n`;
    } catch {
        return '';
    }
}

export class Orchestrator {
    private aggregator: Aggregator;
    private rootPath: string;
    private lastReflection = 0;

    constructor(
        private registry: SkillRegistry,
        private llm: OllamaClient,
        private context: SkillContext,
        rootPath?: string,
    ) {
        this.aggregator = new Aggregator(llm);
        this.rootPath = rootPath ?? process.cwd();
    }

    public async getPlan(query: string) {
        return this.plan(query, []);
    }

    // ── execute() — fires events, no return value ─────────────────────────────
    async execute(
        query: string,
        context: SkillContext,
        taskId: string,
        emit?: EmitFn,
    ): Promise<void> {
        if (!runtimeLock.acquire()) {
            console.log('[Orchestrator] skipped (locked)');
            return;
        }
        if (kernelState.isBusy()) {
            console.log('[Orchestrator] Skipped: system busy');
            runtimeLock.release();
            return;
        }

        const fire: EmitFn = emit ?? ((type, payload, tid) =>
            globalEventBus.emitEvent(type, payload, tid)
        );

        const history: { role: string; content: string }[] = context.memory?.history ?? [];
        const startTime = Date.now();

        fire('task:start', { query, sessionId: context.sessionId ?? 'default' }, taskId);
        globalEventBus.startHeartbeat(taskId, 'starting');

        // Expand abbreviations
        const expanded = expandAbbreviations(query);
        if (expanded !== query) {
            console.log(`[Orchestrator] Expanded: "${query}" → "${expanded}"`);
        }

        // ── Phase 1: Think ──────────────────────────────────────────────────────
        kernelActivity.touch();
        kernelState.set('THINKING');
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

        // ── Phase 2: Plan ───────────────────────────────────────────────────────
        kernelActivity.touch();
        kernelState.set('PLANNING');
        fire('planning:start', { query: expanded }, taskId);
        globalEventBus.updateHeartbeatPhase(taskId, 'planning');

        let steps: SkillStep[] = [];
        let planRaw = '';
        try {
            const r = await this.plan(expanded, history);

            // 🧠 POLICY LAYER INSERTION
            const policyEngine = new PolicyEngine(loadIdentityContext(this.rootPath));
            steps = policyEngine.validatePlan(r.steps);
            planRaw = r.raw;
            fire('planning:end', { steps, raw: planRaw }, taskId);
            console.log('[Orchestrator] Plan steps:', steps);
        } catch (err) {
            console.error('[Orchestrator] Planning failed:', err);
            fire('planning:end', { steps: [], raw: '' }, taskId);
        }

        if (!steps.length) {
            const answer = await this.directAnswer(expanded, history);
            // IMPORTANT: answer:end BEFORE task:end
            fire('answer:end', { answer, observations: [] }, taskId);
            globalEventBus.stopHeartbeat(taskId);
            fire('task:end', { duration: Date.now() - startTime, usedSkills: [] }, taskId);
            kernelState.set('IDLE');
            runtimeLock.release();
            return;
        }

        // ── Phase 3: Execute skills in parallel ─────────────────────────────────
        kernelActivity.touch();
        kernelState.set('EXECUTING');
        globalEventBus.updateHeartbeatPhase(taskId, 'executing');

        const usedSkills: string[] = [];
        const observations: unknown[] = [];

        await Promise.all(
            steps.map(async (step) => {
                const skill = this.registry.get(step.skill);
                if (!skill) {
                    fire('skill:error', { skill: step.skill, error: 'Skill not found', duration: 0 }, taskId);
                    return;
                }

                usedSkills.push(step.skill);
                const params = step.params && typeof step.params === 'object' ? { ...step.params } : {};

                // Normalise dateRange
                if (typeof params.dateRange === 'string') {
                    params.dateRange = normaliseDateRange(params.dateRange as string);
                }
                // Profile queries must NOT have dateRange — it overrides customer's order history
                if (params.customerName && params.dateRange) {
                    delete params.dateRange;
                }

                fire('skill:start', { skill: step.skill, params }, taskId);

                const t0 = Date.now();
                let result: SkillResult;
                try {
                    result = await skill.execute({ query: expanded, ...params }, context);
                } catch (err) {
                    result = { success: false, error: String(err) };
                }
                const duration = Date.now() - t0;
                const output = result.success ? result.output : { error: result.error };
                const outputType = (output as any)?.type ?? (result.success ? 'success' : 'error');

                observations.push(output);
                console.log(`[Orchestrator] Executed ${step.skill} (${duration}ms): ${outputType}`);
                fire('skill:end', { skill: step.skill, output, duration, outputType }, taskId);
                kernelActivity.touch();
            })
        );

        // ── Phase 4: Aggregate ──────────────────────────────────────────────────
        kernelActivity.touch();
        kernelState.set('REFLECTING');
        fire('aggregation:start', { observationCount: observations.length }, taskId);
        globalEventBus.updateHeartbeatPhase(taskId, 'aggregating');

        const answer = await this.aggregator.aggregate(expanded, observations as any[], context);

        fire('aggregation:end', { summary: answer.slice(0, 100) }, taskId);

        // CRITICAL: answer:end MUST come before task:end
        fire('answer:end', { answer, observations }, taskId);

        globalEventBus.stopHeartbeat(taskId);
        fire('task:end', { duration: Date.now() - startTime, usedSkills }, taskId);

        console.log(`[Orchestrator] Task ${taskId} done in ${Date.now() - startTime}ms`);

        // Record experience asynchronously — does NOT block answer delivery
        this.recordExperience(taskId, expanded, steps, observations, answer, startTime, usedSkills).catch((err) =>
            console.warn('[Orchestrator] recordExperience failed:', err)
        );

        kernelState.set('IDLE');
        runtimeLock.release();
    }

    // ── process() — REST fallback wrapper ────────────────────────────────────
    async process(query: string): Promise<any> {
        const taskId = `rest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        kernelActivity.touch();

        return new Promise((resolve, reject) => {
            const usedSkills: string[] = [];
            const observations: unknown[] = [];
            const timeline: any = {
                thinking: '',
                plan: { steps: [], raw: '' },
                steps: [],
                finalAnswer: '',
            };

            const handler = (e: any) => {
                // IMPORTANT: only handle events for THIS task
                if (e.taskId !== taskId) return;

                switch (e.type) {
                    case 'thinking:end':
                        timeline.thinking = e.payload.thinking;
                        break;
                    case 'planning:end':
                        timeline.plan = { steps: e.payload.steps, raw: e.payload.raw ?? '' };
                        break;
                    case 'skill:end':
                        usedSkills.push(e.payload.skill);
                        observations.push(e.payload.output);
                        timeline.steps.push({
                            skill: e.payload.skill,
                            params: {},
                            output: e.payload.output,
                            duration: e.payload.duration,
                            outputType: e.payload.outputType,
                            status: 'done',
                        });
                        break;
                    case 'answer:end':
                        timeline.finalAnswer = e.payload.answer;
                        globalEventBus.offAny(handler);
                        resolve({
                            output: { type: 'ai', text: e.payload.answer, observations },
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
            this.execute(query, this.context, taskId).catch((err) => {
                globalEventBus.offAny(handler);
                reject(err);
            });
        });
    }

    // ── Think — uses identity only, NO full constitution dump ─────────────────
    private async think(query: string, history: { role: string; content: string }[]): Promise<string> {
      kernelActivity.touch();  
      const identity = loadIdentityContext(this.rootPath);
        const skillNames = this.registry
            .listSkills()
            .map((s) => s.name)
            .join(', ');
        const h = history
            .slice(-3)
            .map((t) => `${t.role}: ${t.content}`)
            .join('\n');
        const prompt =
            `${identity}${currentDateContext()}\n\n` +
            `Tools: ${skillNames}.\n\n` +
            (h ? `Recent:\n${h}\n\n` : '') +
            `User: "${query}"\n\n` +
            `Write 2-3 sentences: what they want, which tool(s), why. Prose only.`;
        return (await this.llm.generate(prompt))?.trim() ?? '';
    }

    // ── Plan ──────────────────────────────────────────────────────────────────
    private async plan(  
      query: string,
        history: { role: string; content: string }[]
    ): Promise<{ steps: SkillStep[]; raw: string }> {
        // Fast-path: date report
        const monthMatch = query.match(/\b(last\s+month|this\s+month)\b/i) || query.match(/\b(20\d{2}-\d{2})\b/);
        if (monthMatch && /report|revenue|sales/i.test(query)) {
            const ctx = currentDateContext();
            const last = ctx.match(/Last month: (\d{4}-\d{2})/)?.[1] ?? '';
            const curr = ctx.match(/Current: (\d{4}-\d{2})/)?.[1] ?? '';
            const raw = monthMatch[1];
            const dr = /last/i.test(raw) ? last : /this/i.test(raw) ? curr : normaliseDateRange(raw);
            if (dr) return { steps: [{ skill: 'sales', params: { dateRange: dr } }], raw: '' };
        }

        // Fast-path: location only
        const locMatch = query.match(/(?:from|in|clients?\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:\s*$|\?|,)/i);
        if (locMatch && !/profile|order|revenue|sales|activit/i.test(query)) {
            const place = locMatch[1].trim();
            const plc = place.toLowerCase();
            const states = ['california', 'texas', 'florida', 'new york', 'washington', 'nevada', 'arizona', 'illinois'];
            const cities = ['los angeles', 'new york', 'london', 'paris', 'berlin', 'sydney'];
            if (states.some((s) => plc.includes(s)))
                return { steps: [{ skill: 'customer', params: { state: place } }], raw: '' };
            if (cities.some((c) => plc.includes(c)))
                return { steps: [{ skill: 'customer', params: { city: place } }], raw: '' };
            return { steps: [{ skill: 'customer', params: { country: place } }], raw: '' };
        }

        const dateCtx = currentDateContext();
        const lastMonth = dateCtx.match(/Last month: (\d{4}-\d{2})/)?.[1] ?? '';
        const skillList = this.registry
            .listSkills()
            .map((s) => `- ${s.name}: ${s.description}`)
            .join('\n');
        const h = history
            .slice(-3)
            .map((t) => `${t.role}: ${t.content}`)
            .join('\n');

        const prompt =
            `${currentDateContext()}\n\n` +
            `Execution planner. Minimum skills needed.\n\n` +
            `Skills:\n${skillList}\n\n` +
            (h ? `Context:\n${h}\n\n` : '') +
            `Query: "${query}"\n\n` +
            `RULES:\n` +
            `- params always required (use {} if empty)\n` +
            `- profile/activities → customer(name) + sales(customerName) — NO dateRange for profile\n` +
            `- location → customer(country/city/state) only\n` +
            `- report → sales(dateRange:"${lastMonth}")\n` +
            `- docs/features → knowledge_retrieval\n\n` +
            `Examples:\n` +
            `"Adam profile" → {"steps":[{"skill":"customer","params":{"name":"Adam"}},{"skill":"sales","params":{"customerName":"Adam"}}]}\n` +
            `"from Germany" → {"steps":[{"skill":"customer","params":{"country":"Germany"}}]}\n` +
            `"last month" → {"steps":[{"skill":"sales","params":{"dateRange":"${lastMonth}"}}]}\n\n` +
            `JSON only:`;

        const raw = await this.llm.generate(prompt);
        console.log('[Orchestrator] Plan raw:', raw);

        let parsed: any;
        try {
            parsed = safeJsonParse(raw);
        } catch {
            const m = raw.match(/"skill"\s*:\s*"([^"]+)"/);
            if (m && this.registry.get(m[1])) parsed = { steps: [{ skill: m[1], params: {} }] };
        }

        if (!Array.isArray(parsed?.steps)) {
            if (/detail|profile|contact|activit/i.test(query))
                return {
                    steps: [
                        { skill: 'customer', params: { name: query } },
                        { skill: 'sales', params: { customerName: query } },
                    ],
                    raw,
                };
            if (/feature|how to|what is|integrate/i.test(query))
                return { steps: [{ skill: 'knowledge_retrieval', params: { query } }], raw };
            throw new Error('No valid plan');
        }

        return {
            steps: parsed.steps.map((s: any) => ({
                skill: String(s.skill ?? ''),
                params: s.params && typeof s.params === 'object' ? s.params : {},
            })),
            raw,
        };
    }

    private async directAnswer(query: string, history: { role: string; content: string }[]): Promise<string> {
        const h = history
            .slice(-3)
            .map((t) => `${t.role}: ${t.content}`)
            .join('\n');
        try {
            return await this.llm.generate(
                `${currentDateContext()}\n${h ? `Context:\n${h}\n\n` : ''}Answer: "${query}"`
            );
        } catch {
            return "I couldn't process that right now.";
        }
    }

    // ── Experience recording (async, non-blocking) ────────────────────────────
    private async recordExperience(
        taskId: string,
        query: string,
        steps: SkillStep[],
        observations: unknown[],
        answer: string,
        startTime: number,
        usedSkills: string[],
    ) {
        const expDir = path.join(this.rootPath, 'memory', 'experiences');
        if (!fs.existsSync(expDir)) fs.mkdirSync(expDir, { recursive: true });
        const duration = Date.now() - startTime;
        const hasData = observations.some(
            (o: any) =>
                o &&
                !o.error &&
                (o.data?.length > 0 || o.totalSpent !== undefined || o.revenue !== undefined)
        );
        const record = {
            taskId,
            timestamp: Date.now(),
            query,
            plan: steps,
            observations,
            finalAnswer: answer,
            evaluation: { score: hasData ? 1 : 0, duration, usedSkills },
            userFeedback: null,
        };
        fs.writeFileSync(path.join(expDir, `${taskId}.json`), JSON.stringify(record, null, 2));

        // Record to trace (assuming trace.add expects a specific structure)
        trace.add({
            taskId,
            type: 'task:complete',
            timestamp: Date.now(),
            data: { duration, usedSkills, answerLength: answer.length },
        });
    }

    // ----------------------------
    // AI SELF REFLECTION
    // ----------------------------
    public async reflect(): Promise<void> {
        const now = Date.now();
        if (now - this.lastReflection < 20000) return;

        if (kernelState.isBusy()) {
            console.log('[Orchestrator] Reflection skipped (busy)');
            return;
        }

        this.lastReflection = now;
        console.log('[Orchestrator] Passive reflection');

        try {
            const summary = await this.llm.generate(`
You are observing the AI system internally.

DO NOT plan.
DO NOT execute tools.
DO NOT create tasks.

Only describe briefly:
- current state
- potential risks
- overall health

Keep under 2 sentences.
`);
            globalEventBus.emitEvent('reflection', { summary }, 'system');
        } catch (err) {
            console.warn('[Reflection]', err);
        }
        kernelActivity.touch();
    }
}