
### `policy/auto_approve.md`

```markdown
# Auto‑approval Operations

The following operations do **NOT** require user confirmation and may be executed immediately:

- Any read‑only query (SELECT, GET, retrieval)
- Calling `customer`, `sales`, `knowledge_retrieval`, `support` skills
- Generating reports (not involving external sending)
- Recording failures to `knowledge/failures/` or decisions to `knowledge/decisions/`

The following operations **REQUIRE** explicit user approval:

- Writing new files to `knowledge/` (except automatic failures/decisions)
- Calling `skill_generator` to create new skills
- Modifying any file under `policy/`
- Executing any system command