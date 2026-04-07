// D:\glide\runtime\agent.ts
import path from 'path';
import fs from 'fs/promises';
import { watch } from 'fs';
import { pathToFileURL } from 'url';
import { OllamaClient } from '../kernel/llm/ollama-client.js';
import { SkillRegistry } from '../kernel/registry.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
export class Agent {
    rootPath;
    orchestrator;
    llm;
    registry;
    sessionMemory = new Map();
    constructor(rootPath) {
        this.rootPath = rootPath;
        this.registry = new SkillRegistry();
        this.llm = new OllamaClient();
        this.orchestrator = new Orchestrator(this.registry, this.llm);
    }
    // =============================
    // INIT
    // =============================
    async init() {
        await this.loadSkills();
        this.watchSkillsDirectory();
        console.log(`[Agent] 🚀 Ready — ${this.registry.listSkills().length} skills loaded`);
    }
    // =============================
    // SKILL LOADING
    // =============================
    async loadSkills() {
        const skillsDir = path.join(this.rootPath, 'skills');
        try {
            const files = await fs.readdir(skillsDir);
            for (const file of files) {
                if (!file.endsWith('.skill.ts') && !file.endsWith('.skill.js'))
                    continue;
                await this.loadSkillFromPath(path.join(skillsDir, file));
            }
        }
        catch (err) {
            console.error('[Agent] Failed loading skills:', err);
        }
    }
    async loadSkillFromPath(filePath) {
        try {
            const module = await import(`${pathToFileURL(filePath).href}?update=${Date.now()}`);
            const skill = module.skill;
            if (!skill?.name) {
                console.warn(`[Agent] Invalid skill: ${filePath}`);
                return;
            }
            this.registry.register(skill);
            console.log(`[Agent] ✅ Loaded skill: ${skill.name}`);
        }
        catch (err) {
            console.error(`[Agent] ❌ Skill load error:`, err);
        }
    }
    // =============================
    // HOT RELOAD SKILLS
    // =============================
    watchSkillsDirectory() {
        const skillsDir = path.join(this.rootPath, 'skills');
        let timer;
        watch(skillsDir, (_, filename) => {
            if (!filename)
                return;
            if (!filename.endsWith('.ts') && !filename.endsWith('.js'))
                return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                console.log(`[Agent] 🔄 Reloading ${filename}`);
                this.loadSkillFromPath(path.join(skillsDir, filename));
            }, 300);
        });
    }
    // =============================
    // PROCESS REQUEST
    // =============================
    async process(input, sessionId = 'default') {
        const kernelContext = this.kernel.getContext();
        const context = {
            memory: this.getSessionMemory(sessionId),
            kernel: this.kernel,
            logger: kernelContext.logger ?? console,
            llm: this.llm,
            workspace: this.rootPath,
            originalQuery: input,
            sessionId,
        };
        return this.orchestrator.process(input, context);
    }
    // =============================
    // MEMORY
    // =============================
    getSessionMemory(sessionId) {
        if (!this.sessionMemory.has(sessionId)) {
            this.sessionMemory.set(sessionId, {});
        }
        return this.sessionMemory.get(sessionId);
    }
    // =============================
    // TEMP AI GENERATED SKILL
    // =============================
    async generateTempSkill(name, code) {
        const tempDir = path.join(this.rootPath, 'skills', 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `${name}.skill.ts`);
        await fs.writeFile(filePath, code, 'utf-8');
        await this.loadSkillFromPath(filePath);
        return true;
    }
}
