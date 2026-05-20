// cognition/observers/answer-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';
import { GlideEvent } from '../../kernel/event-bus/event-contract.js';

type CausalPhase = 'qi' | 'cheng' | 'zhuan' | 'he' | 'kong';

interface CausalNode {
  id: string;
  phase: CausalPhase;
  data: any;
  unresolved: boolean;
}

export class AnswerWitness {
  private graphs = new Map<string, CausalNode[]>();
  private closed = new Set<string>();

  constructor(private bus: EventBus) {
    bus.on('input.user', e => this.onInput(e));
    bus.on('skill.output', e => this.onSkillOutput(e));
    bus.on('cognition.reflect', e => this.recordAndCheck(e, 'zhuan'));
    bus.on('cognition.anomaly.detected', e => {
      if (e.payload?.subtype === 'non_resonant_field_vacuum') {
        this.recordAndCheck(e, 'kong');
      }
    });
  }

  private onInput(event: GlideEvent) {
    const chainId = this.extractChainId(event);
    if (!chainId) return;
    if (!this.graphs.has(chainId)) this.graphs.set(chainId, []);
    this.recordNode(event, chainId, 'qi');
  }

private onSkillOutput(event: GlideEvent) {
    const chainId = this.extractChainId(event);
    if (!chainId || this.closed.has(chainId)) return;

    if (!this.graphs.has(chainId)) this.graphs.set(chainId, []);
    this.recordNode(event, chainId, 'cheng');

    const fragments = event.payload?.fragments ?? [];

    if (fragments.some((f: any) =>
        f.name === 'persona.summary' ||
        f.name === 'reasoning_result' ||
        f.name === 'ai_response'
    )) {
        this.tryClose(chainId);
        return;
    }

    if (fragments.some((f: any) => f.name === 'identity.ambiguous')) {
        const allFragments = this.collectFragments(chainId);
        const ambiguous = fragments.find((f: any) => f.name === 'identity.ambiguous');
        const candidates = ambiguous?.value?.candidates ?? [];
        const names = candidates.map((c: any) => c.name).join(', ');

        this.graphs.get(chainId)!.push({
            id: event.id, phase: 'cheng',
            data: {
                fragments: [{
                    type: 'data',
                    name: 'persona.summary',
                    value: `Multiple matches found: ${names}. Please specify which one you want.`,
                    role: 'summary',
                    confidence: 0.9,
                    source: 'answer-witness',
                    phase: 'collapse',
                }]
            },
            unresolved: false,
        });
        this.tryClose(chainId);
        return;
    }

    if (fragments.length === 0) {
      this.bus.emitEvent('knowledge.absent', {
        scopeId: chainId,
        reason: 'no_fragments_produced',
      }, 'COGNITION');

  this.bus.emitEvent('answer.explain_absence', {
    scopeId: chainId,
    narrative: 'No matching records found. Please check your query or specify more details.',
  }, 'COGNITION');
  this.closed.add(chainId); 
  return;
}
  }

  private recordAndCheck(event: GlideEvent, phase: CausalPhase) {
    const chainId = this.extractChainId(event);
    if (!chainId || this.closed.has(chainId)) return;
    if (!this.graphs.has(chainId)) this.graphs.set(chainId, []);
    this.recordNode(event, chainId, phase);
  }

  private recordNode(event: GlideEvent, chainId: string, phase: CausalPhase) {
    this.graphs.get(chainId)!.push({
      id: event.id,
      phase,
      data: event.payload,
      unresolved: this.isUnresolved(event),
    });
  }

  private isUnresolved(event: GlideEvent): boolean {
    const fragments = event.payload?.fragments ?? [];
    return fragments.some((f: any) => f.type === 'query' || f.name === 'unresolved');
  }

  private tryClose(chainId: string) {
    if (this.closed.has(chainId)) return;
    const nodes = this.graphs.get(chainId) ?? [];
    if (nodes.length === 0 || nodes.some(n => n.unresolved)) return;
    
    const fragments = this.collectFragments(chainId);

const hasResolved = fragments.some((f: any) => f.name === 'identity.resolved');
const hasAmbiguous = fragments.some((f: any) => f.name === 'identity.ambiguous');
const hasNarrative = fragments.some((f: any) =>
  f.name === 'persona.summary' || f.name === 'reasoning_result' || f.name === 'ai_response'
);

if (!hasResolved && hasAmbiguous && !hasNarrative) {
  const ambiguousFragment = fragments.find((f: any) => f.name === 'identity.ambiguous');
  const candidates = ambiguousFragment?.value?.candidates ?? [];
  const names = candidates.map((c: any) => c.name).join(', ');

  fragments.push({
    type: 'data',
    name: 'persona.summary',
    value: `Multiple matches found: ${names}. Please specify which one you want.`,
    role: 'summary',
    confidence: 0.9,
    source: 'answer-witness',
    phase: 'collapse',
  });
}
    
    this.closed.add(chainId);
    
    const anchors = extractAnchors(nodes);
    if (anchors.length > 1) {
      this.bus.emitEvent('reality.conflict', {
        chainId, surfaces: anchors.map(a => a.surface), scopeId: chainId
      }, 'COGNITION');
      // 冲突发生时仍允许闭合，但可根据需要调整
    }
    if (anchors.length === 1) {
      this.bus.emitEvent('entity.anchor.created', {
        chainId, entity: anchors[0].surface, confidence: anchors[0].confidence, scopeId: chainId
      }, 'COGNITION');
    }

   const query = nodes.find(n => n.phase === 'qi')?.data?.input?.message ?? '';

  const phaseSet = [...new Set(nodes.map(n => n.phase))];

  this.bus.emitEvent('causality.closed', {
    chainId, scopeId: chainId, phaseSet, nodeCount: nodes.length, fragments, timestamp: Date.now(),
  }, 'COGNITION', { origin: chainId, cause: 'causality.closed', constraint: { requires: [], conflicts: [] }, depth: 0 });

  this.bus.emitEvent('answer.ready', {
    chainId,
    scopeId: chainId,
    fragments,
    query,   
    timestamp: Date.now(),
  }, 'COGNITION', { origin: chainId, cause: 'causality.closed', constraint: { requires: [], conflicts: [] }, depth: 0 });

  this.bus.emitEvent('mind.state.entered', {
    state: 'settled', chainId, scopeId: chainId, timestamp: Date.now(),
  }, 'COGNITION');
}

  private extractChainId(event: GlideEvent): string | undefined {
    return event.payload?.scopeId;
  }

  private collectFragments(chainId: string): any[] {
    const raw = (this.graphs.get(chainId) ?? []).flatMap(n => n.data?.fragments ?? []);
    return flattenFragments(raw);
  }

  destroy() {
    this.graphs.clear();
    this.closed.clear();
  }
}

// 辅助函数保持不变
function flattenFragments(fragments: any[]): any[] {
  const out: any[] = [];
  for (const f of fragments) {
    out.push(f);
    if (f.fragments && Array.isArray(f.fragments)) out.push(...flattenFragments(f.fragments));
  }
  return out;
}

function extractAnchors(nodes: CausalNode[]) {
  const anchors: { surface: string; confidence: number }[] = [];
  for (const node of nodes) {
    for (const frag of node.data?.fragments ?? []) {
      if (frag.name === 'identity.resolved' || frag.name === 'identity.anchor') {
        const name = frag.value?.name ?? frag.value?.entity;
        if (name) anchors.push({ surface: name, confidence: frag.confidence ?? 0.8 });
      }
    }
  }
  return anchors;
}