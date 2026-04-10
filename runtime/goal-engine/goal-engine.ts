// runtime/goal-engine/goal-engine.ts

import { Orchestrator } from '../orchestrator/orchestrator';
import { SkillContext } from '../../kernel/types';
import { log } from '../orchestrator/ui-log';

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  result?: any;
}

export class GoalEngine {

  private goals: Goal[] = [];
  private running = false;

  constructor(
    private orchestrator: Orchestrator,
    private context: SkillContext
  ) {}

  // -------------------------
  // ADD GOAL
  // -------------------------

  addGoal(description: string, priority = 5) {

    const goal: Goal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      description,
      priority,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.goals.push(goal);

    log.info(`[GoalEngine] Added goal "${description}"`);

    return goal;
  }

  // -------------------------
  // SELECT NEXT GOAL
  // -------------------------

  private getNextGoal(): Goal | null {

    const pending = this.goals
      .filter(g => g.status === 'pending')
      .sort((a,b)=>
        b.priority - a.priority ||
        a.createdAt - b.createdAt
      );

    return pending[0] ?? null;
  }

  // -------------------------
  // EXECUTE
  // -------------------------

  async executeGoal(goal: Goal) {

    if (this.running) return;

    this.running = true;

    goal.status = 'in_progress';

    log.info(`[GoalEngine] Executing "${goal.description}"`);

    try {

      const result =
        await this.orchestrator.process(
          goal.description,
          this.context
        );

      goal.status = 'completed';
      goal.result = result;

      log.info(`[GoalEngine] Completed "${goal.description}"`);

    } catch (err:any) {

      goal.status = 'failed';
      goal.result = { error:String(err) };

      log.error(
        `[GoalEngine] Failed "${goal.description}" → ${err}`
      );
    }

    this.running = false;
  }

  // -------------------------
  // SINGLE TICK
  // -------------------------

  async tick() {

    if (this.running) return;

    const goal = this.getNextGoal();

    if (!goal) return;

    await this.executeGoal(goal);
  }

  // -------------------------

  getGoals() {
    return [...this.goals];
  }
}