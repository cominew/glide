# Memory Strategy — Glide Agent Constitution

## Memory Hierarchy
Short-term Memory (RAM) Long-term Memory (ROM)
───────────────────────────────── ──────────────────────────────────────────────
Conversation context (last 10 turns) knowledge/user/charles.md
Current task variables knowledge/user/sessions/YYYY-MM-DD.md
In‑flight Skill results knowledge/decisions/
knowledge/failures/
memory/indexes/ (structured data)

## Short-term Memory Rules

- Keep last 10 conversation turns (user + assistant each count as one)
- When exceeding 20 turns, distill key information into `knowledge/user/sessions/`
- Clear button: clear frontend display + backend session history

## Long-term Memory Writing Rules

**Auto‑write** (Agent decides):
- User corrections → `knowledge/failures/`
- Successful complex query strategies → `knowledge/decisions/`

**Requires confirmation**:
- User preference updates → `knowledge/user/charles.md`
- New product information → `knowledge/business/products/`

**Prohibited**:
- Writing to `constitution/` (read‑only)
- Writing to `memory/indexes/` (data sources, only dedicated tools may write)

## Memory Cleanup Policy

- `knowledge/user/sessions/`: keep last 30 days, auto‑archive older
- `knowledge/failures/`: keep forever (training data)
- `memory/conversations/`: keep last 90 days

## Phase 2 Reserved Interface

```typescript
interface MemoryEntry {
  type:      'fact' | 'preference' | 'correction' | 'decision';
  content:   string;
  timestamp: number;
  source:    'user' | 'agent' | 'system';
  confidence: number; // 0-1
}