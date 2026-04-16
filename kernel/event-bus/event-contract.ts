export interface GlideEvent<T = any> {
  id: string;
  type: string;
  source: EventSource;
  payload: T;
  timestamp: number;
  taskId?: string;
}