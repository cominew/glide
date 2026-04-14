// dispatcher/task-router.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Task Router
// Thinking type: ROUTING — resolves WHERE a task goes.
// Maps TaskType → execution destination + EventBus event type.
// No reasoning, no policy, no execution.
// ─────────────────────────────────────────────────────────────

import { Task, TaskType, GlideEventType } from '../kernel/types';

export interface RouteResult {
  destination: string;       // human-readable label (for logging)
  eventType:   GlideEventType; // event emitted on EventBus to trigger execution
  priority?:   number;
}

// ── Routing Table ─────────────────────────────────────────────
// TaskType → RouteResult
// Extend here when adding new task types.

const ROUTING_TABLE: Record<TaskType, RouteResult> = {
  skill_execution: {
    destination: 'runtime.executor',
    eventType:   'task.executing',
  },
  goal_pursuit: {
    destination: 'runtime.orchestrator',
    eventType:   'task.executing',
  },
  reflection: {
    destination: 'cognition.conscious',
    eventType:   'conscious.reflection',
  },
  memory_write: {
    destination: 'state.memory',
    eventType:   'memory.write',
  },
  system_check: {
    destination: 'kernel.health',
    eventType:   'task.executing',
  },
  human_request: {
    destination: 'runtime.executor',
    eventType:   'task.executing',
  },
};

export class TaskRouter {

  resolve(task: Task): RouteResult {
    const route = ROUTING_TABLE[task.type];

    if (!route) {
      throw new Error(
        `[TaskRouter] No route defined for task type: ${task.type} (task: ${task.id})`
      );
    }

    console.log(
      `[TaskRouter] ${task.id} [${task.type}] → ${route.destination}`
    );

    return {
      ...route,
      priority: task.metadata.priority,
    };
  }

  // Inspect the routing table (useful for diagnostics / ConsciousLoop)
  listRoutes(): Record<string, string> {
    return Object.entries(ROUTING_TABLE).reduce((acc, [type, route]) => {
      acc[type] = route.destination;
      return acc;
    }, {} as Record<string, string>);
  }
}
