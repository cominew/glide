// kernel/bootstrap.ts
// ─────────────────────────────────────────────────────────────
// Glide Event OS — Bootstrap (Quantum Model)
//
// Three-layer reality:
//   Superposition (Cognition + Proposals) — not yet real
//   Collapse Boundary (Human + Guardian)  — observation point
//   Observed Reality (Dispatcher + Runtime) — happened
//
// The Silence Law:
//   IDLE → INTENT → THINK → REFLECT → IDLE
//   Cognition proposes. Human approves. Dispatcher executes.
// ─────────────────────────────────────────────────────────────

import { globalEventBus, EventBus }   from './event-bus/event-bus.js';
import { EventLifecycleManager }      from './temporal/event-lifecycle.js';
import { EventStore }                 from './temporal/event-store.js';
import { EventEvolutionEngine }       from './temporal/event-evolution.js';
import { EventGraph, eventGraph }     from './graph/event-graph.js';

import { ArchitectureGuardian }       from '../cognition/conscious/architecture-guardian.js';
import { ProposalRegistry }           from '../cognition/proposals/proposal-registry.js';
import { ConsciousLoop }              from '../cognition/conscious/conscious-loop.js';

import { loadConstitutionRules }      from '../governance/constitution-loader.js';
import { ConstitutionEngine }         from '../governance/constitution-engine.js';
import { PolicyEngine }               from '../governance/policy-engine.js';
import { ApprovalEngine }             from '../governance/approval-engine.js';

import { Dispatcher }                 from '../dispatcher/dispatcher.js';
import { HumanGate }                  from '../dispatcher/human-gate.js';
import { TaskRouter }                 from '../dispatcher/task-router.js';

import { GoalEngine }                 from '../runtime/goals/goal-engine.js';
import { Orchestrator }               from '../runtime/execution/orchestrator.js';
import { SkillRegistry }              from './registry.js';
import { OllamaClient }               from './llm/ollama-client.js';
import { SkillContext }               from './types.js';
import { Scheduler }                  from './scheduling/scheduler.js';
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
  consciousLoop:  ConsciousLoop;
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

  // ── ProposalRegistry (Superposition layer) ────────────────
  const proposals = new ProposalRegistry(bus);
  console.log('   🔵 ProposalRegistry ready (superposition layer)');
  
  const consciousLoop = new ConsciousLoop(bus, proposals);
  console.log('   👁️  ConsciousLoop created');

  // ── Infrastructure ────────────────────────────────────────
  const llm      = new OllamaClient();
  const registry = new SkillRegistry();
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

  const scheduler = new Scheduler(consciousLoop, goalEngine );
  scheduler.start();
  console.log('   ⏰ Scheduler started (system clock)');

  // ── Cognition (observes last — sees everything) ───────────
  // ConsciousLoop gets ProposalRegistry so it can PROPOSE
  // instead of executing anything directly.
  consciousLoop.start();
  console.log('   👁️  ConsciousLoop observing');

  // ── Evolution: periodic reflection ───────────────────────
  setInterval(() => {
    const report = evolution.compute();
    if (report.patterns.length > 0) {
      // Reflect via ConsciousLoop — but if it's actionable,
      // it becomes a proposal, not a direct execution
      if (report.patterns.some(p => p.type === 'anomaly')) {
        proposals.propose({
          category:    'healing',
          title:       `Evolution detected anomaly pattern: ${report.summary}`,
          description: report.summary,
          reasoning:   `EventEvolution found ${report.patterns.length} patterns`,
          impact:      'medium',
          source:      'evolution-engine',
        });
      }
    }
  }, 60_000);

  // ── TTL cleanup ───────────────────────────────────────────
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
    bus, lifecycle, store, evolution, graph: eventGraph,
    guardian, proposals, consciousLoop,
    registry, context, llm,
    constitution, policyEngine, approvalEngine,
    dispatcher, humanGate,
    orchestrator, goalEngine,
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
