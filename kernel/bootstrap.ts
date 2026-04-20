// kernel/bootstrap.ts
// ─────────────────────────────────────────────────────────────
// Glide Event OS — Bootstrap (Quantum Model)
// ─────────────────────────────────────────────────────────────
// This is the entry point for the Glide Event OS. It initializes all core components, sets up the event bus, and starts the system clock.
// The architecture follows a quantum model where cognition (proposals) exists in superposition until observed by the human gate, at which point it collapses into reality (dispatcher execution).      
// Constitution v2 Compliance:
//   - The bootstrap initializes all components but does not contain any logic that would violate the constitution.
//   - It sets up the event bus and starts the scheduler, but does not emit any cognitive events or make any decisions itself.
//   - All components are initialized in a way that they can operate within the constitutional constraints, with clear separation of concerns and observability.
// ─────────────────────────────────────────────────────────────// Three-layer reality:
//   Superposition (Cognition + Proposals) — not yet real
//   Collapse Boundary (Human + Guardian)  — observation point
//   Observed Reality (Dispatcher + Runtime) — happened
//
// The Silence Law:
//   IDLE → INTENT → THINK → REFLECT → IDLE
//   Cognition proposes. Human approves. Dispatcher executes.
// ─────────────────────────────────────────────────────────────

import path                           from 'path';
import { ConstitutionEnforcer }       from '../governance/constitution-enforcer';

import { globalEventBus, EventBus }   from './event-bus/event-bus';
import { EventLifecycleManager }      from './temporal/event-lifecycle';
import { EventStore }                 from './temporal/event-store';
import { EventEvolutionEngine }       from './temporal/event-evolution';
import { EventGraph, eventGraph }     from './graph/event-graph';

import { ArchitectureGuardian }       from '../cognition/conscious/architecture-guardian';
import { ProposalRegistry }           from '../cognition/proposals/proposal-registry';
import { ConsciousLoop }             from '../cognition/conscious/conscious-loop';

import { loadConstitutionRules }      from '../governance/constitution-loader';
import { ConstitutionEngine }         from '../governance/constitution-engine';
import { PolicyEngine }               from '../governance/policy-engine';
import { ApprovalEngine }             from '../governance/approval-engine';

import { Dispatcher }                 from '../dispatcher/dispatcher';
import { HumanGate }                  from '../dispatcher/human-gate';
import { TaskRouter }                 from '../dispatcher/task-router';

import { GoalEngine }                 from '../runtime/goals/goal-engine';
import { Orchestrator }               from '../runtime/execution/orchestrator';
import { SkillRegistry }              from './registry';
import { OllamaClient }               from './llm/ollama-client';
import { SkillContext }               from './types';
import { Scheduler }                  from './scheduling/scheduler';

import { Skill }                      from './types';
import { E } from './event-bus/event-contract';


export interface GlideOS {
  // L0 — Signal
  bus:            EventBus;
  // L1 — Temporal
  lifecycle:      EventLifecycleManager;
  // L2 — Store
  store:          EventStore;
  // L3 — Evolution
  evolution:      EventEvolutionEngine;
  // Graph
  graph:          EventGraph;
  // Cognition
  guardian:       ArchitectureGuardian;
  proposals:      ProposalRegistry;

  // Infrastructure
  registry:       SkillRegistry;
  context:        SkillContext;
  llm:            OllamaClient;
  // Governance
  constitution:   ConstitutionEngine;
  policyEngine:   PolicyEngine;
  approvalEngine: ApprovalEngine;
  // Dispatcher
  dispatcher:     Dispatcher;
  humanGate:      HumanGate;
  // Runtime
  orchestrator:   Orchestrator;
  goalEngine:     GoalEngine;
}

let _os: GlideOS | null = null;

