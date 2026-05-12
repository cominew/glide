// kernel/types/skill.ts

import type { GlideEvent, EventLineage } from '../event-bus/event-contract';

export interface SkillContext {
  eventBus: any;
  lineage: EventLineage;
  llm?: any;
  workspace?: string;
  memory?: any;
  originalQuery?: string;
  logger?: Console;
}

export type CausalPhase =
  | 'identity'
  | 'retrieval'
  | 'analysis'
  | 'synthesis'
  | 'observation'
  | 'collapse'
  | 'resonance'
  | 'stabilization'
  | 'release';

export interface SkillFragment {
  type: 'data' | 'signal';

  name: string;
  value: any;

  role?: 'primary' | 'supplementary' | 'evidence' | 'summary';

  confidence?: number;

  source: string;

  phase: CausalPhase;
}

export type SkillState =
  | "emitted"   // phenomenon appeared
  | "partial"   // weak signal
  | "failed";   // internal exception only

export interface SkillResult {
  state: SkillState; // emitted | partial | failed

  fragments: SkillFragment[];

  confidence: number;

  phase: CausalPhase;

  error?: string;
}


export interface Skill {
  name: string;
  description: string;
  keywords: string[];

  canExist(event: GlideEvent, text: string): boolean;

  handler(
    input: any,
    context?: SkillContext
  ): Promise<SkillResult>;
}