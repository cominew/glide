// runtime/execution/executor.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Executor
// Thinking type: PROCEDURAL — executes steps ONLY.
//
// Receives a ROUTED Task from EventBus.
// Runs the skill. Transitions Task status.
// Emits MemoryReceipt on completion (I1 — only path to memory).
// NEVER evaluates policy. NEVER routes. NEVER self-writes memory.
// ─────────────────────────────────────────────────────────────

import { Task, Skill, SkillContext, SkillResult, GlideEventType } from '../../kernel/types';
import { transitionTask, completeTask, failTask, buildMemoryReceipt } from '../tasks/task';
import { EventBus } from '../../kernel/event-bus/event-bus';
import { runtimeLocks } from '../../kernel/state/runtime-lock';

export class Executor {

  constructor(
    private eventBus: EventBus,
    private getSkill: (name: string) => Skill | undefined,
    private buildContext: (task: Task) => SkillContext,
  ) {
    // Subscribe to execution events from Dispatcher
    this.eventBus.on('task.executing', (event: any) => {
      const task = event?.payload as Task;
      if (task) this.run(task).catch(console.error);
    });
  }

  // ── Main execution entry ──────────────────────────────────

  async run(task: Task): Promise<Task> {

    // Transition → EXECUTING
    let executing: Task;
    try {
      executing = transitionTask(task, 'EXECUTING');
    } catch (err) {
      console.error(`[Executor] Bad transition for ${task.id}:`, err);
      return task;
    }

    this.emit('task.executing', executing);
    console.log(`[Executor] Running: ${executing.id} "${executing.intent}"`);

    // Acquire lock (prevent concurrent execution of same task type)
    const lockKey = executing.type === 'skill_execution' ? 'llm' : 'planning';
    if (!runtimeLocks[lockKey].acquire()) {
      console.warn(`[Executor] Lock busy for ${lockKey} — queuing task ${executing.id}`);
      // Re-emit to retry after short delay
      setTimeout(() => this.emit('task.executing', executing), 500);
      return executing;
    }

    let result: Task;

    try {
      const skillResult = await this.executeSkill(executing);

      if (skillResult.success) {
        result = completeTask(executing, skillResult.output);
        console.log(`[Executor] Completed: ${result.id}`);

        // ── I1: Emit MemoryReceipt — ONLY valid memory write path ──
        const receipt = buildMemoryReceipt(result);
        this.eventBus.emit('memory.write', {
          id:        `evt_mem_${Date.now()}`,
          type:      'memory.write',
          payload:   receipt,
          timestamp: Date.now(),
          source:    'executor',
        });

      } else {
        result = failTask(executing, skillResult.error ?? 'Skill returned failure');
        console.warn(`[Executor] Failed: ${result.id} — ${result.result?.error}`);
      }

    } catch (err) {
      result = failTask(executing, String(err));
      console.error(`[Executor] Exception in ${executing.id}:`, err);
    } finally {
      runtimeLocks[lockKey].release();
    }

    const finalEvent: GlideEventType = result.status === 'COMPLETED'
      ? 'task.completed'
      : 'task.failed';

    this.emit(finalEvent, result);
    return result;
  }

  // ── Skill dispatch ────────────────────────────────────────

  private async executeSkill(task: Task): Promise<SkillResult> {

    const context  = this.buildContext(task);
    const skillName = task.context?.skill as string | undefined;

    // If a specific skill is named in context, use it
    if (skillName) {
      const skill = this.getSkill(skillName);
      if (!skill) {
        return { success: false, error: `Skill not found: ${skillName}` };
      }
      return skill.execute(task.context?.input ?? task.intent, context);
    }

    // Otherwise treat intent as a direct LLM generation request
    try {
      const output = await context.llm.generate(task.intent);
      return { success: true, output: { text: output } };
    } catch (err) {
      return { success: false, error: `LLM error: ${String(err)}` };
    }
  }

  // ── Internal helpers ──────────────────────────────────────

  private emit(type: GlideEventType, task: Task) {
    this.eventBus.emit(type, {
      id:        `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload:   task,
      timestamp: Date.now(),
      source:    'executor',
    });
  }
}
