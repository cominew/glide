// runtime/goals/goal-engine.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Goal Engine
// Thinking type: DESIRE — generates intent ONLY.
//
// GoalEngine creates Tasks and hands them to the Dispatcher.
// It does NOT call Orchestrator directly (that was the old bug).
// It does NOT route, execute, or write memory.
// ─────────────────────────────────────────────────────────────

import { Task, TaskType, RiskLevel } from '../../kernel/types';
import { createTask, taskSummary } from '../tasks/task';
import { Dispatcher } from '../../dispatcher/dispatcher';

export interface Goal {
  id:          string;
  description: string;
  priority:    number;
  risk:        RiskLevel;
  status:      'pending' | 'dispatched' | 'completed' | 'failed';
  createdAt:   number;
  taskId?:     string;   // linked Task after dispatch
  result?:     any;
}

export interface AddGoalParams {
  description: string;
  priority?:   number;
  risk?:       RiskLevel;
  sessionId?:  string;
  type?:       TaskType;
}

export class GoalEngine {

  private goals: Goal[] = [];
  private running = false;

  constructor(private dispatcher: Dispatcher) {}

  // ── Add a goal ────────────────────────────────────────────

  addGoal(params: AddGoalParams): Goal {

    const goal: Goal = {
      id:          `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description: params.description,
      priority:    params.priority ?? 5,
      risk:        params.risk     ?? 'low',
      status:      'pending',
      createdAt:   Date.now(),
    };

    this.goals.push(goal);
    console.log(`[GoalEngine] Added: "${goal.description}" (priority ${goal.priority})`);
    return goal;
  }

  // ── Select highest-priority pending goal ──────────────────

  private nextGoal(): Goal | null {
    return this.goals
      .filter(g => g.status === 'pending')
      .sort((a, b) =>
        b.priority - a.priority ||
        a.createdAt - b.createdAt
      )[0] ?? null;
  }

  // ── Dispatch a goal as a Task ─────────────────────────────
  // GoalEngine's ONLY output: a Task sent to Dispatcher.
  // No direct calls to Orchestrator. Ever.

  async dispatchGoal(goal: Goal, sessionId?: string): Promise<Task> {

    goal.status = 'dispatched';

    const task = createTask({
      type:      goal.risk === 'high' ? 'goal_pursuit' : 'goal_pursuit',
      intent:    goal.description,
      source:    'goal',
      priority:  goal.priority,
      risk:      goal.risk,
      sessionId,
    });

    goal.taskId = task.id;

    console.log(`[GoalEngine] Dispatching: ${taskSummary(task)}`);

    // Hand off to Dispatcher — GoalEngine's responsibility ends here
    const result = await this.dispatcher.dispatch(task);

    if (result.status === 'COMPLETED') {
      goal.status = 'completed';
      goal.result = result.result;
    } else if (result.status === 'FAILED') {
      goal.status = 'failed';
      goal.result = result.result;
    }

    return result;
  }

  // ── Single tick (called by Scheduler) ────────────────────

  async tick(sessionId?: string): Promise<void> {

    if (this.running) return;

    const goal = this.nextGoal();
    if (!goal) return;

    this.running = true;

    try {
      await this.dispatchGoal(goal, sessionId);
    } catch (err) {
      goal.status = 'failed';
      goal.result = { error: String(err) };
      console.error(`[GoalEngine] Dispatch failed for "${goal.description}":`, err);
    } finally {
      this.running = false;
    }
  }

  // ── Inspection ────────────────────────────────────────────

  getGoals(): Goal[] {
    return [...this.goals];
  }

  getPending(): Goal[] {
    return this.goals.filter(g => g.status === 'pending');
  }

  getCompleted(): Goal[] {
    return this.goals.filter(g => g.status === 'completed');
  }
}
