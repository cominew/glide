// cognition/reflection/reflection.ts
import { EventBus } from '../../kernel/event-bus/event-bus';
import { GlideEvent } from '../../kernel/event-bus/event-contract';
import { ProposalProjection } from '../proposals/proposal-projection';

export class Reflection {
  private reflections: any[] = [];

  constructor(
    private bus: EventBus,
    private proposals: ProposalProjection
  ) {
    this.subscribe();
    console.log('[Reflection] awareness field active');
  }

  private subscribe() {
    this.bus.onAny((e: GlideEvent) => {
      if (!e.type.startsWith('witness.')) return;
      this.reflect(e);
    });

    this.bus.on('cognition.anomaly.detected', (e: GlideEvent) => {
      this.proposals.propose({
        category: 'healing',
        title: 'Anomaly detected in previous response',
        description: e.payload?.anomalies?.join('; ') ?? 'Unknown anomaly',
        reasoning: 'Outcome evaluator detected quality issues.',
        impact: 'medium',
        source: 'field.observation'
      });

      // Reflect the anomaly as well
      this.reflect(e);
    });
  }

  private reflect(e: GlideEvent) {
    const r = {
      time: Date.now(),
      type: e.type,
      payload: e.payload
    };
    this.reflections.push(r);

    // Emit classic reflection event (backward compatible)
    this.bus.emitEvent('conscious.reflection', r, 'COGNITION');

    // Existing proposal logic (do not break)
    if (e.type === 'witness.capability.vacuum') {
      this.proposals.propose({
        category: 'evolution',
        title: 'Capability vacuum detected',
        description: 'No skills resonated with the given intent.',
        reasoning: 'Non-resonant field vacuum state observed.',
        impact: 'high',
        source: 'field.observation'
      });
    }

    if (e.type === 'witness.capability.missing') {
      this.proposals.propose({
        category: 'evolution',
        title: 'Missing capability detected',
        description: JSON.stringify(e.payload),
        reasoning: 'Structure incomplete for observed intent.',
        impact: 'medium',
        source: 'field.observation'
      });
    }

    // ── NEW: Projection trigger (one-time, no loop) ────────────────
    // Extract any available narrative answer from the event context.
    // This will be the answer fragment if it exists, otherwise null.
    const fragments = e.payload?.fragments ?? [];
    const narrative = fragments.find((f: any) =>
      f.name === 'persona.summary' ||
      f.name === 'reasoning_result' ||
      f.name === 'ai_response'
    );

    const observation = e.payload?.observation
      ?? e.payload?.summary
      ?? 'A reflective observation occurred.';

    this.bus.emitEvent('reflection.completed', {
      observation,
      anomalies: e.payload?.anomalies ?? [],
      answer: narrative?.value ?? null,
      fragments,
      scopeId: e.payload?.scopeId,
      timestamp: Date.now(),
    }, 'COGNITION');
  }
}
