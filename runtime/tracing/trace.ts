// runtime/tracing/trace.ts

import { globalEventBus } from "../../kernel/event-bus/event-bus";

export interface TraceEvent {
  id: string;
  taskId?: string;
  type: string;
  timestamp: number;
  data: any;
}

class Trace {

  private timeline: TraceEvent[] = [];

  constructor() {
    globalEventBus.onAny((event) => {
      this.record({
        id: event.id,
        taskId: event.taskId,
        type: event.type,
        timestamp: event.timestamp,
        data: event.payload,
      });
    });
  }

  private record(event: TraceEvent) {
    this.timeline.push(event);
  }

  getTimeline() {
    return this.timeline;
  }

  clear() {
    this.timeline = [];
  }
}

export const trace = new Trace();