# Glide AI OS — Session Resume

## 1. Current System State

Glide AI OS is currently in **Architecture Alignment Phase → Transition into OS Runtime Definition Phase**.

The system has evolved from an Agent-based framework into an **event-driven AI Operating System prototype** with explicit separation of:

* Intent Layer (Goal generation)
* Authority Layer (Policy + Human gating)
* Execution Layer (Runtime workers)
* Generative Layer (LLM reasoning)
* Observation Layer (ConsciousLoop)

---

## 2. Confirmed Core Architecture

### INTENT LAYER

* GoalEngine → generates goals (desire creation)

### AUTHORITY LAYER (Dispatcher-centered)

* Dispatcher (core control plane)
* Policy Gate (decision validation)
* Human Gate (final override authority)
* Task Router (routing logic)

> Key Rule: Dispatcher is the ONLY authority entry point.

---

### EXECUTION LAYER (Runtime)

* Orchestrator → converts goals to plans
* Executor → executes steps
* Workers → perform isolated execution units
* Task Queue → execution buffer

> Key Rule: Runtime has NO authority or policy logic.

---

### GENERATIVE LAYER

* LLM → reasoning + generation engine (no execution authority)

---

### OBSERVATION LAYER

* ConsciousLoop → monitors system behavior and emits reflections

---

## 3. Kernel / System Layer

* EventBus → system-wide event broadcast mechanism
* Scheduler → timing and ordering coordination
* Runtime Locks → concurrency control

---

## 4. Key Architectural Decision (Critical)

### Dispatcher Model

Glide AI OS is locked into:

> INTERRUPT-DRIVEN DISPATCHER MODEL

NOT pull-based scheduling.

### Meaning:

* Events trigger system activity
* Dispatcher reacts to events (not polling tasks)
* Task creation is a downstream effect, not a primary loop

---

## 5. Governance & Policy Architecture

### Governance Layer (External to Runtime)

Located in:

* /governance

  * constitution-engine.ts
  * constitution-loader.ts
  * policy-engine.ts
  * approval-engine.ts

### Responsibility:

* Defines rules (law layer)
* Does NOT execute runtime logic

---

### Dispatcher Policy Gate (Runtime-side interface)

Located in:

* /dispatcher/policy-gate.ts

### Responsibility:

* Acts as runtime enforcement interface
* Calls governance layer for decisions
* Ensures execution compliance

---

## 6. Hard System Rules

1. Runtime MUST NOT perform policy evaluation
2. Dispatcher is the only authority layer
3. Execution layer is authority-free
4. Human approval is handled only in Dispatcher
5. EventBus is the only system-wide communication backbone
6. Task is a derived artifact, not a source of control

---

## 7. Current Design Goal

Glide AI OS is transitioning into:

> A fully event-driven, interrupt-based AI operating system with strict authority separation and deterministic execution boundaries.

---

## 8. Next Phase (Pending Work)

* Define Dispatcher Constitution (system laws)
* Finalize event lifecycle rules
* Formalize interrupt handling semantics
* Stabilize runtime execution guarantees
* Introduce multi-agent dispatch scaling model

---

## 9. Mental Model Summary

* GoalEngine → Desire
* Dispatcher → Authority & Control Plane
* Runtime → Execution Machine
* LLM → Cognitive Engine
* ConsciousLoop → Meta Observation
* EventBus → System Physics Layer

---

End of Session Resume.
