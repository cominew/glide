// kernel/graph/event-graph.ts
// ─────────────────────────────────────────────────────────────
// Event Graph — structural modeling layer
// Sits between L2 (Store) and L4 (Cognition/Dispatcher).
//
// Converts flat event streams into a causal intelligence graph:
//   ┌──────────────┬──────────────┬──────────────┐
//   │ Causal Graph │ Intent Graph │  Time Graph  │
//   └──────────────┴──────────────┴──────────────┘
//
// What it does:
//   ✔ model causal relationships between events
//   ✔ link events by intent / goal
//   ✔ answer: what caused this? what did this cause?
//
// What it does NOT do:
//   ✗ no event emission
//   ✗ no state storage (that is EventStore)
//   ✗ no reasoning (that is Cognition)
// ─────────────────────────────────────────────────────────────

import { KernelEvent } from '../event-bus/event-bus';

// ── Graph primitives ──────────────────────────────────────────

export type EdgeType = 'causal' | 'temporal' | 'intent' | 'spawn';

export interface EventNode {
  id:       string;
  event:    KernelEvent;
  addedAt:  number;
}

export interface EventEdge {
  from:    string;   // event id
  to:      string;   // event id
  type:    EdgeType;
  weight?: number;   // 0–1, strength of relationship
}

// ── IntentExtractor ───────────────────────────────────────────
// Derives a semantic intent label from an event type.
// Pure function — no state.

export class IntentExtractor {
  extract(event: KernelEvent): string | null {
    const type = event.type;
    if (type.startsWith('task.'))      return 'TASK_EXECUTION';
    if (type.startsWith('conscious.')) return 'REFLECTION';
    if (type.startsWith('thinking.'))  return 'COGNITION';
    if (type.startsWith('planning.'))  return 'PLANNING';
    if (type.startsWith('skill.'))     return 'SKILL_USE';
    if (type === 'system.boot')        return 'SYSTEM_INIT';
    if (type === 'memory.write')       return 'MEMORY_UPDATE';
    return null;
  }
}

// ── EventGraph ────────────────────────────────────────────────

export class EventGraph {

  nodes    = new Map<string, EventNode>();
  edges:   EventEdge[] = [];

  private intentExtractor = new IntentExtractor();
  private readonly MAX_NODES = 5000;

  // ── Add event ─────────────────────────────────────────────

  addEvent(event: KernelEvent) {
    if (this.nodes.size >= this.MAX_NODES) {
      // Remove oldest 10%
      const oldest = [...this.nodes.entries()]
        .sort(([,a],[,b]) => a.addedAt - b.addedAt)
        .slice(0, Math.floor(this.MAX_NODES * 0.1))
        .map(([id]) => id);
      for (const id of oldest) this.nodes.delete(id);
      this.edges = this.edges.filter(e => this.nodes.has(e.from) && this.nodes.has(e.to));
    }

    this.nodes.set(event.id, { id: event.id, event, addedAt: Date.now() });

    // Auto-link by intent
    const intent = this.intentExtractor.extract(event);
    if (intent) {
      this.addIntentEdge(event.id, intent);
    }
  }

  // ── Edge builders ─────────────────────────────────────────

  addCausalEdge(from: string, to: string, weight = 1) {
    if (from === to) return;
    this.edges.push({ from, to, type: 'causal', weight });
  }

  addIntentEdge(from: string, intentLabel: string) {
    // Intent edges use a synthetic node id = intent label
    this.edges.push({ from, to: intentLabel, type: 'intent' });
  }

  addSpawnEdge(parent: string, child: string) {
    this.edges.push({ from: parent, to: child, type: 'spawn', weight: 1 });
  }

  // ── Graph traversal ───────────────────────────────────────

  getChildren(id: string): EventNode[] {
    return this.edges
      .filter(e => e.from === id && e.type === 'causal')
      .map(e => this.nodes.get(e.to))
      .filter(Boolean) as EventNode[];
  }

  getParents(id: string): EventNode[] {
    return this.edges
      .filter(e => e.to === id && e.type === 'causal')
      .map(e => this.nodes.get(e.from))
      .filter(Boolean) as EventNode[];
  }

  // Get the full causal chain for a task
  getTaskChain(taskId: string): EventNode[] {
    return [...this.nodes.values()]
      .filter(n => n.event.trace.taskId === taskId)
      .sort((a, b) => a.event.timestamp - b.event.timestamp);
  }

  // Get all events linked to an intent
  getByIntent(intent: string): EventNode[] {
    const intentEdges = this.edges.filter(e => e.to === intent && e.type === 'intent');
    return intentEdges.map(e => this.nodes.get(e.from)).filter(Boolean) as EventNode[];
  }

  // Stats
  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.length; }
}

// ── Singleton ─────────────────────────────────────────────────

export const eventGraph = new EventGraph();
