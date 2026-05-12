import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

export const skill: Skill = {
  name: 'tool',
  description: 'Utility calculations, unit conversions, and string operations.',
  keywords: ['tool', 'calculate', 'math', 'convert', 'string', 'utility'],

  canExist(event: GlideEvent): boolean {
    if (event.type !== 'input.user') return false;
    const text = String(event.payload?.input?.message ?? '');
    return /\b(?:calculate|math|add|subtract|multiply|divide|convert|uppercase|lowercase)\b/i.test(text);
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const action = input.action ?? input.input?.action;
    const params = input.params ?? input.input?.params ?? {};
    if (!action) {
      return {
        state: 'partial',
        confidence: 0,
        phase: 'analysis',
        fragments: [],
      };
    }

    try {
      let value: any;
      switch (action) {
        case 'add':         value = (params.a || 0) + (params.b || 0); break;
        case 'subtract':    value = (params.a || 0) - (params.b || 0); break;
        case 'multiply':    value = (params.a || 0) * (params.b || 0); break;
        case 'divide':
          if (params.b === 0) {
            return {
              state: 'failed',
              confidence: 0,
              phase: 'analysis',
              fragments: [{
                type: 'data',
                name: 'error',
                value: 'Division by zero.',
                source: 'tool.skill',
                phase: 'analysis',
                confidence: 1.0,
              }],
            };
          }
          value = (params.a || 0) / (params.b || 0);
          break;
        case 'uppercase':   value = String(params.text || '').toUpperCase(); break;
        case 'lowercase':   value = String(params.text || '').toLowerCase(); break;
        default:
          return {
            state: 'failed',
            confidence: 0,
            phase: 'analysis',
            fragments: [{
              type: 'data',
              name: 'error',
              value: `Unknown action: ${action}`,
              source: 'tool.skill',
              phase: 'analysis',
              confidence: 1.0,
            }],
          };
      }

      return {
        state: 'emitted',
        confidence: 1.0,
        phase: 'analysis',
        fragments: [{
          type: 'data',
          name: 'result',
          value: value,
          source: 'tool.skill',
          phase: 'analysis',
          confidence: 1.0,
          role: 'primary',
        }],
      };
    } catch (err) {
      return {
        state: 'failed',
        confidence: 0,
        phase: 'analysis',
        fragments: [{
          type: 'data',
          name: 'error',
          value: `Tool execution error: ${String(err)}`,
          source: 'tool.skill',
          phase: 'analysis',
          confidence: 1.0,
        }],
      };
    }
  },
};