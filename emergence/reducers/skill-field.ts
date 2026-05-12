// emergence/reducers/skill-field.ts
// ⭐ Glide GEAP 3.1 — Causality Medium
// SkillField does NOT run tasks.
// It maintains resonance inside a scope field.
//
// Fix log:
//   [FIX-1] Vacuum noise from empty skill.output events:
//     When sales (or any skill) emits 0 fragments, skill.output fires.
//     SkillField listens to skill.output and re-evaluates all skills.
//     None can respond to an empty skill.output → vacuum → anomaly → proposal.
//     This creates a noise loop on every query.
//     Fixed: skill.output events with 0 fragments are silenced before
//     the vacuum check. A field perturbation that produces nothing is
//     constitutionally silence — not an anomaly.
//
//   [FIX-2] skill.output from already-closed scopes still entered the field.
//     The closedScopes guard correctly short-circuits, but the log was
//     still firing ("field perturbed") creating misleading output.
//     Fixed: closed-scope events are silently dropped before logging.
//
//   [FIX-3] Vacuum should NOT fire when the triggering event is itself
//     a skill.output — resonance chain exhaustion is normal field behavior,
//     not an anomaly. Only input.user entering a silent field is anomalous.
//     Fixed: vacuum emission is suppressed for skill.output trigger events.

import type { EventBus } from '../../kernel/event-bus/event-bus.js';
import type {
  GlideEvent,
  EventLineage,
} from '../../kernel/event-bus/event-contract.js';
import type {
  Skill,
  SkillResult,
  SkillFragment,
} from '../../kernel/types/skill.js';

type ManifestSkill = Skill;

const FIELD_EVENTS = [
  'input.user',
  'skill.output',
  'meaning.unresolved',
  'cognition.reflect',
];

export class SkillField {
  private skills: ManifestSkill[] = [];

  /** scope → manifestation trace */
  private traceMap = new Map<string, any[]>();

  /** closed causal scopes */
  private closedScopes = new Set<string>();

  constructor(private bus: EventBus, private context: any) {}

  // ======================================================
  // Boot
  // ======================================================

  register(skill: ManifestSkill): void {
    this.skills.push(skill);
  }

  boot(): void {
    console.log(`[Causality Medium] ${this.skills.length} skills active`);

    // ⭐ Scope closure — mark scope as complete
    this.bus.on('causality.closed', (event: GlideEvent) => {
      const scopeId =
        event.payload?.scopeId ??
        event.payload?.taskId;
      if (scopeId) {
        this.closedScopes.add(scopeId);
      }
    });

    // ⭐ Field observation
    for (const eventType of FIELD_EVENTS) {
      this.bus.on(eventType, async (event: GlideEvent) => {
        const scopeId = this.resolveScope(event);

        // ⭐ [FIX-2] Silently drop events from closed scopes
        if (this.closedScopes.has(scopeId)) return;

        // ⭐ [FIX-1] Suppress re-evaluation for empty skill.output events.
        // A skill that emitted 0 fragments produced silence — that is its
        // constitutional right. Treating the resulting skill.output event
        // as a new field perturbation creates a vacuum noise loop.
        if (eventType === 'skill.output') {
          const fragments = (event.payload as any)?.fragments ?? [];
          if (fragments.length === 0) return; // silence is not an anomaly
        }

        this.logField(eventType, event);

        let activatedCount = 0;

        for (const skill of this.skills) {
          const activated = await this.tryManifest(skill, event, scopeId);
          if (activated) activatedCount++;
        }

        // ⭐ [FIX-3] Vacuum only makes sense when input.user finds no resonance.
        // When a skill.output finds no further resonance, that is causal
        // completion — the chain exhausted naturally. Not an anomaly.
        if (activatedCount === 0 && eventType === 'input.user') {
          this.emitVacuum(event, scopeId);
        }
      });
    }
  }

  // ======================================================
  // Scope Resolution (GEAP Core)
  // ======================================================

  private resolveScope(event: GlideEvent): string {
    return (
      event.scopeId ??
      event.trace?.scopeId ??
      event.trace?.taskId ??
      event.id
    );
  }

  // ======================================================
  // Field Logging
  // ======================================================

  private logField(eventType: string, event: GlideEvent) {
    if (eventType === 'input.user') {
      const text = this.extractText(event);
      if (!text) return;
      console.log(`[Causality Medium] input: "${text.slice(0, 60)}"`);
    } else if (eventType === 'skill.output') {
      const skill     = (event.payload as any)?.skill ?? 'unknown';
      const fragments = (event.payload as any)?.fragments?.length ?? 0;
      console.log(`[Causality Medium] field perturbed: ${eventType} (${skill} → ${fragments} fragment(s))`);
    } else {
      console.log(`[Causality Medium] field perturbed: ${eventType}`);
    }
  }

