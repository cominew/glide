// kernel/temporal/temporal-event.ts
// -- Temporal Event Schema
// -- Temporal events are the core units of work and interaction in the system, representing everything from user inputs to scheduled tasks and system alerts. This schema defines a comprehensive structure for temporal events, capturing their identity, temporal characteristics, lifecycle states, governance requirements, priority dynamics, cognitive payloads, execution details, observations, memory bindings, visibility levels, and evolution over time.
// -- This schema is designed to be flexible and extensible, allowing for a wide range of event types and use cases while maintaining a consistent structure for processing and analysis.

export interface TemporalEvent {
  /* ======================
     Identity
  ====================== */

  id: string;                // 全局唯一
  type: EventType;           // USER_INPUT / REFLECTION / TASK / ALERT ...
  source: EventSource;       // UI / SYSTEM / MEMORY / HUMAN / SCHEDULER

  parentId?: string;         // 产生它的事件
  correlationId?: string;    // 同一任务链

  /* ======================
     Temporal Dimension ⭐
  ====================== */

  createdAt: number;
  updatedAt: number;

  scheduledAt?: number;      // 未来触发
  startedAt?: number;
  finishedAt?: number;

  ttl?: number;              // 生命周期
  agingScore?: number;       // 随时间自动增长

  /* ======================
     Lifecycle State ⭐
  ====================== */

  state:
    | "NEW"
    | "ACTIVE"
    | "PENDING_APPROVAL"
    | "SCHEDULED"
    | "RUNNING"
    | "WAITING"
    | "BLOCKED"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "ARCHIVED";

  /* ======================
     Governance ⭐
  ====================== */

  approval:
    | "AUTO_ALLOWED"
    | "REQUIRES_HUMAN"
    | "APPROVED"
    | "REJECTED";

  requestedBy?: string;
  approvedBy?: string;

  riskLevel: 1 | 2 | 3 | 4 | 5;

  /* ======================
     Priority Dynamics ⭐
  ====================== */

  importance: number;   // 0–100 (长期价值)
  urgency: number;      // 0–100 (时间压力)

  energyCost?: number;  // token / cpu 预算
  priorityScore?: number;

  /* ======================
     Cognitive Payload
  ====================== */

  intent?: string;
  goal?: string;

  payload: any;

  contextSnapshot?: any;

  /* ======================
     Execution
  ====================== */

  assignedWorker?: string;   // orchestrator / skill / agent
  executionPlan?: any;

  progress?: number;         // 长任务进度

  result?: any;
  error?: string;

  /* ======================
     Observation ⭐
  ====================== */

  observations?: string[];
  feedback?: string;

  qualityScore?: number;     // QC评分
  efficiencyScore?: number;  // QA评分

  /* ======================
     Memory Binding ⭐
  ====================== */

  episodicMemoryId?: string;
  semanticRefs?: string[];

  learned?: boolean;

  /* ======================
     Visibility ⭐
  ====================== */

  visibility:
    | "SYSTEM"
    | "DASHBOARD"
    | "HUMAN_REQUIRED"
    | "BACKGROUND";

  tags?: string[];

  /* ======================
     Event Evolution ⭐
  ====================== */

  spawnedEvents?: string[];
}