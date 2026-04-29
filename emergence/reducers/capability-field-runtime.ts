// emergence/fields/capability-field-runtime.ts

import { EventBus } from '../../kernel/event-bus/event-bus'
import { SkillRegistry } from '../../kernel/registry.js'
import type { GlideEvent } from '../../kernel/event-bus/event-contract.js'
import type { SkillContext } from '../../kernel/types.js'

export class CapabilityFieldRuntime {

  constructor(
    private registry: SkillRegistry,
    private bus: EventBus,
    private context: SkillContext,
  ) {}

  start() {

    this.bus.on('input.user', async (event: GlideEvent) => {

      const skills = this.registry.list()

      for (const skill of skills) {

        // ⭐ Presence Law
        if (!skill.match?.(event)) continue

        // ⭐ Silence Supremacy
        if (skill.guard && !skill.guard(event)) continue

        // ⭐ Observation
        const observation =
          skill.observe?.(event) ?? null

        // ⭐ Execution
        const fragments =
          await skill.execute?.(observation, this.context)

        if (!fragments?.length) continue

        // ⭐ EMIT ONLY EVENTS
        const output = skill.emit(fragments)

        this.bus.emitEvent(
          output.type,
          {
            skill: output.skill,
            fragments: output.fragments,
          },
          'RUNTIME',
          event.id
        )
      } // ← close for loop

      console.log('[CapabilityFieldRuntime] Skill field active')

    }) // ← close bus.on

  } // ← close start()
}