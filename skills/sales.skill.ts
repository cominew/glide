// skills/sales.skill.ts
// ─────────────────────────────────────────────────────────────
// Sales Skill — Emergence Edition
//
// Domain: revenue analytics, rankings, reports
// Resonates when: query asks about totals, trends, rankings, reports
// Silent when: query is about a specific person's contact details
// ─────────────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { EmergenceSkill, SkillFragment, SkillExecutionContext }
  from '../kernel/types/skill.js';
import type { GlideEvent } from '../kernel/event-bus/event-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');
const DATA_PATH  = path.join(ROOT, 'indexes', 'customers', 'customers.json');

// ── Data ──────────────────────────────────────────────────────

let _cache: any[] | null = null;
function loadCustomers(): any[] {
  if (_cache) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch { _cache = []; }
  return _cache!;
}

function revenue(c: any): number {
  return (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0);
}

// ── Observation ───────────────────────────────────────────────

type SalesIntent =
  | { type: 'monthly';   period: string }
  | { type: 'top';       limit: number }
  | { type: 'country';   country?: string }
  | { type: 'overview' };

function extractIntent(text: string): SalesIntent {
  // Monthly report
  const monthMatch = text.match(/(\d{4}-\d{2})/);
  if (monthMatch) return { type: 'monthly', period: monthMatch[1] };

  // Top N
  const topMatch = text.match(/top\s*(\d+)/i);
  if (topMatch) return { type: 'top', limit: Number(topMatch[1]) };
  if (/top|best|ranking|highest/i.test(text)) return { type: 'top', limit: 10 };

  // Country breakdown
  if (/country|countries|region/i.test(text)) return { type: 'country' };

  // Default: overview
  return { type: 'overview' };
}

// ── Query ─────────────────────────────────────────────────────

function compute(intent: SalesIntent): SkillFragment[] {
  const all = loadCustomers();

  if (intent.type === 'monthly') {
    let rev = 0, orders = 0;
    const products: Record<string, { units: number; revenue: number }> = {};
    const seen = new Set<string>();

    for (const c of all) for (const o of c.orders ?? []) {
      if (!o.date?.startsWith(intent.period)) continue;
      rev    += o.amount ?? 0;
      orders++;
      seen.add(c.name);
      const k = o.product ?? 'Unknown';
      if (!products[k]) products[k] = { units: 0, revenue: 0 };
      products[k].units   += o.quantity ?? 1;
      products[k].revenue += o.amount ?? 0;
    }

    const productList = Object.entries(products)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    return [
      { type: 'data', name: 'monthly_report', value: {
        month: intent.period, totalRevenue: rev,
        totalOrders: orders, uniqueCustomers: seen.size, products: productList,
      }},
      { type: 'insight', name: 'top_product', value: productList[0]?.name ?? 'none' },
    ];
  }

  if (intent.type === 'top') {
    return [{
      type: 'data', name: 'top_customers',
      value: all
        .map(c => ({ name: c.name, country: c.country, revenue: revenue(c), orders: (c.orders ?? []).length }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, intent.limit),
    }];
  }

  if (intent.type === 'country') {
    const byCountry: Record<string, { revenue: number; orders: number }> = {};
    for (const c of all) {
      const k = c.country ?? 'Unknown';
      if (!byCountry[k]) byCountry[k] = { revenue: 0, orders: 0 };
      byCountry[k].revenue += revenue(c);
      byCountry[k].orders  += (c.orders ?? []).length;
    }
    return [{
      type: 'data', name: 'sales_by_country',
      value: Object.entries(byCountry)
        .map(([country, v]) => ({ country, ...v }))
        .sort((a, b) => b.revenue - a.revenue),
    }];
  }

  // overview
  return [{
    type: 'data', name: 'overview',
    value: {
      revenue:   all.reduce((s, c) => s + revenue(c), 0),
      orders:    all.reduce((s, c) => s + (c.orders ?? []).length, 0),
      customers: all.length,
      countries: new Set(all.map(c => c.country).filter(Boolean)).size,
    },
  }];
}

// ── Skill ─────────────────────────────────────────────────────

export const skill: EmergenceSkill<SalesIntent> = {
  id:          'sales.skill',
  domain:      'revenue-analytics',
  description: 'Revenue totals, rankings, monthly reports, country breakdowns',

  match(event: GlideEvent): boolean {
    const text = String(
      event.payload?.input?.message ??
      event.payload?.input?.text ??
      event.payload?.input ?? ''
    ).toLowerCase();
    return /\b(?:sales|revenue|report|ranking|top|monthly|country|countries|overview|performance|trend|orders)\b/.test(text);
  },

  guard(event: GlideEvent): boolean {
    // Guard: data file must exist
    return fs.existsSync(DATA_PATH);
  },

  observe(event: GlideEvent): SalesIntent {
    const text = String(
      event.payload?.input?.message ??
      event.payload?.input?.text ??
      event.payload?.input ?? ''
    );
    return extractIntent(text);
  },

  async execute(intent: SalesIntent, _ctx: SkillExecutionContext): Promise<SkillFragment[]> {
    return compute(intent);
  },

  emit(fragments: SkillFragment[]) {
    return { type: 'skill.output' as const, skill: 'sales.skill', fragments, complete: true, };
  },
};

export default skill;