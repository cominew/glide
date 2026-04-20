// governance/constitution-enforcer.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Constitution Enforcer
//
// The constitution is a GRAVITY FIELD, not an alarm system.
//
// Three tiers:
//   silent    — auto-corrected, no output, no events
//   notice    — visible only in /api/ops audit log
//   critical  — console.error + constitution.violation event
//
// Tier assignment:
//   silent   : background noise, bookkeeping leaks
//   notice   : string literals, excessive cognition density
//   critical : infinite loops, HumanGate bypass, policy skip
// ─────────────────────────────────────────────────────────────

import { EventBus, GlideEvent } from '../kernel/event-bus/event-bus.js';
import { E }                    from '../kernel/event-bus/event-contract.js';
import { ConstitutionalViolation } from './constitutional-violations.js';

type ViolationSeverity = 'silent' | 'notice' | 'critical';

interface ViolationEntry {
  type:      ConstitutionalViolation;
  detail:    string;
  severity:  ViolationSeverity;
  recordedAt: number;
}

// Rolling cognition counter for continuous-cognition detection
interface RollingWindow {
  count:     number;
  windowStart: number;
}

export class ConstitutionEnforcer {

  private auditLog: ViolationEntry[] = [];  // visible in /api/ops only
  private rollingCognition: RollingWindow = { count: 0, windowStart: Date.now() };

  private readonly COGNITION_WINDOW_MS  = 10_000;
  private readonly MAX_COGNITION_NOTICE = 15;   // notice threshold
  private readonly MAX_COGNITION_CRISIS = 40;   // critical threshold

  constructor(private bus: EventBus) {}

  start() {
    this.bus.onAny((event: GlideEvent) => this.inspect(event));
    // No console output on start — constitution is silent by default
  }

  // ── Inspection ────────────────────────────────────────────

  private inspect(event: GlideEvent) {
    // 1. String literal event types (should use E.* constants)
    if (!event.type.includes('.')) {
      this.record(
        ConstitutionalViolation.STRING_EVENT_EMIT,
        `Event type "${event.type}" is not a valid dotted constant`,
        'notice'
      );
    }

    // 2. Continuous cognition detection (rolling window)
    if (this.isCognitionEvent(event)) {
      this.trackCognition(event.timestamp);
    }

    // 3. Scheduler pulse driving cognition — critical violation
    if (event.type === E.CLOCK_PULSE && event.source === 'COGNITION') {
      this.record(
        ConstitutionalViolation.CLOCK_DRIVEN_THINKING,
        'Clock pulse emitted by COGNITION source — scheduler law violated',
        'critical'
      );
    }

    // 4. Internal bookkeeping events silently filtered — no record needed
    // (handled at SSE layer; enforcer does not double-report)
  }

  private trackCognition(timestamp: number) {
    const now = timestamp;
    const elapsed = now - this.rollingCognition.windowStart;

    if (elapsed > this.COGNITION_WINDOW_MS) {
      // Reset window
      this.rollingCognition = { count: 1, windowStart: now };
      return;
    }

    this.rollingCognition.count++;

    if (this.rollingCognition.count === this.MAX_COGNITION_NOTICE) {
      this.record(
        ConstitutionalViolation.CONTINUOUS_COGNITION,
        `${this.rollingCognition.count} cognition events in ${this.COGNITION_WINDOW_MS}ms window`,
        'notice'
      );
    } else if (this.rollingCognition.count === this.MAX_COGNITION_CRISIS) {
      this.record(
        ConstitutionalViolation.CONTINUOUS_COGNITION,
        `CRITICAL: ${this.rollingCognition.count} cognition events in ${this.COGNITION_WINDOW_MS}ms — infinite loop suspected`,
        'critical'
      );
    }
  }

  // ── Recording ─────────────────────────────────────────────

  private record(type: ConstitutionalViolation, detail: string, severity: ViolationSeverity) {
    const entry: ViolationEntry = {
      type, detail, severity, recordedAt: Date.now(),
    };

    // Always add to audit log (visible in /api/ops)
    this.auditLog.push(entry);
    if (this.auditLog.length > 200) this.auditLog = this.auditLog.slice(-200);

    if (severity === 'silent') {
      // No output. Constitution acts as gravity — invisible but real.
      return;
    }

    if (severity === 'notice') {
      // Governance notice — only in audit log, no console, no event
      return;
    }

    // critical — console + event
    console.error(`🚨 [Constitution] ${type}: ${detail}`);
    this.bus.emitEvent(
      E.CONSTITUTION_VIOLATION,
      { type, detail, severity, at: Date.now() },
      'SYSTEM'
    );
  }

  // ── Helpers ───────────────────────────────────────────────

  private isCognitionEvent(event: GlideEvent): boolean {
    return event.source === 'COGNITION'
      || event.type.startsWith('conscious.')
      || event.type.startsWith('proposal.')
      || event.type === E.THINKING_START
      || event.type === E.THINKING_END
      || event.type === E.PLANNING_START
      || event.type === E.PLANNING_END;
  }

  // ── Read-only API (for /api/ops) ──────────────────────────

  getAuditLog(limit = 50): ViolationEntry[] {
    return this.auditLog.slice(-limit);
  }

  getCriticalCount(): number {
    return this.auditLog.filter(e => e.severity === 'critical').length;
  }

  getNoticeCount(): number {
    return this.auditLog.filter(e => e.severity === 'notice').length;
  }
}
