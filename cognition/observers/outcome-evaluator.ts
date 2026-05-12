// cognition/observers/outcome-evaluator.ts
import type { EventBus } from '../../kernel/event-bus/event-bus.js';
import type { GlideEvent } from '../../kernel/event-bus/event-contract.js';

export function registerOutcomeEvaluator(bus: EventBus) {
  bus.on('causality.closed', (event: GlideEvent) => {
    // Use scopeId consistently
    const scopeId = event.payload?.scopeId ?? event.trace?.scopeId;
    if (!scopeId) return;

    const fragments = event.payload?.fragments ?? [];
    const anomalies = evaluateOutcome(fragments);

    if (anomalies.length > 0) {
      bus.emitEvent('cognition.anomaly.detected', {
        scopeId,
        anomalies
      }, 'COGNITION');
    }

    bus.emitEvent('reflection.created', {
      scopeId,
      observation: anomalies.length > 0 ? anomalies.join('; ') : 'Reality stabilized.'
    }, 'COGNITION');

    // mind.state.entered is already emitted by AnswerWitness — do not repeat
  });
}

function evaluateOutcome(fragments: any[] = []): string[] {
  const anomalies: string[] = [];
  if (!Array.isArray(fragments)) return ['Invalid or missing fragments'];

  const identity = fragments.find(f => f?.name === 'identity.resolved');
  const unresolved = fragments.find(f => f?.name === 'identity.unresolved');
  const profile = fragments.find(f => f?.name === 'profile.data');
  const reasoning = fragments.find(f => f?.name === 'reasoning_result');
  const personaSummary = fragments.find(f => f?.name === 'persona.summary');

  if (unresolved || !identity?.value?.customer) {
    anomalies.push('Customer identity could not be fully resolved.');
  }
  if ((!profile || profile?.value?.unresolved) && reasoning) {
    anomalies.push('Reasoning generated without concrete profile data.');
  }
  if (profile && identity && personaSummary) {
    const country = profile.value?.country;
    const summaryText = personaSummary.value ?? '';
    if (country === 'UK' && /\$/.test(summaryText)) {
      anomalies.push('Currency mismatch detected (UK vs USD).');
    }
  }
  const ambiguous = fragments.find(f => f?.name === 'identity.ambiguous');
  if (ambiguous && !identity) {
    anomalies.push('Ambiguous identity unresolved.');
  }
  return anomalies;
}