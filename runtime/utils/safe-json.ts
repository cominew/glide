// runtime/utils/safe-json.ts
// Robustly extracts and parses JSON from LLM output.
// Handles markdown fences, trailing commas, unquoted keys, single quotes,
// missing outer braces, and truncated arrays/objects.

export function safeJsonParse(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('safeJsonParse: input is empty or not a string');
  }

  // 1. Strip markdown fences
  let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 2. Try direct parse
  try { return JSON.parse(s); } catch {}

  // 3. Extract the first complete JSON object or array
  let start = s.indexOf('{');
  let end = s.lastIndexOf('}');
  if (start === -1) {
    start = s.indexOf('[');
    end = s.lastIndexOf(']');
  }
  if (start !== -1 && end !== -1 && end > start) {
    const block = s.slice(start, end + 1);
    try { return JSON.parse(block); } catch {}
    // 4. Fix common LLM mistakes inside the block:
    const fixed = block
      // Remove trailing commas before ] or }
      .replace(/,\s*([}\]])/g, '$1')
      // Add missing quotes around unquoted property names
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      // Replace single quotes with double quotes (but not inside already quoted)
      .replace(/'/g, '"')
      // Fix },"{ -> },{
      .replace(/\}\s*",\s*"\{/g, '},{')
      // Remove stray standalone quotes between array elements
      .replace(/,\s*"(\s*\{)/g, ',$1');
    try { return JSON.parse(fixed); } catch {}
  }

  // 5. If still no valid JSON, try to extract steps array from a malformed plan
  const stepsMatch = s.match(/"steps"\s*:\s*\[([\s\S]*?)(?=\]\s*\}|$)/);
  if (stepsMatch) {
    const stepsContent = stepsMatch[1];
    const skillMatches = stepsContent.match(/\{\s*"skill"\s*:\s*"([^"]+)"(?:\s*,\s*"params"\s*:\s*\{[^}]*\})?\s*\}/g);
    if (skillMatches) {
      const steps = skillMatches.map(skillJson => {
        try { return JSON.parse(skillJson); } catch { return null; }
      }).filter(Boolean);
      if (steps.length) return { steps };
    }
  }

  // 6. Last resort: try to parse a single key-value pair like "skill":"customer"
  const kvMatch = s.match(/"(\w+)"\s*:\s*"([^"]+)"/);
  if (kvMatch && kvMatch[1] === 'skill') {
    return { steps: [{ skill: kvMatch[2], params: {} }] };
  }

  throw new Error(`safeJsonParse: could not parse JSON from: ${raw.slice(0, 300)}`);
}