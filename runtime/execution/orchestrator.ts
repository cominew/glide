// runtime/execution/orchestrator.ts
// ─────────────────────────────────────────────
// Glide OS — Orchestrator (Execution Layer)
// Authority: NONE
// Pure execution engine for tasks dispatched by Dispatcher
// ─────────────────────────────────────────────

import { SkillRegistry } from '../../kernel/registry';
import { SkillContext, SkillResult, SkillStep, Task } from '../../kernel/types';
import { OllamaClient } from '../../kernel/llm/ollama-client';
import { Aggregator } from './aggregator';
import { safeJsonParse } from '../utils/safe-json';
import { EventBus } from '../../kernel/event-bus/event-bus';
import { createTask } from '../../runtime/tasks/task';


import path from 'path';
import fs from 'fs';

// ─────────────────────────────────────────────

function expandAbbreviations(q: string): string {
    return q;
}

function currentDateContext(): string {
    const now = new Date();
    return `[DATE] ${now.toISOString().slice(0, 10)}`;
}

function loadIdentityContext(root: string): string {
    const file = path.join(root, 'constitution', 'identity.md');
    if (!fs.existsSync(file)) return '';
    return fs.readFileSync(file, 'utf-8').slice(0, 300);
}

// ─────────────────────────────────────────────

export class Orchestrator {
    private aggregator: Aggregator;
    private rootPath: string;

    constructor(
        private registry: SkillRegistry,
        private llm: OllamaClient,
        private context: SkillContext,
        private eventBus: EventBus,
        rootPath?: string,
    ) {
        this.aggregator = new Aggregator(llm);
        this.rootPath = rootPath ?? process.cwd();

        // Listen ONLY for execution triggers
        this.eventBus.on('task.executing', (event: any) => {
            const task: Task = event.payload;
            this.handle(task);
        });
    }

    // ─────────────────────────────────────────────
    // Dispatcher entry
    // ─────────────────────────────────────────────

    private async handle(task: Task): Promise<void> {
        await this.execute(task.intent, this.context, task.id);
    }

    // ─────────────────────────────────────────────
    // Core execution pipeline
    // ─────────────────────────────────────────────

    async execute(
        query: string,
        context: SkillContext,
        taskId: string,
    ): Promise<void> {

        const startTime = Date.now();
        const history = context.memory?.history ?? [];

        const emit = (type: string, payload: any) => {
            this.eventBus.emit(type, {
                id: `evt_${Date.now()}`,
                type,
                taskId,
                payload,
                timestamp: Date.now(),
                source: 'orchestrator',
            });
        };

        // ── START ─────────────────────────────
        emit('task.started', { query });

        const expanded = expandAbbreviations(query);

        // ── THINK ─────────────────────────────
        emit('thinking.start', { query: expanded });

        let thinking = '';
        try {
            const prompt =
                `${loadIdentityContext(this.rootPath)}\n` +
                `${currentDateContext()}\n` +
                `User: ${expanded}`;

            thinking = (await this.llm.generate(prompt))?.trim() ?? '';
        } catch {}

        emit('thinking.end', { thinking });

        // ── PLAN ──────────────────────────────
        emit('planning.start', { query: expanded });

        let steps: SkillStep[] = [];

        try {
            const raw = await this.llm.generate(
                `Return JSON steps only for: ${expanded}`
            );

            const parsed = safeJsonParse(raw);
            steps = parsed?.steps ?? [];
        } catch {}

        emit('planning.end', { steps });

        // ── FALLBACK ──────────────────────────
        if (!steps.length) {
            const answer = await this.llm.generate(expanded);

            emit('answer.end', { answer });
            emit('task.completed', {
                result: answer,
                duration: Date.now() - startTime,
            });

            return;
        }

        // ── EXECUTION ─────────────────────────
        const observations: any[] = [];
        const usedSkills: string[] = [];

        for (const step of steps) {
            const skill = this.registry.get(step.skill);

            if (!skill) {
                emit('skill.error', { skill: step.skill });
                continue;
            }

            usedSkills.push(step.skill);

            emit('skill.start', { skill: step.skill });

            const result: SkillResult = await skill.execute(
                { query: expanded, ...(step.params || {}) },
                context,
            );

            observations.push(result.output);

            emit('skill.end', {
                skill: step.skill,
                output: result.output,
            });
        }

        // ── AGGREGATION ──────────────────────
        const answer = await this.aggregator.aggregate(
            expanded,
            observations,
            context,
        );

        emit('aggregation.end', { answer });

        // ── COMPLETE ──────────────────────────
        emit('task.completed', {
            result: answer,
            usedSkills,
            duration: Date.now() - startTime,
        });
    }
}