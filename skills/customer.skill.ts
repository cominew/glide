// skills/customer.skill.ts

import { Skill, SkillContext, SkillResult } from '../kernel/types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CUSTOMERS_FILE = path.join(ROOT, 'indexes', 'customers', 'customers.json'); 

let cache: any[] | null = null;
function loadCustomers(): any[] {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8')); return cache!; }
  catch { cache = []; return cache; }
}

// ── Abbreviation maps ─────────────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string[]> = {
  'los angeles': ['los angeles', 'la'],
  'new york':    ['new york', 'nyc', 'ny'],
  'san francisco': ['san francisco', 'sf'],
  'las vegas':   ['las vegas', 'lv'],
};

const STATE_ALIASES: Record<string, string[]> = {
  'california': ['california', 'ca'],
  'texas':      ['texas', 'tx'],
  'florida':    ['florida', 'fl'],
  'new york':   ['new york', 'ny'],
  'washington': ['washington', 'wa'],
  'oregon':     ['oregon', 'or'],
  'nevada':     ['nevada', 'nv'],
  'arizona':    ['arizona', 'az'],
  'colorado':   ['colorado', 'co'],
  'illinois':   ['illinois', 'il'],
};

// Expand an input term to all its known aliases
function expandAliases(input: string, map: Record<string, string[]>): string[] {
  const lc = input.toLowerCase().trim();
  // Direct canonical key match
  if (map[lc]) return map[lc];
  // Find which canonical key has this as an alias
  for (const [canonical, aliases] of Object.entries(map)) {
    if (aliases.includes(lc)) return aliases;
  }
  return [lc];
}

// ── Word-boundary address match ───────────────────────────────────────────────
// Avoids "la" matching "Australia", "plaza", etc.
// Checks city field first (exact), then address with word boundaries.

function matchesLocation(customer: any, terms: string[]): boolean {
  const cityField = (customer.city ?? '').toLowerCase();
  const addr      = (customer.address ?? '').toLowerCase();

  for (const term of terms) {
    // City field: exact match or starts-with
    if (cityField === term || cityField.startsWith(term)) return true;

    // Address: word-boundary match (term surrounded by non-alpha chars)
    const re = new RegExp(`(?<![a-z])${escapeRegex(term)}(?![a-z])`, 'i');
    if (re.test(addr)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── State match: checks "CA" in address for "California" etc. ─────────────────

function matchesState(customer: any, terms: string[]): boolean {
  const addr    = (customer.address ?? '').toLowerCase();
  const cityFld = (customer.city ?? '').toLowerCase();

  for (const term of terms) {
    // For short abbreviations (2 chars), use strict word-boundary
    if (term.length <= 3) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
      if (re.test(addr)) return true;
    } else {
      if (addr.includes(term) || cityFld.includes(term)) return true;
    }
  }
  return false;
}

// ── Skill ─────────────────────────────────────────────────────────────────────

export const skill: Skill = {
  name: 'customer',
  description:
    'Retrieve customer profiles by name, country, city, or US state. ' +
    'Understands abbreviations: LA = Los Angeles, CA = California, NYC = New York, etc. ' +
    'Params: name (string), country (string), city (string), state (string).',

  async execute(input: any, _context: SkillContext): Promise<SkillResult> {
    const customers = loadCustomers();
    const { name, country, city, state, query } = input;

    let filtered = customers;

    // ── Name filter ─────────────────────────────────────────────────────────
    if (name) {
      const lc = name.toLowerCase();
      filtered = filtered.filter((c: any) => c.name?.toLowerCase().includes(lc));
    }

    // ── Country filter ───────────────────────────────────────────────────────
    if (country) {
      const lc = country.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.country ?? '').toLowerCase().includes(lc)
      );
    }

    // ── City filter (with alias expansion + word-boundary matching) ──────────
    if (city) {
      const terms = expandAliases(city, CITY_ALIASES);
      console.log(`[customer] city filter "${city}" → terms:`, terms);
      filtered = filtered.filter((c: any) => matchesLocation(c, terms));
    }

    // ── State filter (with alias expansion, checks address for "CA" etc.) ────
    if (state) {
      const terms = expandAliases(state, STATE_ALIASES);
      console.log(`[customer] state filter "${state}" → terms:`, terms);
      filtered = filtered.filter((c: any) => matchesState(c, terms));
    }

    // ── Free-text fallback ───────────────────────────────────────────────────
    if (!name && !country && !city && !state && query) {
      const fromMatch = (query as string).match(/from\s+([a-z][a-z\s]+?)(?:\s*$|\?)/i);
      if (fromMatch) {
        const loc = fromMatch[1].trim().toLowerCase();
        const cityTerms  = expandAliases(loc, CITY_ALIASES);
        const stateTerms = expandAliases(loc, STATE_ALIASES);
        filtered = filtered.filter((c: any) =>
          (c.country ?? '').toLowerCase().includes(loc) ||
          matchesLocation(c, cityTerms) ||
          matchesState(c, stateTerms)
        );
      }
    }

    const result = filtered.map((c: any) => ({
      name:    c.name,
      country: c.country  ?? null,
      city:    c.city     ?? null,
      address: c.address  ?? null,
      email:   c.email    ?? null,
      phone:   c.phone    ?? null,
      orders:  (c.orders ?? []).length,
      revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
    }));

    return { success: true, output: { type: 'customer_list', data: result } };
  },
};
