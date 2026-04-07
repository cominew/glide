// skills/sales.skill.ts

import { Skill, SkillContext, SkillResult } from '../kernel/types';
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
  try {
    cache = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
    return cache!;
  } catch {
    console.warn('[sales.skill] Could not load customers file:', CUSTOMERS_FILE);
    cache = [];
    return cache;
  }
}

function calcRevenue(customer: any): number {
  return (customer.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0);
}

export const skill: Skill = {
  name: 'sales',
  description:
    'Sales analytics: total revenue, top customers by revenue, country ranking, ' +
    'monthly revenue report, and individual customer order history. ' +
    'Params: customerName (string, optional), dateRange (YYYY-MM, optional), ' +
    'country (string, optional), limit (number, optional, default 5).',
  keywords: ['sales', 'revenue', 'top', 'report', 'monthly', 'ranking', 'overview'],

  async execute(input: any, _context: SkillContext): Promise<SkillResult> {
    const customers  = loadCustomers();
    const query      = (input.query ?? '').toLowerCase();
    const { customerName, dateRange, country, limit = 5 } = input;

    // ── 1. Specific customer order history ───────────────────────────────────
    if (customerName) {
      const c = customers.find((c: any) =>
        c.name?.toLowerCase().includes(customerName.toLowerCase())
      );
      if (!c) return { success: false, error: `Customer "${customerName}" not found` };

      return {
        success: true,
        output: {
          type:       'sales_data',
          customer:   c.name,
          totalSpent: calcRevenue(c),
          orderCount: (c.orders ?? []).length,
          orders:     (c.orders ?? []).map((o: any) => ({
            product:  o.product,
            amount:   o.amount,
            date:     o.date,
            quantity: o.quantity,
          })),
        },
      };
    }

    // ── 2. Monthly report ────────────────────────────────────────────────────
    if (dateRange && /^\d{4}-\d{2}$/.test(dateRange)) {
      let revenue = 0;
      let orders  = 0;
      const products: Record<string, { units: number; revenue: number }> = {};
      const customerSet = new Set<string>();

      for (const c of customers) {
        for (const o of (c.orders ?? [])) {
          if (!o.date?.startsWith(dateRange)) continue;
          revenue += o.amount ?? 0;
          orders++;
          customerSet.add(c.name);
          const key = o.product ?? 'Unknown';
          if (!products[key]) products[key] = { units: 0, revenue: 0 };
          products[key].units   += o.quantity ?? 1;
          products[key].revenue += o.amount ?? 0;
        }
      }

      return {
        success: true,
        output: {
          type:            'monthly_report',
          month:           dateRange,
          totalRevenue:    revenue,
          totalOrders:     orders,
          uniqueCustomers: customerSet.size,
          products:        Object.entries(products)
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.revenue - a.revenue),
        },
      };
    }

    // ── 3. Top customers ─────────────────────────────────────────────────────
    if (/top|best|highest|ranking|list/i.test(query) || input.action === 'top_customers') {
      const top = customers
        .map((c: any) => ({
          name:    c.name,
          country: c.country,
          revenue: calcRevenue(c),
          orders:  (c.orders ?? []).length,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Number(limit));

      return { success: true, output: { type: 'top_customers', data: top } };
    }

    // ── 4. Country revenue ranking ───────────────────────────────────────────
    if (country || /countr/i.test(query)) {
      const byCountry: Record<string, { revenue: number; orders: number }> = {};
      for (const c of customers) {
        const key = c.country ?? 'Unknown';
        if (!byCountry[key]) byCountry[key] = { revenue: 0, orders: 0 };
        byCountry[key].revenue += calcRevenue(c);
        byCountry[key].orders  += (c.orders ?? []).length;
      }
      const ranked = Object.entries(byCountry)
        .map(([country, v]) => ({ country, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Number(limit));

      return { success: true, output: { type: 'sales_by_country', data: ranked } };
    }

    // ── 5. Default: total revenue overview ───────────────────────────────────
    const totalRevenue  = customers.reduce((s: number, c: any) => s + calcRevenue(c), 0);
    const totalOrders   = customers.reduce((s: number, c: any) => s + (c.orders ?? []).length, 0);
    const totalCustomers = customers.length;
    const countrySet    = new Set(customers.map((c: any) => c.country).filter(Boolean));

    return {
      success: true,
      output: {
        type:      'overview',
        revenue:   totalRevenue,
        orders:    totalOrders,
        customers: totalCustomers,
        countries: countrySet.size,
      },
    };
  },
};
