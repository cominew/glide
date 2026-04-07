// runtime/goal-engine/goal-engine.ts
import { Orchestrator } from '../orchestrator/orchestrator';
import { SkillContext } from '../../kernel/types';
import { log } from '../../runtime/orchestrator/ui-log';

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
  private executing: boolean = false;

  constructor(private orchestrator: Orchestrator, private context: SkillContext) {}

  // 添加新目标
  addGoal(description: string, priority: number = 5) {
    const goal: Goal = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description,
      priority,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.goals.push(goal);
    log(`[GoalEngine] Added goal: "${description}" with priority ${priority}`);
    return goal;
  }

  // 获取待执行目标（按优先级排序）
  private getNextGoal(): Goal | null {
    const pending = this.goals.filter(g => g.status === 'pending');
    if (!pending.length) return null;
    pending.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    return pending[0];
  }

  // 执行目标
  async executeGoal(goal: Goal) {
    goal.status = 'in_progress';
    log(`[GoalEngine] Executing goal "${goal.description}"`);
    try {
      const result = await this.orchestrator.process(goal.description, this.context);
      goal.status = 'completed';
      goal.result = result;
      log(`[GoalEngine] Goal completed: "${goal.description}"`);
      return result;
    } catch (err) {
      goal.status = 'failed';
      goal.result = { error: String(err) };
      log(`[GoalEngine] Goal failed: "${goal.description}", error: ${err}`);
      return goal.result;
    }
  }

  // 主循环（不断执行目标）
  async runLoop(intervalMs: number = 1000) {
    if (this.executing) return;
    this.executing = true;
    log('[GoalEngine] Starting main loop...');
    while (true) {
      const goal = this.getNextGoal();
      if (goal) {
        await this.executeGoal(goal);
      } else {
        await new Promise(res => setTimeout(res, intervalMs));
      }
    }
  }

  // 获取当前所有目标状态
  getGoals() {
    return this.goals.slice().sort((a, b) => b.priority - a.priority);
  }
}