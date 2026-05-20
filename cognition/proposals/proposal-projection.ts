// cognition/proposals/proposal-projection.ts
// 纯事件投影：从事件重建提案状态，不写任何状态
import { EventBus } from '../../kernel/event-bus/event-bus.js';

export type ProposalCategory =
  | 'optimization'
  | 'evolution'
  | 'healing'
  | 'action'
  | 'memory'
  | 'learning';

export type ProposalState = 'draft' | 'approved' | 'rejected' | 'deferred' | 'expired';

// ⭐ 补充 Proposal 接口定义
export interface Proposal {
  id: string;
  category: ProposalCategory;
  title: string;
  description?: string;
  reasoning?: string;
  impact: 'low' | 'medium' | 'high';
  state: ProposalState;
  createdAt: number;
  expiresAt?: number;
  source: string;
  taskId?: string;
  executionIntent?: { type: string; payload: any };
}

export class ProposalProjection {
  private proposals = new Map<string, Proposal>();
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // ⭐ 补充属性

  constructor(private bus: EventBus) {
    this.registerListeners();
  }

  // ⭐ propose 方法不变，使用自身属性
  propose(params: Omit<Proposal, 'id' | 'state' | 'createdAt'>) {
    this.bus.emitEvent(
      'proposal.created',
      {
        proposalId: `prop_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        category: params.category,
        title: params.title,
        description: params.description,
        reasoning: params.reasoning,
        impact: params.impact,
        executionIntent: params.executionIntent,
        taskId: params.taskId,
        source: params.source ?? 'field.observation',
        createdAt: Date.now(),
        expiresAt: Date.now() + this.DEFAULT_TTL_MS, // 现在可以正常使用
      },
      'COGNITION'
    );
  }

  // 请求审批等动作（不直接修改本地状态）
  approve(id: string, by = 'human') {
    this.bus.emitEvent('proposal.approved.requested', { proposalId: id, approvedBy: by }, 'AUTHORITY' as any);
  }

  reject(id: string, by = 'human', reason?: string) {
    this.bus.emitEvent('proposal.rejected.requested', { proposalId: id, rejectedBy: by, reason }, 'AUTHORITY' as any);
  }

  defer(id: string, by = 'human', reason?: string) {
    this.bus.emitEvent('proposal.deferred.requested', { proposalId: id, deferredBy: by, reason }, 'AUTHORITY' as any);
  }

  // ⭐ 修改：使用 onAny 监听所有事件
  private registerListeners() {
    this.bus.onAny((event) => {
      this.apply(event);
    });
  }

  private apply(event: any) {
    const t = event.type;
    const p = event.payload;

    switch (t) {
      case 'proposal.created': {
        this.proposals.set(p.proposalId, {
          id: p.proposalId,
          category: p.category,
          title: p.title,
          description: p.description,
          reasoning: p.reasoning,
          impact: p.impact,
          state: 'draft',
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
          source: p.source,
          taskId: p.taskId,
          executionIntent: p.executionIntent,
        });

        this.bus.emitEvent('proposal.arisen', { proposalId: p.proposalId }, 'SYSTEM');
        break;
      }

      case 'reality.collapsed': {
        const prop = this.proposals.get(p.proposalId);
        if (prop) {
          prop.state = p.decision === 'approve' ? 'approved' : 'rejected';
          (prop as any).resolvedAt = p.collapsedAt;
        }
        break;
      }

      case 'proposal.approved': {
        const prop = this.proposals.get(p.proposalId);
        if (prop) { prop.state = 'approved'; (prop as any).resolvedAt = Date.now(); }
        break;
      }
      case 'proposal.rejected': {
        const prop = this.proposals.get(p.proposalId);
        if (prop) { prop.state = 'rejected'; (prop as any).resolvedAt = Date.now(); }
        break;
      }
      case 'proposal.deferred': {
        const prop = this.proposals.get(p.proposalId);
        if (prop) { prop.state = 'deferred'; (prop as any).resolvedAt = Date.now(); }
        break;
      }
    }
  }

  getById(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }

  getAll(): Proposal[] {
    return [...this.proposals.values()];
  }

  getPending(): Proposal[] {
    return [...this.proposals.values()].filter(p => p.state === 'draft' || p.state === 'deferred');
  }
}