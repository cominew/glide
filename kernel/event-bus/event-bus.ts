// kernel/event-bus/event-bus.ts
// Event bus implementation for agent events
// This module defines the AgentEventBus class, which extends Node.js's EventEmitter to provide a structured way to emit and listen for agent-related events. It also includes heartbeat management for tasks and a global singleton instance for easy access throughout the application.
// The AgentEventBus class provides methods to emit events, subscribe to specific event types, and manage task heartbeats. The globalEventBus instance allows for a centralized event bus that can be used across different modules without needing to pass around instances. Additionally, a glideEventBus is provided for backward compatibility with older event formats, translating them into the new structured events emitted by the globalEventBus.

import { EventEmitter } from 'events';
import crypto from 'crypto';
  

export type BaseEvent<T = any> = {
  id: string;
  type: string;
  taskId?: string;
  timestamp: number;
  payload: T;
};

export class EventBus extends EventEmitter {

  emitEvent<T>(type: string, payload: T, taskId?: string): void {
    const event: BaseEvent<T> = {
      id: crypto.randomUUID(),
      type,
      taskId,
      timestamp: Date.now(),
      payload,
    };
    super.emit(type, event);
    super.emit('*', event);
  }

  // Override emit to match EventEmitter signature
  emit(type: string | symbol, ...args: any[]): boolean;
  // Helper overload for our typed event emission
  emit<T>(type: string, payload: T, taskId?: string): boolean;
  emit(type: string | symbol, ...args: any[]): boolean {
    // If first arg is string and second arg looks like payload object (not an event object)
    if (typeof type === 'string' && args.length > 0 && !this.isBaseEvent(args[0])) {
      const [payload, taskId] = args;
      this.emitEvent(type, payload, taskId);
      return true;
    }
    // Otherwise, delegate to super.emit (for EventEmitter native behavior)
    return super.emit(type, ...args);
  }

  // Helper to check if an object is a BaseEvent
  private isBaseEvent(obj: any): boolean {
    return obj && typeof obj === 'object' && 'type' in obj && 'payload' in obj && 'timestamp' in obj;
  }

  onEvent(type: string, handler: (e: BaseEvent<any>) => void): this {
    super.on(type, handler);
    return this;
  }

  // Alias for onEvent
  on(type: string, handler: (e: BaseEvent<any>) => void): this {
    return this.onEvent(type, handler);
  }

  onAny(handler: (e: BaseEvent<any>) => void): this {
    super.on('*', handler);
    return this;
  }

  offAny(handler: (e: BaseEvent<any>) => void): this {
    super.off('*', handler);
    return this;
  }
}

export const globalEventBus = new EventBus();