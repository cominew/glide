// cognition/observers/projection-witness.ts
import { EventBus } from '../../kernel/event-bus/event-bus.js';

export function registerProjectionWitness(bus: EventBus) {

  // ── 因果闭合 → 现实更新 + 答案显现 ──────────────────
  bus.on('causality.closed', (event) => {
    const { chainId, fragments } = event.payload;
    const narrative = fragments.find((f: any) =>
      f.name === 'persona.summary' ||
      f.name === 'reasoning_result' ||
      f.name === 'ai_response'
    );

    bus.emitEvent('reality.updated', {
      chainId,
      hasNarrative: !!narrative,
      fragmentCount: fragments.length,
      timestamp: Date.now(),
    }, 'COGNITION');

    if (narrative) {
      bus.emitEvent('answer.manifested', {
        chainId,
        narrative: narrative.value,
        fragments,
        timestamp: Date.now(),
      }, 'COGNITION');
    }
  });

  // ── 答案就绪 → 投影 + 心智沉降 ──────────────────────
  bus.on('answer.ready', (event) => {
    const fragments = event.payload?.fragments ?? [];
    const narrative = fragments.find((f: any) =>
      f.name === 'persona.summary' ||
      f.name === 'reasoning_result' ||
      f.name === 'ai_response'
    );
    const scopeId = event.payload?.scopeId ?? event.trace?.scopeId;

    // ⭐ 补上之前的缺失参数 'COGNITION'
    bus.emitEvent('answer.projected', {
      narrative: narrative?.value ?? null,
      fragments,
      scopeId,
      timestamp: Date.now(),
    }, 'COGNITION');

    bus.emitEvent('mind.settling', {
      state: 'settling',
      cause: 'answer_projected',
      timestamp: Date.now(),
    }, 'COGNITION');
  });

  // ── 反射完成 → 若有答案则投影 ───────────────────────
  bus.on('reflection.completed', (event) => {
    const reflection = event.payload;
    if (reflection?.answer) {
      bus.emitEvent('answer.projected', {
        answer: reflection.answer,
        fragments: reflection.fragments ?? [],
        scopeId: reflection.scopeId ?? event.trace?.scopeId,
        timestamp: Date.now(),
      }, 'COGNITION');
    }
  });

  // ── 提案创建 → 投影到议程 + 必要时请求权威 ───────────
  bus.on('proposal.created', (event) => {
    const p = event.payload;

    // 所有提案都投影到 Agenda
    bus.emitEvent('proposal.arisen', {
      proposal: p,
      timestamp: Date.now(),
    }, 'COGNITION');

    // 仅高影响且非 healing 的提案需要人类权威
    if (p.category !== 'healing' && p.impact === 'high') {
      bus.emitEvent('authority.required', {
        proposal: p,
        timestamp: Date.now(),
      }, 'COGNITION');
    }
  });

  // ── 觉知扰动 → 心智唤醒 ──────────────────────────────
  bus.on('awareness.disturbance', (event) => {
    bus.emitEvent('mind.aware', {
      state: 'aware',
      cause: event.payload?.summary ?? 'disturbance',
      timestamp: Date.now(),
    }, 'COGNITION');
  });

  // ── 答案投影后 → 心智沉降信号 ─────────────────────────
  bus.on('answer.projected', (event) => {
    bus.emitEvent('mind.settling', {
      state: 'settling',
      timestamp: Date.now(),
    }, 'COGNITION');
  });
}