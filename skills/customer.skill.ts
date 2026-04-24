// skills/customer.skill.ts
// ─────────────────────────────────────────────────────────────
// Customer Skill — Emergence Edition
//
// Domain: customer data lookup
// Resonates when: query references a person name or customer entity
// Silent when: query is about sales totals, reports, or no person named
// ─────────────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import type { EmergenceSkill, SkillFragment, SkillExecutionContext }
  from '../kernel/types/skill.js';
import type { GlideEvent } from '../kernel/event-bus/event-contract.js';

// ── Data ──────────────────────────────────────────────────────

function loadCustomers(): any[] {
  for (const p of [
    path.join(process.cwd(), 'indexes/customers/customers.json'),
  ]) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}
  }
  return [];
}

// ── Intent extraction ─────────────────────────────────────────

interface CustomerObservation {
  intent:  'lookup' | 'location_list' | 'general_list';
  entity?: string;    // person name
  location?: string;  // country / city
}

const PERSON_PATTERNS = [
  /(?:show|find|get|lookup|search)\s+(?:me\s+)?(?:customer|client)?\s*(?:[""']?)([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)?)(?:[""']?)\s*(?:full|profile|detail|contact|info|order)?/i,
  /(?:about|for|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  /(?:analyze|review)\s+(?:customer|client)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  /^(?:show|find|get)\s+(?:me\s+)?([a-z][a-z]+(?:\s+[a-z][a-z]+)?)\s*(?:full|contact|detail|profile|info)?$/i,
];

const GENERIC = new Set([
  'me','the','all','a','an','his','her','their','our',
  'customer','client','user','profile','contact','detail',
  'full','recent','latest','current','some','this','that',
]);


function extractObservation(text: string): CustomerObservation | null {
  // Person lookup
  for (const p of PERSON_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) {
      const entity = m[1].trim();
      if (!GENERIC.has(entity.toLowerCase()) && entity.length > 1) {
        return { intent: 'lookup', entity };
      }
    }
  }

  // Location filter
  const loc = text.match(/customers?\s+(?:from|in)\s+([A-Za-z ]+)/i)
           ?? text.match(/(?:from|in)\s+([A-Za-z ]+)\s+customers?/i);
  if (loc?.[1]) {
    return { intent: 'location_list', location: loc[1].trim() };
  }

  // Generic customer list
  if (/\bcustomer|client\b/i.test(text)) {
    return { intent: 'general_list' };
  }

  return null;
}

// ── Query ─────────────────────────────────────────────────────

function queryCustomers(obs: CustomerObservation): SkillFragment[] {
  const all = loadCustomers();

  if (obs.intent === 'lookup' && obs.entity) {
    const key = obs.entity.toLowerCase();
    const matches = all.filter(c =>
      (c.name ?? '').toLowerCase().includes(key) ||
      (c.name ?? '').toLowerCase().split(' ').some((w: string) => w.startsWith(key))
    );

    if (!matches.length) {
      return [{ type: 'signal', name: 'not_found', value: obs.entity }];
    }

    return matches.map(c => ({
      type:  'data',
      name:  'customer_profile',
      value: {
        name:    c.name,
        country: c.country ?? null,
        city:    c.city ?? null,
        address: c.address ?? null,
        email:   c.email ?? null,
        phone:   c.phone ?? null,
        orders:  (c.orders ?? []).length,
        revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
        recentOrders: (c.orders ?? []).slice(-5),
      },
    }));
  }

  if (obs.intent === 'location_list' && obs.location) {
    const loc = obs.location.toLowerCase();
    const matches = all.filter(c =>
      (c.country ?? '').toLowerCase().includes(loc) ||
      (c.city ?? '').toLowerCase().includes(loc)
    );
    return [{
      type:  'data',
      name:  'customer_list',
      value: matches.map(c => ({
        name:    c.name,
        country: c.country,
        city:    c.city,
        email:   c.email,
        orders:  (c.orders ?? []).length,
        revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
      })),
    }];
  }

  // general list — top 20 by revenue
  return [{
    type:  'data',
    name:  'customer_list',
    value: all
      .map(c => ({
        name:    c.name,
        country: c.country,
        email:   c.email,
        orders:  (c.orders ?? []).length,
        revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20),
  }];
}

// ── Skill ─────────────────────────────────────────────────────

export const skill: EmergenceSkill<CustomerObservation | null> = {
  id:          'customer.skill',
  domain:      'customer-data',
  description: 'Customer profiles, contact details, order history',

  match(event: GlideEvent): boolean {
    const text = event.payload?.input?.message
      ?? event.payload?.input?.text
      ?? event.payload?.input
      ?? '';
    const t = String(text).toLowerCase();
    // Resonates with customer/person queries
    // Does NOT resonate with pure sales/revenue/report queries
    return /customer|client|contact|profile|email|phone|address|order/i.test(t)
      || /(?:show|find|get|lookup)\s+(?:me\s+)?[a-z]+/i.test(String(text))
      || /(?:about|for)\s+[A-Z][a-z]+/i.test(String(text));
  },

  guard(event: GlideEvent): boolean {
    // Evidence: can we extract a meaningful observation from this event?
    const text = event.payload?.input?.message
      ?? event.payload?.input?.text
      ?? event.payload?.input
      ?? '';
    return extractObservation(String(text)) !== null;
  },

  observe(event: GlideEvent): CustomerObservation | null {
    const text = event.payload?.input?.message
      ?? event.payload?.input?.text
      ?? event.payload?.input
      ?? '';
    return extractObservation(String(text));
  },

  async execute(observation: CustomerObservation | null, _ctx: SkillExecutionContext): Promise<SkillFragment[]> {
    if (!observation) return [];
    return queryCustomers(observation);
  },

  emit(fragments: SkillFragment[]) {
    return { type: 'skill.output' as const, skill: 'customer.skill', fragments, complete: true, };
  },
};

export default skill;