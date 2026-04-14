// kernel/bootstrap.ts
import { SkillRegistry } from './registry';
import { OllamaClient } from './llm/ollama-client';
import { Orchestrator } from '../runtime/orchestrator/orchestrator';
import { GoalEngine } from '../runtime/goal-engine/goal-engine';
import { startConsciousLoop } from './conscious-loop';
import { Scheduler } from './scheduler';

export async function createKernel() {

  // =====================
  // Core primitives
  // =====================
  const registry = new SkillRegistry();
  const llm = new OllamaClient();

  // =====================
  // Orchestrator (core brain)
  // =====================
  const orchestrator = new Orchestrator(
    registry,
    llm,
    {} as any
  );

  // =====================
  // Conscious Loop (reflection)
  // =====================
  const loop = startConsciousLoop(orchestrator, {} as any);
  loop.start();

  // =====================
  // Goal Engine (intent executor)
  // =====================
  const goalEngine = new GoalEngine(orchestrator);

  // =====================
  // Scheduler (heartbeat)
  // =====================
  const scheduler = new Scheduler(loop, goalEngine);
  scheduler.start();

  return {
    registry,
    llm,
    orchestrator,
    goalEngine,
    loop,
    scheduler
  };
}