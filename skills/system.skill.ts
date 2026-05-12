import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

export const skill: Skill = {
  name: 'system',
  description: 'Execute internal system changes (restart, config update, cache clear)',
  keywords: ['system', 'restart', 'config', 'cache'],

  canExist(event: GlideEvent): boolean {
    if (event.type !== 'input.user') return false;
    const text = String(event.payload?.input?.message ?? '');
    return /\b(?:restart|reload|clear cache|update config|system)\b/i.test(text);
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const action = input.action ?? input.input?.action;
    if (!action) {
      return {
        state: 'partial',
        confidence: 0,
        phase: 'synthesis',
        fragments: [],
      };
    }

    let result: string;
    switch (action) {
      case 'restart_service':   result = 'Service restarted'; break;
      case 'update_config':     result = 'Config updated'; break;
      case 'clear_cache':       result = 'Cache cleared'; break;
      default:
        return {
          state: 'failed',
          confidence: 0,
          phase: 'synthesis',
          fragments: [{
            type: 'data',
            name: 'system_action_error',
            value: `Unknown system action: ${action}`,
            source: 'system.skill',
            phase: 'synthesis',
            confidence: 1.0,
          }],
        };
    }

    return {
      state: 'emitted',
      confidence: 1.0,
      phase: 'synthesis',
      fragments: [{
        type: 'data',
        name: 'system_action',
        value: result,
        source: 'system.skill',
        phase: 'synthesis',
        confidence: 1.0,
        role: 'primary',
      }],
    };
  },
};