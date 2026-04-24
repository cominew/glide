// kernel/types/skill.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Skill Contract (Emergence Edition)
//
// A Skill is not a service. It is resonance.
// It does not get called. It responds to conditions.
//
// Five pure phases:
//   match()   — does this event resonate with me?
//   guard()   — are preconditions satisfied?
//   observe() — what do I need from this event?
//   execute() — pure computation, no side effects
//   emit()    — produce fragments (never answer.final)
//
// Article 7: Skill never emits answer.final
// Article 8: All output is fragments
// Article 9: Skills never call each other
// ─────────────────────────────────────────────────────────────

import type { GlideEvent } from '../event-bus/event-contract.js';

export interface SkillFragment {
  type:  string;   // 'data' | 'insight' | 'signal' | 'analysis'
  name:  string;   // semantic label
  value: unknown;  // structured data, never raw narrative
  complete?: boolean; 
}

export interface EmergenceSkill<TObservation = any> {
  readonly id:          string;
  readonly domain:      string;   // Article 13: must declare domain
  readonly description: string;

  /**
   * Article 4 — Presence Law
   * Does this event resonate with this skill?
   * Must be falsifiable. Must be able to return false.
   */
  match(event: GlideEvent): boolean;

  /**
   * Article 6 — Evidence Requirement
   * Are the preconditions for execution satisfied?
   * Return false = silence (not error).
   */
  guard(event: GlideEvent): boolean;

  /**
   * Pure observation: extract what this skill needs from the event.
   * No side effects. No database calls.
   */
  observe(event: GlideEvent): TObservation;

  /**
   * Pure computation: transform observation into fragments.
   * No EventBus access. No side effects.
   * May be async for DB/LLM calls.
   */
  execute(observation: TObservation, context: SkillExecutionContext): Promise<SkillFragment[]>;

  /**
   * Wrap fragments into skill.output event payload.
   * Article 7: fragments only — never answer.final
   */
  emit(fragments: SkillFragment[]): {
    type:      'skill.output';
    skill:     string;
    fragments: SkillFragment[];
  };
}

export interface SkillExecutionContext {
  llm?:       { generate(prompt: string): Promise<string> };
  workspace?: string;
  logger?:    Console;
}

// ── Skill loader contract ─────────────────────────────────────
// Each skill file exports an EmergenceSkill.
// The CapabilityFieldRuntime boots them into the event field.

export interface SkillModule {
  skill?: EmergenceSkill;    // legacy name
  default?: EmergenceSkill;  // preferred name
  [key: string]: unknown;
}