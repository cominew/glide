// skills/customer.skill.ts

import { Skill, SkillContext, SkillResult } from '../kernel/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// skills/ is one level below the project root
const ROOT           = path.resolve(__dirname, '..');
const CUSTOMERS_FILE = path.join(ROOT, 'memory', 'indexes', 'customers', 'customers.json');

let cache: any[] | null = null;

function loadCustomers(): any[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
    return cache!;
  } catch {
    console.warn('[customer.skill] Could not load customers file:', CUSTOMERS_FILE);
    cache = [];
    return cache;
  }
}

export const skill: Skill = {
  name: 'customer',
  description:
    'Retrieve customer information by name or country. ' +
    'Params: name (string, optional), country (string, optional). ' +
    'Returns a list of matching customers with revenue and order count.',
  keywords: ['customer', 'client', 'find', 'who is', 'contact'],

  async execute(input: any, _context: SkillContext): Promise<SkillResult> {
    const customers = loadCustomers();

    let { name, country, query } = input;

    // Allow LLM to pass query text as fallback
    if (!name && !country && query) {
      const q = (query as string).toLowerCase();
      // crude country/name extraction from free text
      const fromMatch = q.match(/from\s+([a-z\s]+)/i);
      if (fromMatch) country = fromMatch[1].trim();
    }

    let filtered = customers;

    if (name) {
      const lc = name.toLowerCase();
      filtered = filtered.filter((c: any) => c.name?.toLowerCase().includes(lc));
    }

    if (country) {
      const lc = country.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.country ?? '').toLowerCase().includes(lc)
      );
    }

    const result = filtered.map((c: any) => ({
      name:       c.name,
      country:    c.country,
      email:      c.email,
      phone:      c.phone,
      orders:     (c.orders ?? []).length,
      revenue:    (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
    }));

    return {
      success: true,
      output: { type: 'customer_list', data: result },
    };
  },
};
