// governance/approval-engine.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Approval Engine
// Handles escalation records and approval history.
// Does NOT import Dispatcher. Does NOT route.
// HumanGate (in dispatcher layer) handles the actual async gate.
// This module tracks WHY approvals were requested.
// ─────────────────────────────────────────────────────────────

import { Task, PolicyDecision } from '../kernel/types';

export interface ApprovalRecord {
  taskId:      string;
  intent:      string;
  risk:        string;
  reason:      string;
  requestedAt: number;
  resolvedAt?: number;
  approved?:   boolean;
  approvedBy?: string;
}

export class ApprovalEngine {

  private records: ApprovalRecord[] = [];

  // Called by Dispatcher after PolicyEngine flags requiresHumanApproval.
  // Creates an audit record before HumanGate processes it.
  record(task: Task, decision: PolicyDecision): ApprovalRecord {
    const rec: ApprovalRecord = {
      taskId:      task.id,
      intent:      task.intent,
      risk:        task.metadata.risk,
      reason:      decision.reason,
      requestedAt: Date.now(),
    };
    this.records.push(rec);
    console.log(`[ApprovalEngine] Logged approval request: ${task.id}`);
    return rec;
  }

  // Called after HumanGate resolves.
  resolve(taskId: string, approved: boolean, approvedBy?: string): void {
    const rec = this.records.find(r => r.taskId === taskId);
    if (!rec) return;
    rec.resolvedAt = Date.now();
    rec.approved   = approved;
    rec.approvedBy = approvedBy;
  }

  // Audit access
  getRecord(taskId: string): ApprovalRecord | undefined {
    return this.records.find(r => r.taskId === taskId);
  }

  getPending(): ApprovalRecord[] {
    return this.records.filter(r => r.resolvedAt === undefined);
  }

  getHistory(limit = 50): ApprovalRecord[] {
    return this.records.slice(-limit);
  }
}
