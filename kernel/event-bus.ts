// kernel/event-bus.ts

// kernel/event-bus.ts
// 唯一事件总线 —— Glide 的神经系统
// 所有模块只发射事件，不返回结果

import { EventEmitter } from 'events';
import { AgentEvent, AgentEventType, TaskHeartbeatPayload } from './event-types.js';

export class AgentEventBus extends EventEmitter {
  private heartbeats = new Map<string, NodeJS.Timeout>();

  emitEvent<T>(type: AgentEventType, payload: T, taskId: string): void {
    const event: AgentEvent<T> = {
      id:        crypto.randomUUID(),
      type,
      taskId,
      timestamp: Date.now(),
      payload,
    };
    this.emit(type, event);
    this.emit('*', event);
  }

  onEvent(type: AgentEventType, handler: (e: AgentEvent<any>) => void): this {
    this.on(type, handler);
    return this;
  }

  onAny(handler: (e: AgentEvent<any>) => void): this {
    this.on('*', handler);
    return this;
  }

  offAny(handler: (e: AgentEvent<any>) => void): this {
    this.off('*', handler);
    return this;
  }

  startHeartbeat(taskId: string, phase: string, intervalMs = 800): void {
    if (this.heartbeats.has(taskId)) return;
    const startTime = Date.now();
    const timer = setInterval(() => {
      this.emitEvent<TaskHeartbeatPayload>('task:heartbeat', {
        elapsed: Date.now() - startTime,
        phase,
      }, taskId);
    }, intervalMs);
    this.heartbeats.set(taskId, timer);
  }

  updateHeartbeatPhase(taskId: string, phase: string): void {
    this.stopHeartbeat(taskId);
    this.startHeartbeat(taskId, phase);
  }

  stopHeartbeat(taskId: string): void {
    const t = this.heartbeats.get(taskId);
    if (t) { clearInterval(t); this.heartbeats.delete(taskId); }
  }
}

// 全局单例
export const globalEventBus = new AgentEventBus();

// 兼容旧的 glideEventBus 接口（可选，用于过渡）
export const glideEventBus = {
  emit(event: any) {
    // 转换旧事件类型到新事件
    const typeMap: Record<string, AgentEventType> = {
      user_input: 'task:start',
      thinking: 'thinking:end',
      planning: 'planning:end',
      skill_start: 'skill:start',
      skill_result: 'skill:end',
      aggregation: 'aggregation:end',
      final_answer: 'answer:end',
      system: 'log',
    };
    const newType = typeMap[event.type] || 'log';
    globalEventBus.emitEvent(newType, event.payload, event.taskId || 'legacy');
  },
  subscribe(listener: any) {
    return globalEventBus.onAny(listener);
  },
  
};