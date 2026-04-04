import { SkillRegistry } from './registry.js';
import { SkillContext } from './types.js';
import { Aggregator } from './aggregator.js';

export class Orchestrator {
  private maxIterations = 3; // 减少迭代次数，避免死循环
  private aggregator: Aggregator;

  constructor(private registry: SkillRegistry, private llm: any) {
    this.aggregator = new Aggregator(llm);
  }

  async process(query: string, context: SkillContext): Promise<any> {
    const observations = [];
    const usedSkills = [];

    for (let i = 0; i < this.maxIterations; i++) {
      let thought;
      try {
        thought = await this.think(query, observations, context);
      } catch (err) {
        console.error('[Orchestrator] Think error:', err);
        // 如果思考失败，直接聚合已有观察结果
        const finalAnswer = await this.aggregator.aggregate(query, observations, context);
        return { output: { text: finalAnswer }, metadata: { usedSkills } };
      }
      console.log('[Orchestrator] Thought:', thought.thought);
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
        console.log(`[Orchestrator] Executed ${thought.skill}, result:`, result.output);
      } catch (err) {
        observations.push({ error: String(err) });
      }
    }
    const finalAnswer = await this.aggregator.aggregate(query, observations, context);
    return { output: { text: finalAnswer }, metadata: { usedSkills } };
  }

  private async think(query: string, observations: any[], context: SkillContext): Promise<any> {
    const skills = this.registry.listSkills();
    const skillDescriptions = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    const observationsText = observations.map((o, idx) => `Step ${idx+1} result: ${JSON.stringify(o)}`).join('\n');

    const prompt = `
You are a reasoning agent. Available skills:
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
Only output valid JSON.
`;
    const response = await this.llm.generate(prompt);
    console.log('[Orchestrator] Think raw:', response);
    const jsonMatch = response.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error('Invalid JSON from LLM');
    let thought;
    try {
      thought = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`JSON parse error: ${e.message}`);
    }
    if (thought.action === 'call_skill') {
      return { thought: thought.thought, skill: thought.skill, params: thought.params };
    } else if (thought.action === 'finish') {
      return { thought: thought.thought, action: 'finish', answer: thought.answer };
    } else {
      // 默认 finish
      return { thought: thought.thought || 'No thought', action: 'finish', answer: thought.answer || "I'm not sure how to answer." };
    }
  }
}