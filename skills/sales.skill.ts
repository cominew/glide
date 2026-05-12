// skills/sales.skill.ts
import fs from 'fs';
import path from 'path';
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

const DATA_PATH = path.join(process.cwd(), 'indexes', 'customers', 'customers.json');

let _cache: any[] | null = null;
function loadCustomers(): any[] {
  if (_cache) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); } catch { _cache = []; }
  return _cache!;
}

function revenue(c: any): number {
  return (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0);
}

type SalesIntent =
  | { type: 'monthly'; period: string }
  | { type: 'top'; limit: number }
  | { type: 'country' }
  | { type: 'overview' };

function extractIntent(text: string): SalesIntent {
  const monthMatch = text.match(/(\d{4}-\d{2})/);
  if (monthMatch) return { type: 'monthly', period: monthMatch[1] };
  const topMatch = text.match(/top\s*(\d+)/i);
  if (topMatch) return { type: 'top', limit: Number(topMatch[1]) };
  if (/top|best|ranking|highest/i.test(text)) return { type: 'top', limit: 10 };
  if (/country|countries|region/i.test(text)) return { type: 'country' };
  return { type: 'overview' };
}

function compute(intent: SalesIntent): any[] {
  const all = loadCustomers();

  if (intent.type === 'monthly') {
    let rev = 0, orders = 0;
    const products: Record<string, { units: number; revenue: number }> = {};
    const seen = new Set<string>();
    for (const c of all) for (const o of c.orders ?? []) {
      if (!o.date?.startsWith(intent.period)) continue;
      rev += o.amount ?? 0;
      orders++;
      seen.add(c.name);
      const k = o.product ?? 'Unknown';
      if (!products[k]) products[k] = { units: 0, revenue: 0 };
      products[k].units += o.quantity ?? 1;
      products[k].revenue += o.amount ?? 0;
    }
    const productList = Object.entries(products)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
    return [{
      type: 'data', name: 'monthly_report',
      value: { month: intent.period, totalRevenue: rev, totalOrders: orders, uniqueCustomers: seen.size, products: productList },
    }];
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
      byCountry[k].orders += (c.orders ?? []).length;
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
      revenue: all.reduce((s, c) => s + revenue(c), 0),
      orders: all.reduce((s, c) => s + (c.orders ?? []).length, 0),
      customers: all.length,
      countries: new Set(all.map(c => c.country).filter(Boolean)).size,
    },
  }];
}

export const skill: Skill = {
  name: 'sales',
  description: 'Revenue analytics: totals, rankings, monthly reports, country breakdowns',
  keywords: ['sales', 'revenue', 'report', 'ranking', 'top', 'monthly', 'country', 'overview'],

  canExist(event: GlideEvent, text?: string): boolean {
    // 1. 若来自 upstream 技能，继续参与链式共振
    if (event.type === 'skill.output') {
      const fragments = event.payload?.fragments ?? [];
      return fragments.some((f: any) =>
        ['identity.resolved', 'overview', 'customer_list'].includes(f.name)
      );
    }
    
    // 2. 若为直接的、明确的分析性用户查询，直接显现
    if (event.type === 'input.user') {
      const inputText = text ?? String(event.payload?.input?.message ?? '');
      return /\b(?:sales|revenue|report|ranking|top|monthly|country|countries|overview|performance|trend|orders)\b/i.test(inputText);
    }
    
    return false;
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const text = typeof input === 'string' ? input : input?.input?.message ?? input?.message ?? '';
    if (!text) {
      return { state: 'partial', phase: 'retrieval', fragments: [], confidence: 0 };
    }

    const intent = extractIntent(text);
    const rawFragments = compute(intent);

    const fragments = rawFragments.map((f: any) => ({
      type: 'data' as const,
      name: f.name,
      value: f.value,
      role: 'primary' as const,
      confidence: 1.0,
      source: 'sales.skill',
      phase: 'retrieval' as const,
    }));

    return {
      state: 'emitted',
      confidence: 1.0,
      phase: 'retrieval',
      fragments,
    };
  },
};