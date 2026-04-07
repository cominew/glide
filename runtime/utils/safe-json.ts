// runtime/utils/safe-json.ts
//
// Robustly extracts and parses JSON from LLM output.
// LLMs often produce: markdown fences, trailing commas, extra quotes,
// or embedded syntax errors. This tries multiple recovery strategies.

export function safeJsonParse(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('safeJsonParse: input is empty or not a string');
  }

  // 1. Strip markdown fences
  let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 2. Try direct parse
  try { return JSON.parse(s); } catch {}

  // 3. Extract outermost {...} block
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const block = s.slice(start, end + 1);
    try { return JSON.parse(block); } catch {}

    // 4. Fix common LLM mistakes inside the block:
    const fixed = block
      // Remove trailing commas before ] or }
      .replace(/,\s*([}\]])/g, '$1')
      // Fix "},"{  →  },{  (LLM sometimes adds extra quote between objects)
      .replace(/\}\s*",\s*"\{/g, '},{')
      // Fix },"{ → },{
      .replace(/\},\s*"\{/g, ',{"')
      // Remove stray standalone quotes between array elements
      .replace(/,\s*"(\s*\{)/g, ',$1');

    try { return JSON.parse(fixed); } catch {}
  }

  throw new Error(`safeJsonParse: could not parse JSON from: ${raw.slice(0, 300)}`);
}
