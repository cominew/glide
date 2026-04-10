import { SkillContext } from './types';
import { SkillRegistry } from './registry';
import { globalEventBus } from './event-bus';
import { HealthMonitor } from './diagnostics/diagnosis';
import { Observer } from './diagnostics/observer';
import { OllamaClient } from './llm/ollama-client';

let context: SkillContext;
let registry: SkillRegistry;

export function startKernel(): SkillContext {

  console.log('⚙️ Starting Glide Kernel...');

  // ---- Context ----
  context = {
    memory: {},
    logger: console,
    llm: new OllamaClient(),
    workspace: process.cwd(),
    originalQuery: '',
  };

  // ---- Registry ----
  registry = new SkillRegistry();

  // ---- Diagnostics ----
  new Observer();
  new HealthMonitor();

  console.log('🧠 Event Bus Online');
  console.log('✅ Kernel Ready');

  return context;
}

export function getContext() {
  return context;
}

export function getRegistry() {
  return registry;
}

export function getEventBus() {
  return globalEventBus;
}