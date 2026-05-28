// apps/dashboard/interaction.ts
// ══════════════════════════════════════════════════════════
//   Cognitive Deliberation Machine · 认知推演状态机
// ══════════════════════════════════════════════════════════

// 映射白皮书提出的真实因果演化周期
export type ClusterCondition = 
  | "seed"        // 事件种子生成 (潜伏奇点)
  | "float"       // 自由漂移态
  | "approach"    // 语义感应接近
  | "resonate"    // 发生因果共振
  | "cluster"     // 临时现实聚合 (局形成)
  | "deliberate"  // 触发三策推演 (计算性辨析)
  | "stabilize"   // 现实坍缩锁定
  | "dissolve";   // 势能耗尽消散

export class ClusterStateMachine {
  private currentState: ClusterCondition = "seed";
  private clusterId: string;

  constructor(clusterId: string) {
    this.clusterId = clusterId;
  }

  get state() { return this.currentState; }

  // 驱动因果逻辑的演进
  transition(action: { type: string; payload?: any }) {
    const prev = this.currentState;

    switch (this.currentState) {
      case "seed":
        if (action.type === "field.drift") this.currentState = "float";
        break;
      case "float":
        if (action.type === "gravity.pull") this.currentState = "approach";
        break;
      case "approach":
        if (action.type === "semantic.resonance") this.currentState = "resonate";
        break;
      case "resonate":
        if (action.type === "topology.merge") this.currentState = "cluster";
        break;
      case "cluster":
        // 关键突破点：当用户产生深度介入或多维关联度极高时，进入“计算性推演场”
        if (action.type === "user.deliberate" || action.type === "tension.peak") {
          this.currentState = "deliberate";
        }
        break;
      case "deliberate":
        if (action.type === "decision.collapse") this.currentState = "stabilize";
        break;
      case "stabilize":
        if (action.type === "energy.decay") this.currentState = "dissolve";
        break;
      case "dissolve":
        break;
    }

    if (prev !== this.currentState) {
      console.log(`[Causal Chain] Cluster ${this.clusterId}: ${prev} ──> ${this.currentState}`);
    }
  }
}