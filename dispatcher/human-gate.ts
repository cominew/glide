// dispatcher/human-gate.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Human Gate
// Final override authority. Holds high-risk tasks for human
// approval before they proceed to execution.
// Dispatcher is the ONLY caller of this module.
// ─────────────────────────────────────────────────────────────

import { Task } from '../kernel/types';

export interface HumanApprovalRequest {
  taskId:    string;
  intent:    string;
  risk:      string;
  reason:    string;
  requestedAt: number;
}

export interface HumanApprovalResult {
  taskId:   string;
  approved: boolean;
  reason:   string;
  resolvedAt: number;
  approvedBy?: string;
}

// Pending approvals waiting for human response
type Resolver = (result: HumanApprovalResult) => void;

export class HumanGate {

  private pending = new Map<string, Resolver>();
  private timeoutMs: number;

  // timeoutMs: how long to wait before auto-rejecting (default 5 min)
  constructor(timeoutMs = 5 * 60 * 1000) {
    this.timeoutMs = timeoutMs;
  }

  // ── Request approval ──────────────────────────────────────
  // Called by Dispatcher when decision.requiresHumanApproval.
  // Returns a promise that resolves when a human responds
  // (or rejects on timeout).

  async request(task: Task): Promise<HumanApprovalResult> {

    const req: HumanApprovalRequest = {
      taskId:      task.id,
      intent:      task.intent,
      risk:        task.metadata.risk,
      reason:      task.policyDecision?.reason ?? 'High-risk task',
      requestedAt: Date.now(),
    };

    console.log(
      `[HumanGate] Approval requested for task ${task.id}: "${task.intent}"`
    );

    // In production: emit to UI / notification system here.
    // For now, auto-approve low+medium risk, hold high risk.
    if (task.metadata.risk !== 'high') {
      return this.autoApprove(task.id, 'Auto-approved: risk below high');
    }

    return new Promise<HumanApprovalResult>((resolve, reject) => {
      this.pending.set(task.id, resolve);

      // Timeout guard
      setTimeout(() => {
        if (this.pending.has(task.id)) {
          this.pending.delete(task.id);
          resolve({
            taskId:     task.id,
            approved:   false,
            reason:     'Human gate timed out — task rejected',
            resolvedAt: Date.now(),
          });
        }
      }, this.timeoutMs);
    });
  }

  // ── Resolve (called by UI / external human input) ─────────

  resolve(taskId: string, approved: boolean, approvedBy?: string): boolean {
    const resolver = this.pending.get(taskId);
    if (!resolver) return false;

    this.pending.delete(taskId);
    resolver({
      taskId,
      approved,
      reason:     approved ? 'Human approved' : 'Human rejected',
      resolvedAt: Date.now(),
      approvedBy,
    });

    console.log(
      `[HumanGate] Task ${taskId} ${approved ? 'APPROVED' : 'REJECTED'} by ${approvedBy ?? 'human'}`
    );

    return true;
  }

  // ── Inspection ────────────────────────────────────────────

  pendingCount(): number {
    return this.pending.size;
  }

  pendingIds(): string[] {
    return Array.from(this.pending.keys());
  }

  // ── Internal helpers ──────────────────────────────────────

  private autoApprove(taskId: string, reason: string): HumanApprovalResult {
    return {
      taskId,
      approved:   true,
      reason,
      resolvedAt: Date.now(),
      approvedBy: 'system:auto',
    };
  }
}
