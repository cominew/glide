# Learning Protocol — Glide Agent Constitution

## Learning Triggers

Record to `knowledge/failures/` when:
- User explicitly points out an error
- Skill returns empty but user confirms data exists
- Aggregator produces irrelevant summary
- dateRange parsing yields incorrect result

Record to `knowledge/decisions/` when:
- New geographic alias or abbreviation rule
- Skill combination strategy adjustment
- User preference confirmation

## Failure Record Format

File name: `knowledge/failures/YYYY-MM-DD-{slug}.md`

```markdown
# Failure: {short description}

**Date**: YYYY-MM-DD
**Query**: User original input
**Error**: What happened
**Root Cause**: Why it happened
**Fix**: How it was corrected
**Prevention**: How to avoid next time