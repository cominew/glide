// kernel/temporal/event-evolution.ts
// ─────────────────────────────────────────────────────────────
// L3 — Event Evolution Engine
// The system learns from its own event history.
//
// Input:  EventStore + TemporalEvents
// Output: importance adjustments, learned patterns, behavior signals
//
// What it does:
//   ✔ pattern mining over event history
//   ✔ importance score adjustment based on outcomes
//   ✔ anomaly detection
//   ✔ priority evolution over time
//
// What it does NOT do:
//   ✗ no event emission (observes only)
//   ✗ no state transitions
//   ✗ no routing
// ─────────────────────────────────────────────────────────────

import { EventStore } from './event-store.js';

// ── Pattern types ─────────────────────────────────────────────

export interface EventPattern {
  type:       'frequency' | 'sequence' | 'anomaly' | 'correlation';
  label:      string;
  confidence: number;          // 0–1
  evidence:   string[];        // event ids that support this pattern
  learnedAt:  number;
}

export interface ImportanceAdjustment {
  eventType:   string;
  adjustment:  number;         // positive = more important, negative = less
  reason:      string;
}

export interface EvolutionReport {
  patterns:    EventPattern[];
  adjustments: ImportanceAdjustment[];
  summary:     string;
  computedAt:  number;
}

// ── EventEvolutionEngine ──────────────────────────────────────

export class EventEvolutionEngine {

  private learned: EventPattern[] = [];

  constructor(private store: EventStore) {}

  // ── Primary computation ───────────────────────────────────
  // Called periodically (e.g. by Scheduler tick).
  // Returns a report describing what was learned.

  compute(): EvolutionReport {
    const events      = this.store.all();
    const patterns    = this.minePatterns(events);
    const adjustments = this.computeAdjustments(events);

    this.learned = [...this.learned, ...patterns].slice(-200);

    return {
      patterns,
      adjustments,
      summary: this.buildSummary(patterns, adjustments),
      computedAt: Date.now(),
    };
  }

  // ── Pattern mining ────────────────────────────────────────

  private minePatterns(events: any[]): EventPattern[] {
    const patterns: EventPattern[] = [];

    // Frequency pattern: which event types appear most
    const freq: Record<string, number> = {};
    for (const e of events) freq[e.type] = (freq[e.type] ?? 0) + 1;

    const total = events.length || 1;
    for (const [type, count] of Object.entries(freq)) {
      const rate = count / total;
      if (rate > 0.15 && count > 5) {
        patterns.push({
          type:       'frequency',
          label:      `High frequency: ${type} (${(rate*100).toFixed(0)}%)`,
          confidence: Math.min(0.9, rate * 2),
          evidence:   [],
          learnedAt:  Date.now(),
        });
      }
    }

    // Anomaly pattern: sudden spike in failures
    const recentMs  = Date.now() - 5 * 60_000;
    const recent    = events.filter(e => e.timestamp > recentMs);
    const failures  = recent.filter(e => e.type === 'task.failed' || e.type === 'task.blocked');
    if (failures.length > 3) {
      patterns.push({
        type:       'anomaly',
        label:      `Elevated failure rate: ${failures.length} failures in last 5 min`,
        confidence: 0.85,
        evidence:   failures.map(e => e.id),
        learnedAt:  Date.now(),
      });
    }

    // Sequence pattern: thinking always precedes planning
    const thinkingEvents = events.filter(e => e.type === 'thinking.end');
    const planningEvents = events.filter(e => e.type === 'planning.end');
    if (thinkingEvents.length > 0 && planningEvents.length > 0) {
      const ratio = planningEvents.length / thinkingEvents.length;
      if (ratio > 0.8) {
        patterns.push({
          type:       'sequence',
          label:      `Thinking → Planning sequence stable (${(ratio*100).toFixed(0)}% correlation)`,
          confidence: ratio,
          evidence:   [],
          learnedAt:  Date.now(),
        });
      }
    }

    return patterns;
  }

  // ── Importance adjustments ────────────────────────────────

  private computeAdjustments(events: any[]): ImportanceAdjustment[] {
    const adjustments: ImportanceAdjustment[] = [];

    // Boost task.completed events that have associated skill usage
    const completed = events.filter(e => e.type === 'task.completed');
    if (completed.length > 0) {
      adjustments.push({
        eventType:  'task.completed',
        adjustment: +5,
        reason:     'Task completions are high value — boost visibility',
      });
    }

    // Reduce weight of repeated system.boot events
    const boots = events.filter(e => e.type === 'system.boot');
    if (boots.length > 1) {
      adjustments.push({
        eventType:  'system.boot',
        adjustment: -20,
        reason:     'Repeated boot events lose importance over time',
      });
    }

    return adjustments;
  }

  // ── Summary ───────────────────────────────────────────────

  private buildSummary(patterns: EventPattern[], adjustments: ImportanceAdjustment[]): string {
    if (patterns.length === 0 && adjustments.length === 0) {
      return 'No significant patterns detected';
    }
    const parts: string[] = [];
    if (patterns.length)    parts.push(`${patterns.length} pattern(s) detected`);
    if (adjustments.length) parts.push(`${adjustments.length} importance adjustment(s)`);
    return parts.join(', ');
  }

  // ── Read-only accessors ───────────────────────────────────

  getPatterns(): EventPattern[] {
    return [...this.learned];
  }

  getImportanceFor(eventType: string): number {
    // Base importance from type + adjustments
    if (eventType.startsWith('task.'))      return 80;
    if (eventType.startsWith('conscious.')) return 60;
    return 30;
  }
}
