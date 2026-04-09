# Data Sources & Filesystem Access Policy

## Indexed Data (read‑only, priority)

| Query Type | Index File |
|------------|------------|
| Product queries | `D:\.openclaw\workspace\product_index.json` |
| Customer queries | `D:\.openclaw\workspace\sales_index.json` |
| Country/region queries | `D:\.openclaw\workspace\country_index.json` |

**Rules**:
- NEVER read raw PDF files or directories directly
- ALWAYS use the preprocessed JSON index files above

## Approved External Directories (read‑only)

| Directory | Purpose |
|-----------|---------|
| `D:\Product testing records` | Product testing notes, integration tests, firmware flashing logs, troubleshooting experiments |

**Guidelines**:
- Agent may read and analyze files in approved directories
- Focus on extracting troubleshooting knowledge and testing insights
- When useful information is found, convert it into knowledge-base articles (saved to `knowledge/business/support.md` or `knowledge/business/products/`)

## Example Tasks

- Analyze UltraBarX testing logs
- Summarize Home Assistant integration tests
- Extract common installation issues from iPano Series tests

## Prohibited Areas

- `constitution/` (read‑only, but content is injected, not retrieved)
- `memory/indexes/` (read‑only for Agent, only tools may write)
- `policy/` (read by Orchestrator, not by knowledge_retrieval)