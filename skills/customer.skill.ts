// skills/customer.skill.ts

import { Skill, SkillContext, SkillResult } from '../kernel/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT           = path.resolve(__dirname, '..');
const CUSTOMERS_FILE = path.join(ROOT, 'memory', 'indexes', 'customers', 'customers.json');

let cache: any[] | null = null;
function loadCustomers(): any[] {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8')); return cache!; }
  catch { cache = []; return cache; }
}

export const skill: Skill = {
  name: 'customer',
  description:
    'Retrieve customer profiles by name, country, city, or state/region. ' +
    'Returns contact details, order count, revenue, and location. ' +
    'Params: name (string), country (string), city (string), state (string).',

  async execute(input: any, _context: SkillContext): Promise<SkillResult> {
    const customers = loadCustomers();
    const { name, country, city, state, query } = input;

    let filtered = customers;

    // Name filter
    if (name) {
      const lc = name.toLowerCase();
      filtered = filtered.filter((c: any) => c.name?.toLowerCase().includes(lc));
    }

    // Country filter
    if (country) {
      const lc = country.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.country ?? '').toLowerCase().includes(lc)
      );
    }

    // City filter
    if (city) {
      const lc = city.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.city ?? '').toLowerCase().includes(lc) ||
        (c.address ?? '').toLowerCase().includes(lc)
      );
    }

    // State/region filter (checks address field)
    if (state) {
      const lc = state.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.address ?? '').toLowerCase().includes(lc) ||
        (c.city ?? '').toLowerCase().includes(lc)
      );
    }

    // Free-text fallback: extract "from X" pattern
    if (!name && !country && !city && !state && query) {
      const fromMatch = (query as string).match(/from\s+([a-z][a-z\s]+?)(?:\s*$|\?)/i);
      if (fromMatch) {
        const loc = fromMatch[1].trim().toLowerCase();
        filtered = filtered.filter((c: any) =>
          (c.country ?? '').toLowerCase().includes(loc) ||
          (c.city ?? '').toLowerCase().includes(loc) ||
          (c.address ?? '').toLowerCase().includes(loc)
        );
      }
    }

    const result = filtered.map((c: any) => ({
      name:    c.name,
      country: c.country   ?? null,
      city:    c.city      ?? null,
      address: c.address   ?? null,
      email:   c.email     ?? null,
      phone:   c.phone     ?? null,
      orders:  (c.orders ?? []).length,
      revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
    }));

    return { success: true, output: { type: 'customer_list', data: result } };
  },
};
