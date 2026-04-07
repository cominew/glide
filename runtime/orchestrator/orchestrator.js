import { Aggregator } from './aggregator.js';
export class Orchestrator {
    registry;
    llm;
    aggregator;
    maxIterations = 3;
    constructor(registry, llm) {
        this.registry = registry;
        this.llm = llm;
        this.aggregator = new Aggregator(llm);
    }
    async process(query, context) {
        const observations = [];
        const usedSkills = [];
        for (let i = 0; i < this.maxIterations; i++) {
            let thought;
            try {
                thought = await this.think(query, observations, context);
            }
            catch (err) {
                console.error('[Orchestrator] Think error:', err);
                const finalAnswer = await this.aggregator.aggregate(query, observations, context);
                return { output: { text: finalAnswer }, metadata: { usedSkills } };
            }
            if (thought.action === 'finish') {
                return { output: { text: thought.answer }, metadata: { usedSkills } };
            }
            const skill = this.registry.get(thought.skill);
            if (!skill) {
                observations.push({ error: `Skill ${thought.skill} not found` });
                continue;
            }
            usedSkills.push(thought.skill);
            const input = { query, ...thought.params };
            try {
                const result = await skill.execute(input, context);
                observations.push(result.output);
            }
            catch (err) {
                observations.push({ error: String(err) });
            }
        }
        const finalAnswer = await this.aggregator.aggregate(query, observations, context);
        return { output: { text: finalAnswer }, metadata: { usedSkills } };
    }
    async think(query, observations, context) {
        const skills = this.registry.listSkills();
        const skillDescriptions = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
        const observationsText = observations.map((o, idx) => `Step ${idx + 1} result: ${JSON.stringify(o)}`).join('\n');
        const prompt = `You are a reasoning agent. Available skills:
${skillDescriptions}

User query: "${query}"

Previous observations:
${observationsText || "None"}

Now think step by step. Output JSON with:
- "thought": your reasoning
- "action": "call_skill" or "finish"
- if "call_skill": "skill", "params"
- if "finish": "answer"

Example call_skill: {"thought":"Need customers from Germany","action":"call_skill","skill":"customer","params":{"country":"Germany"}}
Example finish: {"thought":"I have the answer","action":"finish","answer":"There are 42 customers from Germany."}
Only output valid JSON.`;
        const response = await this.llm.generate(prompt);
        const jsonMatch = response.match(/\{.*\}/s);
        if (!jsonMatch)
            throw new Error('Invalid JSON from LLM');
        const thought = JSON.parse(jsonMatch[0]);
        if (thought.action === 'call_skill') {
            return { action: 'call', skill: thought.skill, params: thought.params, thought: thought.thought };
        }
        else if (thought.action === 'finish') {
            return { action: 'finish', answer: thought.answer, thought: thought.thought };
        }
        else {
            return { action: 'finish', answer: thought.answer || "I'm not sure.", thought: thought.thought };
        }
    }
}
