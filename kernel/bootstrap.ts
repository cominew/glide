// kernel/bootstrap.ts
import { EventBus }            from './event-bus/event-bus';
import { OllamaClient }        from './llm/ollama-client';
import { SkillRegistry }       from './registry';
import { SkillContext }        from './types';

import { loadConstitutionRules } from '../governance/constitution-loader';
import { ConstitutionEngine }    from '../governance/constitution-engine';
import { PolicyEngine }          from '../governance/policy-engine';
import { ApprovalEngine }        from '../governance/approval-engine';

import { Dispatcher }    from '../dispatcher/dispatcher';
import { HumanGate }     from '../dispatcher/human-gate';
import { TaskRouter }    from '../dispatcher/task-router';

import { ConsciousLoop } from '../cognition/conscious/conscious-loop';
import { GoalEngine }    from '../runtime/goals/goal-engine';
import { Orchestrator }  from '../runtime/execution/orchestrator';
import { EventLifecycleManager } from './temporal/event-lifecycle';

export interface GlideOS {
  eventBus:       EventBus;
  registry:       SkillRegistry;
  context:        SkillContext;
  llm:            OllamaClient;
  constitution:   ConstitutionEngine;
  policyEngine:   PolicyEngine;
  approvalEngine: ApprovalEngine;
  dispatcher:     Dispatcher;
  eventLifecycleManager: EventLifecycleManager;
  humanGate:      HumanGate;
  orchestrator:   Orchestrator;
  consciousLoop:  ConsciousLoop;
  goalEngine:     GoalEngine;
}

let _os: GlideOS | null = null;

export async function bootstrapGlide(): Promise<GlideOS> {
  console.log('');
  console.log('⚙️  Glide OS — Bootstrap starting...');

  // 1. Physics
  const eventBus = new EventBus();
  const llm      = new OllamaClient();
  const registry = new SkillRegistry();
  const context: SkillContext = {
    memory: {}, logger: console, llm,
    workspace: process.cwd(), originalQuery: '',
  };
  console.log('   📡 EventBus · LLM · Registry ready');

  // 2. Governance
  const extraRules     = loadConstitutionRules();
  const constitution   = new ConstitutionEngine(extraRules);
  const policyEngine   = new PolicyEngine(constitution);
  const approvalEngine = new ApprovalEngine();
  console.log(`   ⚖️  Constitution (${constitution.listRules().length} rules) · PolicyEngine ready`);

  // 3. Dispatcher
  const humanGate  = new HumanGate();
  const taskRouter = new TaskRouter();
  const dispatcher = new Dispatcher(policyEngine, humanGate, taskRouter, eventBus);
  console.log('   🧭 Dispatcher ready');

  // 4. Orchestrator — MUST be instantiated here so it subscribes to
  //    task.executing on the EventBus. Without this, every task routed
  //    to runtime.executor hangs forever with no handler.
  const orchestrator = new Orchestrator(registry, llm, context, eventBus);
  console.log('   ⚙️  Orchestrator ready');

  // 5. Goal engine
  const goalEngine = new GoalEngine(dispatcher);
  console.log('   🎯 GoalEngine ready');

  // 6. ConsciousLoop — EventBus only, no execution refs (I4)
  const consciousLoop = new ConsciousLoop(eventBus);
  consciousLoop.start();
  console.log('   👁️  ConsciousLoop observing');

  // 7. Boot event
  eventBus.emit('system.boot', {
    id: `evt_boot_${Date.now()}`, type: 'system.boot',
    payload: { bootedAt: Date.now() }, timestamp: Date.now(), source: 'bootstrap',
  });

  console.log('✅ Glide OS Ready');
  console.log('');

  _os = {
    eventBus, registry, context, llm,
    constitution, policyEngine, approvalEngine,
    dispatcher, humanGate,
    orchestrator,
    consciousLoop,
    goalEngine,
    eventLifecycleManager: new EventLifecycleManager(eventBus), 
  };

  return _os;
}

export function getOS(): GlideOS {
  if (!_os) throw new Error('[Bootstrap] Not started. Call bootstrapGlide() first.');
  return _os;
}
