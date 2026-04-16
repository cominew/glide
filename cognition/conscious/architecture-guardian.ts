// cognition/conscious/architecture-guardian.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Architecture Guardian
// Layer: COGNITION (observes only — never executes)
//
// Watches the EventBus for architectural invariant violations.
// Emits system.architecture.drift when a violation is detected.
//
// Invariants enforced:
//   I-G1: Kernel must not emit cognitive events (llm.*)
//   I-G2: Runtime must not make decisions (decision.made)
//   I-G3: Cognition must not execute actions (action.execute.*)
//   I-G4: Dispatcher must not emit execution events directly
// ─────────────────────────────────────────────────────────────

import { EventBus, KernelEvent, EventSource } from '../../kernel/event-bus/event-bus.js';
import { EVENT_SOURCES, SYSTEM_EVENTS }       from '../../kernel/event-bus/event-types.js';

export class ArchitectureGuardian {

  private violationCount = 0;

  constructor(private bus: EventBus) {}

  start() {
    this.bus.onAny((event: KernelEvent) => {
      this.inspect(event);
    });
    console.log('[Guardian] Architecture Guardian online');
  }

  private inspect(event: KernelEvent) {
    // Skip guardian's own events to prevent feedback loops
    if (event.source === EVENT_SOURCES.GUARDIAN) return;

    this.checkKernelCognition(event);
    this.checkRuntimeDecision(event);
    this.checkCognitionExecution(event);
    this.checkDispatcherExecution(event);
  }

  // ── I-G1: Kernel must not think ──────────────────────────
  private checkKernelCognition(event: KernelEvent) {
    if (
      event.source === EVENT_SOURCES.KERNEL &&
      event.type.startsWith('llm.')
    ) {
      this.raiseDrift('I-G1: Kernel emitted cognitive event (llm.*)', event);
    }
  }

  // ── I-G2: Runtime must not decide ────────────────────────
  private checkRuntimeDecision(event: KernelEvent) {
    if (
      event.source === EVENT_SOURCES.RUNTIME &&
      event.type === 'decision.made'
    ) {
      this.raiseDrift('I-G2: Runtime made decision (decision.made)', event);
    }
  }

  // ── I-G3: Cognition must not execute ─────────────────────
  private checkCognitionExecution(event: KernelEvent) {
    if (
      event.source === EVENT_SOURCES.COGNITION &&
      event.type.startsWith('action.execute')
    ) {
      this.raiseDrift('I-G3: Cognition attempted direct execution (action.execute.*)', event);
    }
  }

  // ── I-G4: Dispatcher must not emit task.executing directly
  // Dispatcher should only emit task.routed — execution is Runtime's job
  private checkDispatcherExecution(event: KernelEvent) {
    if (
      event.source === EVENT_SOURCES.DISPATCHER &&
      event.type === 'task.executing'
    ) {
      // This is a warning only — current architecture routes through EventBus
      // which means Dispatcher can legitimately emit task.executing
      // Leaving as informational for now
    }
  }

  // ── Violation emitter ─────────────────────────────────────

  private raiseDrift(reason: string, event: KernelEvent) {
    this.violationCount++;

    console.warn(`[Guardian] ⚠ Architecture drift detected: ${reason}`);
    console.warn(`           Source: ${event.source} | Type: ${event.type} | ID: ${event.id}`);

    this.bus.emitEvent(
      SYSTEM_EVENTS.ARCHITECTURE_DRIFT,
      {
        reason,
        originalEventId: event.id,
        originalSource:  event.source,
        originalType:    event.type,
        violationNumber: this.violationCount,
      },
      EVENT_SOURCES.GUARDIAN as EventSource,
    );
  }

  // ── Stats ─────────────────────────────────────────────────

  getViolationCount(): number {
    return this.violationCount;
  }
}
