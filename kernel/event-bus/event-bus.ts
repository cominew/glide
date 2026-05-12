import { EventEmitter } from 'node:events';
import crypto from 'crypto';
import type { GlideEvent, EventSource, EventLineage } from './event-contract';

type AnyHandler = (event: GlideEvent) => void;

export class EventBus extends EventEmitter {
  private anyHandlers: Set<AnyHandler> = new Set();
  private events: GlideEvent[] = [];

  // 核心发射
  emitEvent(
    type: string,
    payload: any,
    source: EventSource,                  // 明确为 EventSource
    lineage?: EventLineage,
    trace?: Record<string, any>
  ): GlideEvent | null {
    if (lineage) {
      // 因果前置检查
      if (lineage.constraint.requires) {
        const allTypes = this.events.map(e => e.type);
        if (!lineage.constraint.requires.every(t => allTypes.includes(t))) return null;
      }
      // answer.ready 唯一性
      if (type === 'answer.ready' && lineage.cause) {
        if (this.events.some(e => e.type === 'answer.ready' && e.lineage?.cause === lineage.cause)) return null;
      }
    }

    const event: GlideEvent = {
      id: crypto.randomUUID(),
      type,
      source,
      timestamp: Date.now(),
      payload,
      trace: trace ?? {},
      lineage: lineage ?? ({} as EventLineage),
    };

    this.events.push(event);
    super.emit(type, event);
    this.fanout(event);
    return event;
  }

  // 兼容旧版 emit
  emit(
    type: string,
    payloadOrEvent: any,
    source: string = 'SYSTEM',             // 旧版允许 string
    trace?: Record<string, any>
  ): boolean {
    const eventSource: EventSource = (source as EventSource) || 'SYSTEM';

    if (this.isGlideEvent(payloadOrEvent)) {
      super.emit(type, payloadOrEvent);
      this.fanout(payloadOrEvent);
      return true;
    }

    this.emitEvent(type, payloadOrEvent, eventSource, undefined, trace);
    return true;
  }

  getAllEvents(): GlideEvent[] { return this.events; }

  on(type: string, handler: (event: GlideEvent) => void): this {
    super.on(type, handler);
    return this;
  }

  onAny(handler: AnyHandler): void { this.anyHandlers.add(handler); }
  offAny(handler: AnyHandler): void { this.anyHandlers.delete(handler); }

  private fanout(event: GlideEvent): void {
    for (const h of this.anyHandlers) {
      try { h(event); } catch {}
    }
  }

  private isGlideEvent(obj: any): obj is GlideEvent {
    return obj && typeof obj === 'object' && 'id' in obj && 'timestamp' in obj;
  }
}

export const globalEventBus = new EventBus();