// kernel/event-bus.ts

export type GlideEventType =
  | 'user_input'
  | 'thinking'
  | 'planning'
  | 'skill_start'
  | 'skill_result'
  | 'aggregation'
  | 'final_answer'
  | 'system';

export interface GlideEvent {
  type: GlideEventType;
  timestamp: number;
  payload?: any;
}

type Listener = (event: GlideEvent) => void;

export class EventBus {
  private listeners: Listener[] = [];

  emit(event: GlideEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const glideEventBus = new EventBus();