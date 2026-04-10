import {
  startKernel,
  getContext,
  getRegistry
} from './kernel/kernel';

import { Orchestrator } from './runtime/orchestrator/orchestrator';
import { ConsciousLoop } from './kernel/conscious-loop';
import { GoalEngine } from './runtime/goal-engine/goal-engine';
import { Scheduler } from './kernel/scheduler';

const MODE = process.env.GLIDE_MODE ?? 'stable';

async function boot() {

  console.log('🚀 Booting Glide (AI OS Mode)...');

  startKernel();

  const context = getContext();
  const registry = getRegistry();

  const orchestrator =
    new Orchestrator(
  registry,
  context.llm,
  context,
  process.cwd()
);

  const consciousLoop =
    new ConsciousLoop(orchestrator, context);

  const goalEngine =
    new GoalEngine(orchestrator, context);

  const scheduler =
    new Scheduler(
      consciousLoop,
      goalEngine
    );

  // ⭐ 添加一个测试目标
  goalEngine.addGoal(
    'analyze last month sales',
    8
  );

  scheduler.start(2000);

  console.log('✅ Glide AI OS started');
}

boot();