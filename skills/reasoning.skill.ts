// skills/reasoning.skill.ts
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

export const skill: Skill = {
  name: 'reasoning',
  description: 'General reasoning and analysis',
  keywords: ['reason', 'analyze', 'think', 'explain'],

  canExist(event: GlideEvent, text?: string): boolean {
    // 只响应 persona-summary 的输出，形成严格的有序链
    if (event.type !== 'skill.output') return false;
    const skill = event.payload?.skill;
    if (skill !== 'persona-summary') return false;

    const fragments = event.payload?.fragments ?? [];
    return fragments.some((f: any) => f.name === 'persona.summary');
  },

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    // 修复第 20 行：补充 fragments 和 confidence
    if (!context?.llm) {
      return {
        state: 'partial',
        phase: 'analysis',
        fragments: [],
        confidence: 0,
      };
    }

    let query = '';
    const fragments = input?.fragments ?? [];

    // ⚠️ 如果是反思事件，构建强制引用的 prompt
    if (input?.taskId && input?.reason) { // 简单的辨别方式
      const dataText = JSON.stringify(fragments, null, 2);
      query = `Your previous analysis failed for the reason: "${input.reason}". Here is the data you MUST use in your analysis:\n${dataText}\n\nPlease rewrite your analysis, explicitly citing the numbers and details above.`;
    }
    // 正常模式
    else {
      if (fragments.length > 0) {
        query = fragments
          .filter((f: any) => f.type === 'data')
          .map((f: any) => JSON.stringify(f.value, null, 2))
          .join('\n\n');
      } else if (typeof input === 'string') {
        query = input;
      } else if (input?.input?.message) {
        query = input.input.message;
      }
    }

    // 修复第 44 行：补充 fragments 和 confidence
    if (!query.trim()) {
      return {
        state: 'partial',
        phase: 'analysis',
        fragments: [],
        confidence: 0,
      };
    }

    const prompt = `You are a business assistant. Based on the following information, provide a concise analysis and strategic insights in English. Do not simply restate the data; interpret it.\n\n${query}`;
    const answer = await context.llm.generate(prompt);

    return {
      state: 'emitted',
      confidence: 0.9,
      phase: 'analysis',
      fragments: [{
        type: 'data',
        name: 'reasoning_result',
        value: answer,
        role: 'summary',
        confidence: 0.9,
        source: 'reasoning.skill',
        phase: 'analysis',
      }],
    };
  },
};