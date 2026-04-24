// kernel/bootstrap.ts
// ─────────────────────────────────────────────
// Glide OS v4 — Event Topology Bootstrap (CLEAN)
// ─────────────────────────────────────────────

import path from 'path';
import { ConstitutionEnforcer } from '../governance/constitution-enforcer.js';
import { globalEventBus, EventBus } from './event-bus/event-bus.js';
import { E } from './event-bus/event-contract.js';

// Cognition (observer-only wiring)
import { ArchitectureGuardian } from '../cognition/guardians/architecture-guardian.js';
import { ConsciousLoop } from '../cognition/reflection/reflection.js';
import { IntentAnalyzer } from '../cognition/interpretation/intent-analyzer.js';
import { ProposalRegistry } from '../cognition/proposals/proposal-registry.js';
import { AnswerWitness } from '../cognition/observers/answer-witness.js';

// Governance
import { loadConstitutionRules } from '../governance/constitution-loader.js';
import { PolicyEngine } from '../governance/policy-engine.js';

// Emergence
import { CapabilityFieldRuntime } from '../emergence/reducers/capability-field-runtime.js';
import { SkillField } from '../emergence/reducers/skill-field.js';
import { AnswerSilenceDetector } from '../emergence/reducers/answer-silence-detector.js';

// Kernel services
import { awakenCapabilities } from './loader.js';      
import { SkillRegistry } from './registry.js';
import { OllamaClient } from './llm/ollama-client.js';
import { SkillContext } from './types.js';


export interface GlideOS {
  bus: EventBus;
  guardian: ArchitectureGuardian;
  intentAnalyzer: IntentAnalyzer;
  consciousLoop: ConsciousLoop;
  proposals: ProposalRegistry;
  policyEngine: PolicyEngine;
  registry: SkillRegistry;
  llm: OllamaClient;
  context: SkillContext;
}

let _os: GlideOS | null = null;

export async function bootstrapGlide(): Promise<GlideOS> {
  console.log('\n⚙️ Glide OS v4 — Event Field Bootstrap');

  // 1. Event Bus
  const bus = globalEventBus;
  console.log('   📡 EventBus online');

  // 2. Proposals
  const proposals = new ProposalRegistry(bus);

  // 3. Skills
  const llm = new OllamaClient();
  const registry = new SkillRegistry();

  await awakenCapabilities(path.join(process.cwd(), 'skills'), registry);
  console.log(`   🧠 Skills loaded: ${registry.list().length}`);

  const answerWitness = new AnswerWitness(bus);
  console.log('   👁 AnswerWitness observing fragments');

  const silenceDetector = new AnswerSilenceDetector(bus);
silenceDetector.start();
console.log('   ⏱️ AnswerSilenceDetector active');

  const context: SkillContext = {
    memory: {}, logger: console, llm,
    workspace: process.cwd(), originalQuery: '',
  };

  // 4. Policy
  const extraRules = loadConstitutionRules();
  const policyEngine = new PolicyEngine(extraRules);

  // 5. Guardian
  const guardian = new ArchitectureGuardian(bus);
  guardian.start();

  // 6. Cognition observers
  const enforcer = new ConstitutionEnforcer(bus);
  enforcer.start();

  const intentAnalyzer = new IntentAnalyzer(bus, proposals, registry, llm);

  const consciousLoop = new ConsciousLoop(bus, proposals);
  consciousLoop.start();

  console.log('   👁 Cognition observers online');

  // 7. Emergence field
  console.log('   ⚡ Emergence field active');
  const skillField = new SkillField(bus, { llm, workspace: process.cwd() });
  for (const skill of registry.list()) {
  if (skill.presence && skill.act) {
    // 包装为 EmergenceSkill 格式
    skillField.register({
      id: skill.name,
      domain: 'general',
      description: skill.description,
      match: (event) => skill.presence!(event),
      guard: (event) => skill.evidence ? skill.evidence({}) : true,
      observe: (event) => event,
      execute: async (event, context) => {
        const fragments: any[] = [];
        await skill.act!(event, {}, (frag: any) => fragments.push(frag));
        return fragments;
      },
      emit: (fragments) => ({
        type: 'skill.output',
        skill: skill.name,
        fragments,
      }),
    });
  }
}

skillField.boot();
console.log('   ⚡ SkillField booted — skills listening to input.user');

  // 8. System boot signal
  bus.emitEvent(E.SYSTEM_BOOT, { bootedAt: Date.now() }, 'SYSTEM');

  _os = {
    bus,
    guardian,
    intentAnalyzer,
    consciousLoop,
    proposals,
    policyEngine,
    registry,
    llm,
    context,
  };

  console.log('\n✨ Glide OS v4 ready — pure event field\n');
  return _os;
}

// Accessors
export const getOS = () => {
  if (!_os) throw new Error('[Glide] not initialized');
  return _os;
};

export const getBus = () => getOS().bus;
export const getProposals = () => getOS().proposals;