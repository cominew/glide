// emergence/reducers/skill-field.ts
// ─────────────────────────────────────────────────────────────
// Skill Field — boots all loaded skills into the event field
//
// For emergence skills (match/guard/observe/execute/emit):
//   Runs all five phases on every input.user event.
//
// For legacy skills with onLoad():
//   Calls onLoad(bus, context) — skill subscribes itself.
//
// For legacy skills with handler():
//   Wraps them: if keywords match, calls handler(input).
//
// No skill is called by name. All arise from conditions.
// ─────────────────────────────────────────────────────────────

import type { EventBus }   from '../../kernel/event-bus/event-bus.js';
import type { GlideEvent } from '../../kernel/event-bus/event-contract.js';
import type { LoadedSkill } from '../../kernel/loader.js';

const SKILL_OUTPUT = 'skill.output';
const SKILL_ERROR  = 'skill.error';

export class SkillField {

  private skills:  LoadedSkill[] = [];
  private context: any;

  constructor(private bus: EventBus, context: any) {
    this.context = context;
  }

  register(skill: LoadedSkill): void {
    this.skills.push(skill);
  }

  boot(): void {
    const total = this.skills.length;

    // Boot legacy onLoad() skills first — they self-subscribe
    for (const skill of this.skills) {
      if (typeof skill.onLoad === 'function') {
        try {
          skill.onLoad(this.bus, this.context);
        } catch (err) {
          console.error(`[SkillField] onLoad error in ${skill.name ?? skill.id}:`, err);
        }
      }
    }

    // For emergence + legacy handler skills: subscribe to input.user
    this.bus.on('input.user', (event: GlideEvent) => {
      const text = this.extractText(event);
      if (text) console.log(`[SkillField] input: "${text.slice(0, 60)}..."`);

      for (const skill of this.skills) {
        // Skip skills that already self-subscribe via onLoad
        if (typeof skill.onLoad === 'function' && typeof skill.match !== 'function') continue;

        this.tryEmerge(skill, event);
      }
    });

    console.log(`[SkillField] ${total} skills in field`);
    console.log('[SkillField] Listening for input.user');
  }

  private async tryEmerge(skill: LoadedSkill, event: GlideEvent): Promise<void> {
    const skillId = skill.id ?? skill.name ?? 'unknown';
    const taskId  = event.trace?.taskId ?? event.id;

    try {
      // ── Emergence model (match/guard/observe/execute/emit) ──

      if (typeof skill.match === 'function') {
        if (!skill.match(event)) return;

        if (typeof skill.guard === 'function' && !skill.guard(event)) return;

        const observation = typeof skill.observe === 'function'
          ? skill.observe(event)
          : this.extractText(event);

        const fragments = await skill.execute!(observation, this.context);
        if (!fragments?.length) return;

        const output = typeof skill.emit === 'function'
          ? skill.emit(fragments)
          : { type: SKILL_OUTPUT, skill: skillId, fragments };

        this.bus.emitEvent(SKILL_OUTPUT, { ...output, taskId }, 'RUNTIME', taskId);
        return;
      }

      // ── Legacy handler model ──────────────────────────────

      if (typeof skill.handler === 'function') {
        const text     = this.extractText(event);
        const keywords = skill.keywords ?? [];

        // Keyword presence check — silent if no match
        if (keywords.length > 0) {
          const lc = text.toLowerCase();
          if (!keywords.some(k => lc.includes(k.toLowerCase()))) return;
        }

        const result = await skill.handler({ query: text, input: text }, this.context);

        if (!result?.success) return;

        const fragments = result.fragments ?? result.output
          ? [{ type: 'data', name: skillId, value: result.output ?? result.fragments }]
          : [];

        if (!fragments.length) return;

        this.bus.emitEvent(SKILL_OUTPUT, {
          skill: skillId, fragments, taskId,
        }, 'RUNTIME', taskId);
      }

    } catch (err) {
      console.error(`[SkillField] ${skillId} error:`, err);
      this.bus.emitEvent(SKILL_ERROR, {
        skill: skillId, error: String(err), taskId,
      }, 'RUNTIME', taskId);
    }
  }

  private extractText(event: GlideEvent): string {
    return String(
      event.payload?.input?.message ??
      event.payload?.input?.text ??
      event.payload?.input ??
      event.payload?.message ??
      ''
    );
  }
}