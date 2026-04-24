// kernel/event-bus/event-bus.ts
import { EventEmitter } from 'node:events'
import crypto from 'crypto'
import type { GlideEvent, EventSource } from './event-contract'

export class EventBus extends EventEmitter {

  private anyHandlers: Set<(event: GlideEvent) => void> = new Set();

  // 主要事件发射方法
  emitEvent<T>(
    type: string,
    payload: T,
    source: EventSource = 'SYSTEM',
    taskId?: string,
  ): GlideEvent<T> {
    const event: GlideEvent<T> = {
      id: crypto.randomUUID(),
      type,
      source,
      timestamp: Date.now(),
      payload,
      trace: { taskId },
    }

    super.emit(type, event)          // 通知所有通过 .on() 订阅的监听器
    this.fanout(event)               // 通知所有通过 .onAny() 订阅的全局监听器
    return event
  }

  // 订阅特定事件类型
  on(type: string, handler: (event: GlideEvent) => void): this {
    super.on(type, handler)
    return this
  }

  // 兼容旧版调用：接受已构建的事件对象或原始 payload
  emit(type: string, payloadOrEvent: any, source?: EventSource, taskId?: string): boolean {
    if (payloadOrEvent && typeof payloadOrEvent === 'object' && 'id' in payloadOrEvent && 'timestamp' in payloadOrEvent) {
      super.emit(type, payloadOrEvent)
      this.fanout(payloadOrEvent)
      return true
    }
    this.emitEvent(type, payloadOrEvent, source ?? 'SYSTEM', taskId)
    return true
  }

  // 订阅所有事件（通配符）
  onAny(handler: (event: GlideEvent) => void): void {
    this.anyHandlers.add(handler);
  }

  offAny(handler: (event: GlideEvent) => void): void {
    this.anyHandlers.delete(handler);
  }

  private fanout(event: GlideEvent): void {
    for (const h of this.anyHandlers) {
      try { h(event) } catch {}
    }
  }
}

export const globalEventBus = new EventBus()