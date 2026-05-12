import { EventBus } from '../../kernel/event-bus/event-bus.js';
import type { GlideEvent, EventSource } from '../../kernel/event-bus/event-contract.js';

const SYSTEM_EVENTS = {
  ARCHITECTURE_DRIFT: 'system.architecture.drift',
} as const;

const EVENT_SOURCES = {
  KERNEL: 'KERNEL',
  RUNTIME: 'RUNTIME',
  COGNITION: 'COGNITION',
  DISPATCHER: 'DISPATCHER',
  GUARDIAN: 'GUARDIAN',
} as const;

export class ArchitectureGuardian {
  private violationCount = 0;

  constructor(private bus: EventBus) {}

  start() {
    this.bus.onAny((event: GlideEvent) => {
      this.inspect(event);
    });
    console.log('[Guardian] Architecture Guardian online');
  }

  private inspect(event: GlideEvent) {
    if (event.source === EVENT_SOURCES.GUARDIAN) return;

    this.checkKernelCognition(event);
    this.checkRuntimeDecision(event);
    this.checkCognitionExecution(event);
  }

  private checkKernelCognition(event: GlideEvent) {
    if (event.source === EVENT_SOURCES.KERNEL && event.type.startsWith('llm.')) {
      this.raiseDrift('I-G1: Kernel emitted cognitive event (llm.*)', event);
    }
  }

  private checkRuntimeDecision(event: GlideEvent) {
    if (event.source === EVENT_SOURCES.RUNTIME && event.type === 'decision.made') {
      this.raiseDrift('I-G2: Runtime made decision (decision.made)', event);
    }
  }

  private checkCognitionExecution(event: GlideEvent) {
    if (event.source === EVENT_SOURCES.COGNITION && event.type.startsWith('action.execute')) {
      this.raiseDrift('I-G3: Cognition attempted direct execution (action.execute.*)', event);
    }
  }

  private raiseDrift(reason: string, event: GlideEvent) {
    this.violationCount++;
    console.warn(`[Guardian] ⚠ Architecture drift detected: ${reason}`);
    console.warn(`           Source: ${event.source} | Type: ${event.type} | ID: ${event.id}`);

    this.bus.emitEvent(
      SYSTEM_EVENTS.ARCHITECTURE_DRIFT,
      {
        reason,
        originalEventId: event.id,
        originalSource: event.source,
        originalType: event.type,
        violationNumber: this.violationCount,
      },
      EVENT_SOURCES.GUARDIAN as EventSource,
    );
  }

  getViolationCount(): number {
    return this.violationCount;
  }
}