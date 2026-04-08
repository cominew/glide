// skills/sales.skill.ts

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
function calcRevenue(c: any): number {
  return (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0);
}

export const skill: Skill = {
  name: 'sales',
  description:
    'Sales analytics: total revenue overview, top customers by revenue, country/city/state ranking, ' +
    'monthly revenue report, individual customer order history. ' +
    'Params: customerName (string), dateRange (YYYY-MM), country (string), ' +
    'city (string), state (string), action (string), limit (number, default 5).',

  async execute(input: any, _context: SkillContext): Promise<SkillResult> {
    const customers = loadCustomers();
    const query     = (input.query ?? '').toLowerCase();
    const { customerName, dateRange, country, city, state, limit = 10 } = input;

    // ── 1. Specific customer order history ───────────────────────────────────
    if (customerName) {
      const lc = customerName.toLowerCase();
      // Try exact first, then partial
      const c = customers.find((c: any) => c.name?.toLowerCase() === lc)
             ?? customers.find((c: any) => c.name?.toLowerCase().includes(lc));
      if (!c) return { success: false, error: `Customer "${customerName}" not found` };
      return {
        success: true,
        output: {
          type:       'sales_data',
          customer:   c.name,
          totalSpent: calcRevenue(c),
          orderCount: (c.orders ?? []).length,
          country:    c.country,
          orders:     (c.orders ?? []).map((o: any) => ({
            product: o.product, amount: o.amount, date: o.date, quantity: o.quantity,
          })),
        },
      };
    }

    // ── 2. Monthly report ────────────────────────────────────────────────────
    if (dateRange && /^\d{4}-\d{2}$/.test(dateRange)) {
      let revenue = 0, orders = 0;
      const products: Record<string, { units: number; revenue: number }> = {};
      const customerSet = new Set<string>();
      for (const c of customers) {
        for (const o of (c.orders ?? [])) {
          if (!o.date?.startsWith(dateRange)) continue;
          revenue += o.amount ?? 0; orders++;
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
          type: 'monthly_report', month: dateRange,
          totalRevenue: revenue, totalOrders: orders,
          uniqueCustomers: customerSet.size,
          products: Object.entries(products)
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.revenue - a.revenue),
        },
      };
    }

    // ── 3. City / State / Region filter ─────────────────────────────────────
    if (city || state || /california|london|sydney|berlin|paris|new york|texas|florida/i.test(query)) {
      const locationFilter = city || state ||
        (query.match(/from\s+([a-z\s]+?)(?:\s*$|\s+(?:and|with|,))/i)?.[1]?.trim() ?? '');

      const filtered = customers.filter((c: any) => {
        const loc = locationFilter.toLowerCase();
        return (
          (c.city ?? '').toLowerCase().includes(loc) ||
          (c.address ?? '').toLowerCase().includes(loc) ||
          (c.country ?? '').toLowerCase().includes(loc)
        );
      });

      const ranked = filtered
        .map((c: any) => ({
          name: c.name, country: c.country, city: c.city ?? null,
          email: c.email ?? null, phone: c.phone ?? null,
          revenue: calcRevenue(c), orders: (c.orders ?? []).length,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Number(limit));

      return { success: true, output: { type: 'top_customers', data: ranked, location: locationFilter } };
    }

    // ── 4. Country filter (FIXED — actually filters by country) ──────────────
    if (country) {
      const lc = country.toLowerCase();
      const filtered = customers.filter((c: any) =>
        (c.country ?? '').toLowerCase().includes(lc)
      );
      const ranked = filtered
        .map((c: any) => ({
          name: c.name, country: c.country, city: c.city ?? null,
          email: c.email ?? null, phone: c.phone ?? null,
          revenue: calcRevenue(c), orders: (c.orders ?? []).length,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Number(limit));

      return { success: true, output: { type: 'top_customers', data: ranked, location: country } };
    }

    // ── 5. Top customers ─────────────────────────────────────────────────────
    if (/top|best|highest|ranking/i.test(query) || input.action === 'top_customers') {
      const top = customers
        .map((c: any) => ({
          name: c.name, country: c.country,
          revenue: calcRevenue(c), orders: (c.orders ?? []).length,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Number(limit));
      return { success: true, output: { type: 'top_customers', data: top } };
    }

    // ── 6. Country revenue ranking ───────────────────────────────────────────
    if (/countr/i.test(query)) {
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

    // ── 7. Default overview ───────────────────────────────────────────────────
    return {
      success: true,
      output: {
        type: 'overview',
        revenue:   customers.reduce((s: number, c: any) => s + calcRevenue(c), 0),
        orders:    customers.reduce((s: number, c: any) => s + (c.orders ?? []).length, 0),
        customers: customers.length,
        countries: new Set(customers.map((c: any) => c.country).filter(Boolean)).size,
      },
    };
  },
};
