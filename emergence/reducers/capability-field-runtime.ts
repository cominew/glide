// emergence/reducers/capability-field-runtime.ts

import { EventBus } from '../../kernel/event-bus/event-bus'
import { AnswerSilenceDetector } from './answer-silence-detector'
import type { GlideEvent } from '../../kernel/event-bus/event-contract.js';
import { SkillRegistry } from '../../kernel/registry.js';
import { SkillContext } from '../../kernel/types.js';

export class CapabilityFieldRuntime {
  constructor(
    private registry: SkillRegistry,
    private bus: EventBus,
    private context: SkillContext,
  ) {}

  start() {
    // 订阅 input.user 事件
    this.bus.on('input.user', (event: GlideEvent) => {
      const skills = this.registry.list();
      
      for (const skill of skills) {
        // ⭐ Article 4: Presence Law — 技能自己判断是否需要存在
        if (!skill.presence || !skill.presence(event)) continue;

        // ⭐ Article 6: Evidence Requirement — 证据检查
        const evidenceCtx: any = {};
        if (skill.evidence && !skill.evidence(evidenceCtx)) continue;

        // ⭐ Article 7: No Final Answer — 只产生 fragments
        const emit = (frag: any) => {
          this.bus.emitEvent('skill.fragment', {
            skill: skill.name,
            ...frag,
          }, 'RUNTIME', event.id);
        };

        // ⭐ Article 9: Non-Invocation Rule
        // 如果有 act 方法，使用宪法模式
        if (skill.act) {
          skill.act(event, evidenceCtx, emit);
        }
        // 兼容旧版 handler 模式（过渡期）
        else if (skill.handler) {
          const text = String(
            event.payload?.input?.message ??
            event.payload?.input ?? ''
          );
          skill.handler({ query: text }, this.context).then((result: any) => {
            if (result?.fragments) {
              for (const frag of result.fragments) {
                emit({
                  type: frag.name || frag.type,
                  correlationId: event.id,
                  data: frag.value ?? frag,
                });
              }
            }
          });
        }
      }
    });

    console.log('[CapabilityRuntime] Skills subscribed to input.user');
  }
}