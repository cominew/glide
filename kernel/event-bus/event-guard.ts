import { GlideEvent } from './event-contract';

const SYSTEM_EVENTS = new Set([
  'kernel.boot',
  'system.ready',
  'session.created',
]);

export function validateEvent(event: GlideEvent) {

  // ── Lineage Enforcement ─────────────────────

  if (!event.trace?.taskId && !SYSTEM_EVENTS.has(event.type)) {
    throw new Error(
      `[Kernel] Event without lineage: ${event.type}`
    );
  }


  // ── Future Guards (VERY IMPORTANT) ──────────
  // here will live:
  // permission model
  // sandbox policy
  // human-gate enforcement
  // simulation isolation
}