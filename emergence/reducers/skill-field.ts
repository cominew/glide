// emergence/reducers/skill-field.ts
// ─────────────────────────────────────────────────────────────
// Skill Field — boots emergence skills into the event field
//
// For each skill, subscribes to input.user events.
// When an event arrives, runs the five phases:
//   match → guard → observe → execute → emit
//
// The SkillField does not decide which skill runs.
// Each skill decides for itself via match() + guard().
// ─────────────────────────────────────────────────────────────

import { EventBus }                 from '../../kernel/event-bus/event-bus.js';
import { E, GlideEvent }            from '../../kernel/event-bus/event-contract.js';
import { EmergenceSkill,
         SkillExecutionContext }    from '../../kernel/types/skill.js';

export class SkillField {

  private skills:  EmergenceSkill[]        = [];
  private context: SkillExecutionContext;

  constructor(private bus: EventBus, context: SkillExecutionContext) {
    this.context = context;
  }

  register(skill: EmergenceSkill): void {
    this.skills.push(skill);
  }

boot(): void {
  this.bus.on('input.user', (event: GlideEvent) => {
    const text = String(event.payload?.input?.message ?? '');
    console.log(`[SkillField] input: "${text.slice(0, 60)}..."`);
    
    for (const skill of this.skills) {
      const matched = skill.match(event);
      console.log(`[SkillField] ${skill.id}.match() = ${matched}`);
      if (matched) {
        this.tryEmerge(skill, event);
      }
    }
  });

    console.log(`[SkillField] ${this.skills.length} skills in field`);
    console.log('[SkillField] Listening for input.user');
  }

private async tryEmerge(skill: EmergenceSkill, event: GlideEvent): Promise<void> {
  try {
    if (!skill.match(event)) return;
    if (!skill.guard(event)) return;

    const observation = skill.observe(event);
    const fragments = await skill.execute(observation, this.context);
    if (!fragments.length) return;

    const output = skill.emit(fragments);
    const taskId = event.trace?.taskId ?? event.id;

    const hasCompletion =
      fragments.some(f => (f as any).complete === true) ||
      (output as any).complete === true;

    this.bus.emitEvent(
      'skill.fragment', 
      {
        ...output,
        correlationId: taskId,
        complete: hasCompletion, 
      },
      'RUNTIME',
      taskId
    );
  } catch (err) {
    console.error(`[SkillField] ${skill.id} error:`, err);
  }
}
}
