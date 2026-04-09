# Knowledge Manifest - Glide Knowledge OS

This file defines the three‑layer structure of the knowledge base. The Agent MUST respect these access rules when retrieving information.

## Layer 1: Priority (always search, highest weight)

These files define the Agent's identity, safety rules, and core decision logic. They are loaded into system context at every planning cycle.

**Location**: `constitution/` (outside knowledge, but referenced here for completeness)

| File | Purpose |
|------|---------|
| identity.md | Who I am, core mission, capabilities |
| safety.md | Absolute prohibitions, approval thresholds |
| decision.md | Skill selection, parsing rules, self‑correction |
| learning.md | Failure recording, error patterns |
| memory.md | Memory hierarchy, storage rules |

## Layer 2: On‑Demand (search only when query relates to the domain)

These files are organised by topic. The Agent should retrieve them only when the user's query explicitly or implicitly refers to the corresponding domain.

### Business Domain (`knowledge/business/`)

| Path | Content |
|------|---------|
| `customers/` | Customer profiles, forum posts, interactions |
| `products/` | Product documentation, specs, integration guides |
| `marketing.md` | Marketing strategies, campaign data |
| `support.md` | Support processes, common issues |

### Project Domain (`knowledge/project/`)

| Path | Content |
|------|---------|
| `architecture.md` | System architecture, module descriptions |
| `roadmap.md` | Development phases (Phase 1‑5) |
| `decisions.md` | Architectural Decision Records (ADRs) |

### User Domain (`knowledge/user/`)

| Path | Content |
|------|---------|
| `charles.md` | User profile, preferences, working style |
| `sessions/` | Exported conversation sessions (long‑term memory) |

### Skills Metadata (`knowledge/skills/`)

| Path | Content |
|------|---------|
| `_META_*.md` | Skill usage guidelines, parameter examples, common errors |

## Layer 3: Archive (skip unless explicitly requested)

**Location**: `knowledge/_archive/`

Contains obsolete documents, old versions, or experimental notes. The Agent MUST NOT read from this directory unless the user uses keywords like "archive", "old", "historical", or explicitly asks to search there.

## Access Rules Summary

| Layer | When to search | Example queries |
|-------|----------------|----------------|
| Priority | Always (injected) | (automatic) |
| On‑Demand | Query relates to domain | "show me Astrion features" → products/ |
| Archive | Only when explicitly asked | "find old design document" |

## Updating this Manifest

- Adding a new knowledge file: update the corresponding section
- Changing layer assignment: discuss with Charles before modifying
- Removing a file: move to `_archive/` first, then delete after 30 days