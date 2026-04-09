# Architectural Decision Records (ADR)

This file records significant architectural decisions made during Glide development. Each entry follows the format below.

## ADR-001: Separate Constitution from Policy

**Date**: 2026-04-09  
**Status**: Accepted  

**Context**: The Agent needs immutable core rules (identity, safety) and changeable execution policies (auto‑approval, retry). Mixing them caused confusion about what the Agent can modify.

**Decision**: Create two top‑level directories: `constitution/` (immutable, human‑reviewed) and `policy/` (mutable, can be updated by Agent with confirmation).

**Consequences**:
- `Orchestrator` loads both layers into system context.
- `knowledge_retrieval` does not search `constitution/` or `policy/`.
- Users can modify `policy/` through natural language requests.

---

## ADR-002: Three‑Layer Knowledge Manifest

**Date**: 2026-04-09  
**Status**: Accepted  

**Context**: The `knowledge_retrieval` skill was scanning all `.md` files, causing irrelevant results and slow performance.

**Decision**: Introduce `_MANIFEST.md` with three layers: Priority (always injected), On‑Demand (domain‑specific), Archive (skipped unless explicit).

**Consequences**:
- `knowledge_retrieval` must parse the manifest before searching.
- New knowledge files must be registered in the manifest.
- Archive directory is excluded from search by default.

---

## ADR-003: City/State Matching with Word Boundaries

**Date**: 2026-04-09  
**Status**: Accepted  

**Context**: Using `address.includes("la")` caused false matches for "Australia", "plaza", etc.

**Decision**: Use word‑boundary regex and restrict short terms (length ≤3) to the `city` field only. Expand aliases (LA → Los Angeles) before matching.

**Consequences**:
- `customer` skill now has `CITY_ALIASES` and `STATE_ALIASES`.
- Address field is only searched for terms longer than 3 characters.

---

## ADR-004: Task Persistence (Planned)

**Date**: 2026-04-09  
**Status**: Proposed  

**Context**: After restart, the Agent loses all task history, making debugging and learning difficult.

**Decision**: Persist each task to `runtime/tasks/{taskId}.json` with full timeline. Provide API endpoint for querying.

**Consequences**:
- Increases disk usage, but tasks are small.
- Enables failure analysis and retry across restarts.