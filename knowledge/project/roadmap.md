# Glide Development Roadmap

## Phase 1: Stabilise Agent Runtime (Current)

**Goal**: Make the Agent reliable, observable, and self‑correcting.

**Key Tasks**:
- ✅ Skill execution pipeline (Orchestrator)
- ✅ Basic planning + aggregation
- ✅ Frontend dashboard with logs
- 🔄 Fix planning bugs (country, city matching)
- 🔄 Knowledge retrieval performance
- 🔄 Task persistence (save to `runtime/tasks/`)
- 🔄 Simple retry on failure

**Estimated completion**: 1‑2 weeks

## Phase 2: Memory System + Event Driven

**Goal**: Agent remembers history, user preferences, and reacts to events.

**Key Tasks**:
- Long‑term memory (vector store, Chroma or LanceDB)
- Short‑term session memory
- Memory evaluator (compress and summarise)
- Event bus subscriptions for autonomous triggers
- Scheduled tasks (cron)

**Estimated completion**: 2‑3 weeks

## Phase 3: Self‑Evolution

**Goal**: Agent learns from failures and optimises its own behaviour.

**Key Tasks**:
- Failure recording (`knowledge/failures/`)
- Offline analysis script to detect patterns
- Automatic rule generation (update `policy/` or `constitution/`)
- Skill generator improvements (dialogue‑based creation)

**Estimated completion**: 3‑4 weeks

## Phase 4: Silent Automation

**Goal**: Agent executes tasks without human intervention (within safety bounds).

**Key Tasks**:
- Approval thresholds (auto‑approve for read‑only)
- External connectors (Slack, email)
- Autonomous daily reports

**Estimated completion**: 1‑2 months

## Phase 5: Multi‑Agent Society

**Goal**: Decompose skills into independent agents that collaborate.

**Key Tasks**:
- Agent registry
- Inter‑agent communication protocol
- Distributed execution (optional)

**Estimated completion**: 2‑3 months