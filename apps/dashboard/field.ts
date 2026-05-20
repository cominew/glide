// apps/dashboard/field.ts
// 全局唯一意识场总线
// 铁律：模块加载时零副作用，不调用任何 API，不访问 DOM

export type FieldEventType = string;

export interface FieldEvent<T = unknown> {
  id:        string;
  type:      FieldEventType;
  payload:   T;
  timestamp: number;
  source?:   string;
}

export type Handler<T = unknown> = (event: FieldEvent<T>) => void;

class FieldBus {
  private readonly typed    = new Map<FieldEventType, Set<Handler>>();
  private readonly wildcard = new Set<Handler>();
  private cleaned           = false;

  emit<T>(type: FieldEventType, payload: T, source?: string): FieldEvent<T> {
    if (this.cleaned) return { id: '', type, payload, timestamp: Date.now(), source };
    const event: FieldEvent<T> = {
      id: crypto.randomUUID(), type, payload, timestamp: Date.now(), source,
    };
    this.typed.get(type)?.forEach(h => { try { h(event as FieldEvent); } catch (e) { console.error('[Field]', e); } });
    this.wildcard.forEach(h =>         { try { h(event as FieldEvent); } catch (e) { console.error('[Field]', e); } });
    return event;
  }

  observe(type: string, handler: Handler): () => void {
    if (!this.typed.has(type)) this.typed.set(type, new Set());
    this.typed.get(type)!.add(handler);
    return () => this.typed.get(type)?.delete(handler);
  }

  observeAll(handler: Handler): () => void {
    if (this.cleaned) return () => {};
    this.wildcard.add(handler);
    return () => this.wildcard.delete(handler);
  }

  clean() {
    this.cleaned = true;
    this.typed.clear();
    this.wildcard.clear();
  }
}

export const field = new FieldBus();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => field.clean());
}