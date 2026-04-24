import { GlideEvent } from './event-contract';

const SYSTEM_EVENTS = new Set([
  'kernel.boot',
  'system.ready',
  'session.created',
]);

const activeTasks = new Set<string>();

export function validateEvent(event: GlideEvent) {

  const taskId = event.trace?.taskId;

  // ① lineage 必须存在
  if (!taskId && !SYSTEM_EVENTS.has(event.type)) {
    throw new Error(`[Kernel] Event without lineage: ${event.type}`);
  }

  // ② task 打开
  if (event.type === 'task.routed') {
    activeTasks.add(taskId!);
  }

  // ③ 非存在宇宙禁止发声
  if (taskId && !activeTasks.has(taskId)) {
    throw new Error(
      `[Kernel] Event outside reality: ${event.type}`
    );
  }

  // ④ task 关闭
  if (event.type === 'task.completed' || event.type === 'task.failed') {
    activeTasks.delete(taskId!);
  }
}