  // ======================================================
  // Vacuum Emergence
  // Only emitted when input.user finds no resonance channel.
  // ======================================================

  private emitVacuum(event: GlideEvent, scopeId: string) {
    console.warn(`[Causality Medium] ⚠ Non-resonant field vacuum — no skill responded to input`);

    this.bus.emitEvent(
      'cognition.anomaly.detected',
      {
        subtype: 'non_resonant_field_vacuum',
        originalEventId: event.id,
        rejectedSkills: this.skills.map(s => s.name),
        reason: 'no_resonance_channel',
        scopeId,
        taskId: scopeId,
        timestamp: Date.now(),
      },
      'COGNITION',
      {
        origin: event.id,
        cause: 'skill_field.evaluation',
        depth: (event.lineage?.depth ?? 0) + 1,
        constraint: { requires: [], conflicts: [] },
      },
      { scopeId, taskId: scopeId }
    );
  }

  // ======================================================
  // Manifestation Logic
  // ======================================================

  private async tryManifest(
    skill: Skill,
    event: GlideEvent,
    scopeId: string
  ): Promise<boolean> {

    if (typeof skill.canExist !== 'function') return false;

    const text   = this.extractText(event);
    const exists = skill.canExist(event, text);
    if (!exists) return false;

    const depth = (event.lineage?.depth ?? 0) + 1;

    if (this.alreadyManifested(skill.name, scopeId, depth)) return false;

    try {
      const result: SkillResult = await skill.handler(
        event.payload,
        {
          eventBus:  this.bus,
          lineage:   event.lineage,
          llm:       this.context.llm,
          workspace: this.context.workspace,
        }
      );

      if (!result || result.state === 'failed') return false;

      const fragments = result.fragments ?? [];
      const enriched  = this.enrichFragments(fragments, skill.name);

      this.recordTrace(scopeId, {
        skill:     skill.name,
        fragments: enriched,
        depth,
        state:     result.state,
      });

      const lineage: EventLineage = {
        origin: event.id,
        cause:  skill.name,
        depth,
        constraint: { requires: ['input.user'], conflicts: [] },
      };

      // ⭐ Skill manifestation
      this.bus.emitEvent(
        'skill.output',
        {
          skill:      skill.name,
          fragments:  enriched,
          phase:      result.phase,
          confidence: result.confidence,
          state:      result.state,
          scopeId,
          taskId:     scopeId,
        },
        'RUNTIME',
        lineage,
        { scopeId, taskId: scopeId }
      );

      // ⭐ Cognition observes fragments
      this.bus.emitEvent(
        'fragment.observed',
        {
          skill:     skill.name,
          fragments: enriched,
          scopeId,
          taskId:    scopeId,
        },
        'COGNITION',
        lineage,
        { scopeId, taskId: scopeId }
      );

      // ⭐ Resonance emergence
      this.bus.emitEvent(
        'resonance.observed',
        {
          skill:         skill.name,
          fragmentCount: enriched.length,
          scopeId,
        },
        'COGNITION',
        lineage,
        { scopeId, taskId: scopeId }
      );

      console.log(`[Causality Medium] ${skill.name} emitted ${enriched.length} fragments`);

      return true;

    } catch (err) {
      console.error(`[Causality Medium] ${skill.name} error`, err);
      return false;
    }
  }

  // ======================================================
  // Helpers
  // ======================================================

  private extractText(event: GlideEvent): string {
    const p = event.payload as any;
    return String(
      p?.input?.message ??
      p?.input?.text    ??
      p?.input          ??
      p?.message        ??
      ''
    );
  }

  private alreadyManifested(
    skillName: string,
    scopeId:   string,
    depth:     number
  ): boolean {
    const trace = this.traceMap.get(scopeId) ?? [];
    return trace.some(t => t.skill === skillName && t.depth >= depth);
  }

  private enrichFragments(
    fragments: SkillFragment[],
    skillName: string
  ): SkillFragment[] {
    return fragments.map(f => ({
      ...f,
      source: f.source ?? skillName,
      phase:  f.phase  ?? 'identity',
    }));
  }

  private recordTrace(scopeId: string, entry: any) {
    if (!this.traceMap.has(scopeId)) {
      this.traceMap.set(scopeId, []);
    }
    this.traceMap.get(scopeId)!.push(entry);
  }
}