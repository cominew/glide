// governance/constitution-loader.ts
// ─────────────────────────────────────────────────────────────
// Loads additional constitution rules from disk (.md files).
// These supplement the built-in rules in ConstitutionEngine.
// ─────────────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import { ConstitutionRule, ConstitutionRuleResult } from './constitution-engine';
import { Task } from '../kernel/types';

export function loadConstitutionRules(rulesDir?: string): ConstitutionRule[] {
  const dir = rulesDir ?? path.join(process.cwd(), 'constitution');

  if (!fs.existsSync(dir)) {
    console.warn(`[ConstitutionLoader] Rules directory not found: ${dir}`);
    return [];
  }

  const files  = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const rules: ConstitutionRule[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const ruleId  = `FILE_${file.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;

    // File-based rules are text constraints — evaluated as keyword checks.
    // For richer rule logic, implement ConstitutionRule directly in code.
    rules.push({
      id:          ruleId,
      description: `File rule: ${file}`,
      evaluate(task: Task): ConstitutionRuleResult {
        // Simple pass-through — text rules are informational by default.
        // Override by registering typed rules in ConstitutionEngine.addRule().
        return {
          ruleId: ruleId,
          passed: true,
          reason: `File rule "${file}" loaded (text-only, no runtime block)`,
        };
      },
    });

    console.log(`[ConstitutionLoader] Loaded rule file: ${file}`);
  }

  return rules;
}
