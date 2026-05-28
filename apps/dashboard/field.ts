// apps/dashboard/field.ts
// ══════════════════════════════════════════════════════════
//   Potential Field Bus · 势能场总线 (重构版)
// ══════════════════════════════════════════════════════════

export type FieldEventType = string;

// 1. 落地白皮书思想：将普通事件升级为承载因果和潜在概率的“事件种子 (Event Seed)”
export interface EventSeed<T = unknown> {
  id:         string;
  type:       FieldEventType;
  tags:       string[];       // 用于计算语义距离的标签矩阵
  weight:     number;         // 势能权重 (张力大小)
  timestamp:  number;         // 时间坐标
  spatial?:   { x: number; y: number }; // 空间坐标
  payload:    T;              // 显迹数据 (Collapsed Traces)
}

// 投影指令（新增）
export interface ProjectionInstruction {
  id: string;                 // 投影目标 ID（如 'client', 'sales', 'knowledge', 'weather'等）
  action: 'create' | 'update' | 'merge' | 'dissolve';
  level: 'bubble' | 'expanded' | 'hidden';
  priority: number;           // 0-1，坍缩优先级
  payload?: any;              // 片段带入的具象化数据
}

export interface Cluster {
  id: string;
  name: string;
  seeds: EventSeed<any>[];
  totalTension: number;
  state: 'seed' | 'float' | 'resonate' | 'cluster' | 'deliberate' | 'stabilize' | 'dissolve';
}

class ClusterEngine {
  private seeds = new Map<string, EventSeed<any>>();
  private clusters = new Map<string, Cluster>();
  private emitFn: (type: string, payload: any, source?: string) => void;

  // 将 emit 函数注入，避免循环依赖
  constructor(emit: (type: string, payload: any, source?: string) => void) {
    this.emitFn = emit;
  }

  // 落地白皮书的核心公式: resonance = semantic * 0.6 + spatial * 0.2 + temporal * 0.2
  calculateResonance(a: EventSeed<any>, b: EventSeed<any>): number {
    const intersect = a.tags.filter(t => b.tags.includes(t)).length;
    const union = new Set([...a.tags, ...b.tags]).size;
    const semanticScore = union > 0 ? intersect / union : 0;

    let spatialScore = 0;
    if (a.spatial && b.spatial) {
      const dist = Math.hypot(a.spatial.x - b.spatial.x, a.spatial.y - b.spatial.y);
      spatialScore = Math.max(0, 1 - dist / 500);
    }

    const timeDiff = Math.abs(a.timestamp - b.timestamp);
    const temporalScore = Math.max(0, 1 - timeDiff / (1000 * 60 * 60 * 24));

    return semanticScore * 0.6 + spatialScore * 0.2 + temporalScore * 0.2;
  }

  evolveField(newSeed: EventSeed<any>) {
    this.seeds.set(newSeed.id, newSeed);
    let matchedCluster: Cluster | null = null;

    for (const cluster of this.clusters.values()) {
      const totalResonance = cluster.seeds.reduce((sum, seed) => sum + this.calculateResonance(seed, newSeed), 0);
      const avgResonance = totalResonance / cluster.seeds.length;
      if (avgResonance > 0.45) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.seeds.push(newSeed);
      matchedCluster.totalTension += newSeed.weight;
      if (matchedCluster.seeds.length >= 3 && matchedCluster.state === 'float') {
        matchedCluster.state = 'resonate';
      }
      this.notifyClusterUpdate(matchedCluster);
    } else {
      const newClusterId = `cluster_${crypto.randomUUID()}`;
      const newCluster: Cluster = {
        id: newClusterId,
        name: `${newSeed.type} 潜在态`,
        seeds: [newSeed],
        totalTension: newSeed.weight,
        state: 'seed'
      };
      this.clusters.set(newClusterId, newCluster);
      this.notifyClusterUpdate(newCluster);
    }
  }

  private notifyClusterUpdate(cluster: Cluster) {
    this.emitFn('cluster.field.changed', cluster, 'ClusterEngine');
  }
}

class FieldBus {
  public engine: ClusterEngine;
  private readonly handlers = new Map<string, Set<(ev: any) => void>>();
  private wildcardHandlers = new Set<(ev: any) => void>();

  constructor() {
    // 传入 emit 方法绑定到当前实例
    this.engine = new ClusterEngine((type, payload, source) => this.emit(type, payload, source));
  }

  observeAll(handler: (ev: any) => void): () => void {
    this.wildcardHandlers.add(handler);
    return () => this.wildcardHandlers.delete(handler);
  }

  emit(type: string, payload: any, source?: string) {
    const event = { id: crypto.randomUUID(), type, payload, timestamp: Date.now(), source };
    this.handlers.get(type)?.forEach(h => h(event));
    this.wildcardHandlers.forEach(h => h(event));
    if (type === 'reality.seed.inject') {
      this.engine.evolveField(payload as EventSeed<any>);
    }
    return event;
  }

  observe(type: string, handler: (ev: any) => void): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }
}

export const field = new FieldBus();