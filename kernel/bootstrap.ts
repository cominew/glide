// kernel/bootstrap.ts
// ─────────────────────────────────────────────
// Glide OS v4 — Event Topology Bootstrap (CLEAN)
// Phase 10: Causal Emergence System
// ─────────────────────────────────────────────

import path from 'path';
import { globalEventBus, EventBus } from './event-bus/event-bus.js';
import { E } from './event-bus/event-contract.js';

// Cognition (observer-only wiring)
import { ArchitectureGuardian } from '../cognition/guardians/architecture-guardian.js';
import { Reflection } from '../cognition/reflection/reflection.js';
import { CapabilityWitness } from '../cognition/observers/capability-witness.js';
import { ProposalProjection } from '../cognition/proposals/proposal-projection.js';
import { AnswerWitness } from '../cognition/observers/answer-witness.js';
import { Observer } from '../cognition/observers/observer.js';
import { registerOutcomeEvaluator } from '../cognition/observers/outcome-evaluator.js';
import { registerAuthorityWitness } from '../cognition/observers/authority-witness.js';
import { registerExistenceWitness }  from '../cognition/observers/existence-witness.js';
import { registerProjectionWitness } from '../cognition/observers/projection-witness.js';
import { registerObserverFeedbackWitness } from '../cognition/observers/observer-feedback-witness.js';

// Governance
import { ConstitutionEnforcer } from '../governance/constitution-enforcer.js';
import { loadConstitutionRules } from '../governance/constitution-loader.js';
import { PolicyEngine } from '../governance/policy-engine.js';

// Emergence
import { SkillField } from '../emergence/reducers/skill-field.js';

// Kernel services
import { awakenCapabilities } from './loader.js';
import { SkillRegistry } from './registry.js';
import { OllamaClient } from './llm/ollama-client.js';
import { SkillContext } from './types/skill.js';

export interface GlideOS {
  bus: EventBus;
  guardian: ArchitectureGuardian;
  reflection: Reflection;
  capabilityWitness: CapabilityWitness;
  proposals: ProposalProjection;
  policyEngine: PolicyEngine;
  registry: SkillRegistry;
  llm: OllamaClient;
  context: SkillContext;
  answerWitness: AnswerWitness;
  skillField: SkillField;
  observer: Observer;
}

let _os: GlideOS | null = null;

export async function bootstrapGlide(): Promise<GlideOS> {
  console.log('\n⚙️ Glide OS v4 — Event Field Bootstrap');

  // 1. Event Bus
  const bus = globalEventBus;
  console.log('   📡 EventBus online');

  // 2. Proposals (superposition layer)
  const proposals = new ProposalProjection(bus);
  console.log('   📜 ProposalProjection initialized');

  // 3. Skills
  const llm = new OllamaClient();
  const registry = new SkillRegistry();

  const loadedSkills = await awakenCapabilities(
    path.join(process.cwd(), 'skills'),
    registry
  );
  console.log(`   🧠 Skills loaded: ${loadedSkills.length}`);

  // AnswerWitness — pure observer, no answer emission
  const answerWitness = new AnswerWitness(bus);
  console.log('   👁 AnswerWitness observing fragments');

  const context: SkillContext = {
    memory: {},
    logger: console,
    llm,
    workspace: process.cwd(),
    originalQuery: '',
    eventBus: bus,
    lineage: {} as any,
  };

  // 4. Policy
  const extraRules = loadConstitutionRules();
  const policyEngine = new PolicyEngine(extraRules);

  // 5. Guardian
  const guardian = new ArchitectureGuardian(bus);
  guardian.start();

  // 6. Cognition observers
  const observer = new Observer();
  const enforcer = new ConstitutionEnforcer(bus);
  enforcer.start();

  // Reflection & Capability Witness
  const reflection = new Reflection(bus, proposals);
  const capabilityWitness = new CapabilityWitness(bus); 
  console.log('   👁 Cognition observers online');

  registerObserverFeedbackWitness(bus);
  console.log('   👁 Observer feedback witness online');

  // 7. SkillField — Phase 10 causal driver
  const skillField = new SkillField(bus, { llm, workspace: process.cwd() });

  // Register all skills into the field
  for (const skill of loadedSkills) {
    const id = (skill as any).id ?? skill.name ?? 'unknown';

    // Phase 9+ standard Skill interface
    if (typeof (skill as any).canExist === 'function') {
      skillField.register(skill as any);
      continue;
    }
    // Legacy EmergenceSkill
    if ((skill as any).match && (skill as any).execute && (skill as any).emit) {
      skillField.register({
        id,
        domain: (skill as any).domain ?? 'general',
        description: (skill as any).description ?? '',
        match: (skill as any).match,
        guard: (skill as any).guard ?? (() => true),
        observe: (skill as any).observe ?? ((event: any) => event),
        execute: (skill as any).execute,
        emit: (skill as any).emit,
      } as any);
      continue;
    }
    // Legacy handler-only skill
    if ((skill as any).handler) {
      const keywords = (skill as any).keywords ?? [];
      skillField.register({
        id,
        domain: 'general',
        description: (skill as any).description ?? '',
        match: (event: any) => {
          const text = String(event.payload?.input?.message ?? '').toLowerCase();
          if (keywords.length === 0) return true;
          return keywords.some((k: string) => text.includes(k.toLowerCase()));
        },
        guard: () => true,
        observe: (event: any) => event,
        execute: async (event: any, ctx: any) => {
          const text = String(event.payload?.input?.message ?? '');
          const result = await (skill as any).handler({ query: text }, ctx);
          return (result as any)?.fragments ?? [];
        },
        emit: (fragments: any[]) => ({
          type: 'skill.output',
          skill: id,
          fragments,
          complete: true,
        }),
      } as any);
      continue;
    }
    // Legacy onLoad skill (self-subscribing)
    if ((skill as any).onLoad) {
      skillField.register({
        id,
        domain: 'general',
        description: (skill as any).description ?? '',
        match: () => false,
        guard: () => false,
        observe: () => null,
        execute: async () => [],
        emit: () => ({ type: 'skill.output', skill: id, fragments: [] }),
        onLoad: (skill as any).onLoad,
      } as any);
    }
  }

  skillField.boot();
  console.log('   ⚡ SkillField booted — skills listening to input.user');

  // 8. Outcome evaluator (post-collapse quality assessment)
  registerOutcomeEvaluator(bus);
  console.log('   👁 Outcome evaluator registered');

  registerAuthorityWitness(bus); 
  registerExistenceWitness(bus);
  registerProjectionWitness(bus);
  console.log('   👁 Authority, Existence, Projection witnesses registered');

  // 9. System boot signal
  bus.emitEvent(E.SYSTEM_BOOT, { bootedAt: Date.now() }, 'SYSTEM');

  _os = {
    bus,
    guardian,
    reflection,
    capabilityWitness,
    proposals,
    policyEngine,
    registry,
    llm,
    context,
    answerWitness,
    skillField,
    observer,
  };

  console.log('\n✨ Glide OS v4 ready — pure event field\n');
  return _os;
}

// Accessors
export const getOS = (): GlideOS => {
  if (!_os) throw new Error('[Glide] not initialized');
  return _os;
};

export const getBus = () => getOS().bus;
export const getProposals = () => getOS().proposals;