export async function bootstrapGlide(): Promise<GlideOS> {
  console.log('');
  console.log('⚙️  Glide Event OS (Quantum Model) — Bootstrap starting...');

  // ── L0: Signal spine ──────────────────────────────────────
  const bus = globalEventBus;
  console.log('   📡 L0 EventBus ready');

  // ── L1: Temporal ──────────────────────────────────────────
  const lifecycle = new EventLifecycleManager(bus);
  console.log('   ⏳ L1 LifecycleManager ready');

  // ── L2: Store ─────────────────────────────────────────────
  const store = new EventStore(bus);
  console.log('   📦 L2 EventStore ready');

  // ── L3: Evolution ─────────────────────────────────────────
  const evolution = new EventEvolutionEngine(store);
  console.log('   🌱 L3 EvolutionEngine ready');

  // ── Graph ─────────────────────────────────────────────────
  console.log('   🕸️  EventGraph ready');

  // ── Guardian (once, after bus is ready) ───────────────────
  const guardian = new ArchitectureGuardian(bus);
  guardian.start();
  console.log('   🛡️  ArchitectureGuardian ready');

  // ── Constitution Enforcer (once, after bus is ready) ───────  
  const enforcer = new ConstitutionEnforcer(globalEventBus);
  enforcer.start();
  console.log('   ⚖️  ConstitutionEnforcer active');

  // ── ProposalRegistry (Superposition layer) ────────────────
  const proposals = new ProposalRegistry(bus);
  console.log('   🔵 ProposalRegistry ready (superposition layer)');

  // ── Infrastructure ────────────────────────────────────────
  const llm      = new OllamaClient();
  const registry = new SkillRegistry();
  await registry.loadAll(path.join(process.cwd(), 'skills'));
  console.log(`   🧠 LLM · Registry ready (${registry.list().length} skills loaded)`);

  const context: SkillContext = {
    memory: {}, logger: console, llm,
    workspace: process.cwd(), originalQuery: '',
  };
  console.log('   🧠 LLM · Registry ready');

  // ── Governance ────────────────────────────────────────────
  const extraRules     = loadConstitutionRules();
  const constitution   = new ConstitutionEngine(extraRules);
  const policyEngine   = new PolicyEngine(constitution);
  const approvalEngine = new ApprovalEngine();
  console.log(`   ⚖️  Constitution (${constitution.listRules().length} rules) ready`);

  // ── Dispatcher (sole routing authority) ───────────────────
  const humanGate  = new HumanGate();
  const taskRouter = new TaskRouter();
  const dispatcher = new Dispatcher(policyEngine, humanGate, taskRouter, bus);
  console.log('   🧭 Dispatcher ready');

  // ── Runtime ───────────────────────────────────────────────
  const orchestrator = new Orchestrator(registry, llm, context, bus);
  const goalEngine   = new GoalEngine(dispatcher);
  console.log('   ⚡ Runtime (Orchestrator + GoalEngine) ready');

  // ── Scheduler (system clock) ─────────────────────────────  
  const scheduler = new Scheduler(bus);
  scheduler.start();
  console.log('   ⏰ Scheduler started (system clock)');

  // ── Conscious Loop (observability layer) ─────────────────  
  // ConsciousLoop gets ProposalRegistry so it can PROPOSE
  // instead of executing anything directly.

  // optional observability layer
  const consciousLoop = new ConsciousLoop(bus, proposals);

if (process.env.ENABLE_OBSERVABILITY === 'true') {
  consciousLoop.start();
}
  console.log('   👁️  ConsciousLoop created');
  console.log('   👁️  ConsciousLoop observing');
  
// ── Evolution tick (every 60s) and Proposal cleanup (every 5min) ───────
  setInterval(() => {
  const report = evolution.compute();
  if (report.patterns.some(p => p.type === 'anomaly')) {
    proposals.propose({
      category: 'healing',
      title: `Evolution detected anomaly pattern: ${report.summary}`,
      description: report.summary,
      reasoning: `EventEvolution found ${report.patterns.length} patterns`,
      impact: 'medium',
      source: 'evolution-engine',
    });
  }
}, 60_000);

setInterval(() => {
  const expired = proposals.expireOld();
  if (expired > 0) console.log(`[Bootstrap] ${expired} proposals expired`);
}, 5 * 60_000);

  // ── Boot event ────────────────────────────────────────────
  bus.emitEvent('system.boot', { bootedAt: Date.now() }, 'SYSTEM');

  console.log('✅ Glide Event OS (Quantum Model) Ready');
  console.log('   Superposition → Collapse Boundary → Observed Reality');
  console.log('');

_os = {
  bus,
  lifecycle,
  store,
  evolution,
  graph: eventGraph,
  guardian,
  proposals,
  registry,
  context,
  llm,
  constitution,
  policyEngine,
  approvalEngine,
  dispatcher,
  humanGate,
  orchestrator,
  goalEngine,
};

  return _os;
}

export function getOS(): GlideOS {
  if (!_os) throw new Error('[Bootstrap] Not started.');
  return _os;
}

export const getBus        = () => getOS().bus;
export const getStore      = () => getOS().store;
export const getDispatcher = () => getOS().dispatcher;
export const getProposals  = () => getOS().proposals;
