export interface TraceEvent {
  taskId: string;
  type: string;
  timestamp: number;
  data: any;
}

export class Trace {
  private logs: TraceEvent[] = [];

  add(event: TraceEvent) {
    this.logs.push(event);
  }

  getAll() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }
}

export const trace = new Trace();