// skills/system.skill.ts
import { Skill, SkillContext, SkillResult } from '../kernel/types.js';

export const skill: Skill = {
  name: 'system',
  description: 'Execute internal system changes (restart, config update, etc.)',
  keywords: ['system', 'restart', 'config', 'cache'],
  inputs: ['action'],
  outputs: ['fragments'],

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const action = input.action;
    switch (action) {
      case 'restart_service':
        return { success: true, fragments: [{ type: 'data', name: 'system_action', value: 'Service restarted' }] };
      case 'update_config':
        return { success: true, fragments: [{ type: 'data', name: 'system_action', value: 'Config updated' }] };
      case 'clear_cache':
        return { success: true, fragments: [{ type: 'data', name: 'system_action', value: 'Cache cleared' }] };
      default:
        return { success: false, error: `Unknown system action: ${action}` };
    }
  },
};