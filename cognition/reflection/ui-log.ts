// cognition/reflection/ui-log.ts
// Consciousness Projection Surface

import { EventBus } from '../../kernel/event-bus/event-bus';

export interface UILogEvent {
  message: string;
  time: number;
}

type Listener = (event: UILogEvent) => void;

const listeners: Listener[] = [];

export function attachUILog(bus: EventBus) {

  bus.on('conscious.reflection', e => {
    emit(`[Reflection] ${e.payload.type}`);
  });

  bus.on('witness.proposal.emerged', e => {
    emit(`[Proposal] ${e.payload.title}`);
  });

}

export function onUILog(listener: Listener) {
  listeners.push(listener);
}

function emit(message: string) {

  const event = {
    message,
    time: Date.now(),
  };

  console.log(message);

  for (const l of listeners) {
    try { l(event); } catch {}
  }
}