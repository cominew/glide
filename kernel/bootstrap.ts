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

  const loadedSkills = await awakenCapabilities(path.join(process.cwd(), 'skills'), registry);
  console.log(`   🧠 Skills loaded: ${loadedSkills.length}`);


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

// 注册所有技能到 SkillField
for (const skill of loadedSkills) {
  const id = (skill as any).id ?? skill.name ?? 'unknown';

  // 已经是 EmergenceSkill 格式（有 match + execute + emit）
  if (skill.match && skill.execute && skill.emit) {
    skillField.register({
      id,
      domain: (skill as any).domain ?? 'general',
      description: skill.description ?? '',
      match: skill.match,
      guard: skill.guard ?? (() => true),
      observe: skill.observe ?? ((event: any) => event),
      execute: skill.execute,
      emit: skill.emit,
    } as any);
    continue;
  }

  // 有 presence + act（包装为 EmergenceSkill）
  if (skill.presence && skill.act) {
    skillField.register({
      id,
      domain: (skill as any).domain ?? 'general',
      description: skill.description ?? '',
      match: skill.presence,
      guard: () => true,
      observe: (event: any) => event,
      execute: async (event: any, ctx: any) => {
        const fragments: any[] = [];
        await skill.act!(event, ctx, (frag: any) => fragments.push(frag));
        return fragments;
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

  // 有 handler（旧版技能）
  if (skill.handler) {
    const keywords = skill.keywords ?? [];
    skillField.register({
      id,
      domain: 'general',
      description: skill.description ?? '',
      match: (event: any) => {
        const text = String(event.payload?.input?.message ?? '').toLowerCase();
        if (keywords.length === 0) return true; // 没有关键词则总会触发
        return keywords.some((k: string) => text.includes(k.toLowerCase()));
      },
      guard: () => true,
      observe: (event: any) => event,
      execute: async (event: any, ctx: any) => {
        const text = String(event.payload?.input?.message ?? '');
        const result = await skill.handler({ query: text }, ctx);
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

  // 有 onLoad（技能自行订阅）
  if (skill.onLoad) {
    skillField.register({
      id,
      domain: 'general',
      description: skill.description ?? '',
      match: () => false,
      guard: () => false,
      observe: () => null,
      execute: async () => [],
      emit: () => ({ type: 'skill.output', skill: id, fragments: [] }),
      onLoad: skill.onLoad,
    } as any);
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