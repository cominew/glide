// runtime/orchestrator/aggregator.ts

import { SkillContext } from '../../kernel/types.js';

export class Aggregator {
  constructor(private llm: any) {}

  async aggregate(query: string, results: any[], _context: SkillContext): Promise<string> {
    if (!results.length) return 'No data available.';

    const summaries: string[] = [];

    for (const res of results) {
      if (!res) continue;

      switch (res.type) {

        case 'customer_list': {
          const list: any[] = res.data || [];
          if (!list.length) { summaries.push('No customers found.'); break; }
          const rows = list.slice(0, 8).map((c: any) => {
            let line = `${c.name} (${c.country ?? '?'})`;
            if (c.city)    line += `, ${c.city}`;
            line += ` — $${(c.revenue ?? 0).toFixed(0)}, ${c.orders ?? 0} orders`;
            if (c.email)   line += `, email: ${c.email}`;
            if (c.phone)   line += `, phone: ${c.phone}`;
            if (c.address) line += `\n  Address: ${c.address}`;
            return line;
          }).join('\n');
          summaries.push(`Found ${list.length} customer(s):\n${rows}`);
          break;
        }

        case 'sales_data': {
          let s = `${res.customer}: ${res.orderCount ?? 0} orders, $${(res.totalSpent ?? 0).toFixed(0)} total`;
          if (res.country) s += `, ${res.country}`;
          summaries.push(s);
          if (res.orders?.length) {
            const recent = res.orders.slice(0, 3).map((o: any) =>
              `  • ${o.date ?? '?'}: ${o.product ?? '?'} ×${o.quantity ?? 1} = $${(o.amount ?? 0).toFixed(0)}`
            ).join('\n');
            summaries.push(`Recent orders:\n${recent}`);
          }
          break;
        }

        case 'top_customers': {
          const list = (res.data || []).slice(0, 8);
          if (!list.length) break;
          const rows = list.map((c: any, i: number) =>
            `${i+1}. ${c.name} (${c.country ?? '?'}) — $${(c.revenue ?? 0).toFixed(0)}, ${c.orders} orders`
          ).join('\n');
          summaries.push(`Top customers:\n${rows}`);
          break;
        }

        case 'overview':
        case 'total_revenue':
          summaries.push(
            `Sales overview: $${(res.revenue ?? res.total ?? 0).toFixed(0)} revenue, ` +
            `${res.orders ?? '?'} orders, ${res.customers ?? '?'} customers, ${res.countries ?? '?'} countries.`
          );
          break;

        case 'monthly_report': {
          const prods = (res.products ?? []).slice(0, 3)
            .map((p: any) => `${p.name}: ${p.units} units ($${(p.revenue ?? 0).toFixed(0)})`)
            .join('; ');
          summaries.push(
            `${res.month}: $${(res.totalRevenue ?? 0).toFixed(0)} revenue, ` +
            `${res.totalOrders} orders, ${res.uniqueCustomers} customers.\n` +
            (prods ? `Top products: ${prods}` : '')
          );
          break;
        }

        case 'sales_by_country': {
          const rows = (res.data ?? []).slice(0, 6)
            .map((c: any, i: number) => `${i+1}. ${c.country} — $${(c.revenue ?? 0).toFixed(0)}`)
            .join(', ');
          summaries.push(`Revenue by country: ${rows}`);
          break;
        }

        case 'knowledge_answer':
          summaries.push(`Knowledge: ${(res.answer as string).slice(0, 500)}`);
          break;

        default:
          if (res.error) summaries.push(`Error: ${res.error}`);
      }
    }

    if (!summaries.length) return `No relevant information found for "${query}".`;

    // Single structured result — skip LLM, return formatted data directly
    const singleType = results[0]?.type;
    const skipLLM = results.length === 1 && [
      'customer_list', 'monthly_report', 'overview', 'total_revenue',
      'sales_by_country', 'top_customers', 'sales_data',
    ].includes(singleType);
    if (skipLLM) return summaries.join('\n\n');

    // Multi-skill result — use LLM to synthesise, with 20s timeout
    const combined = summaries.join('\n\n').slice(0, 1200);
    const prompt =
      `You are a business intelligence assistant.\n` +
      `Query: "${query}"\n\n` +
      `Data:\n${combined}\n\n` +
      `Write a 3-5 sentence executive summary. Include specific names, numbers, and contact details where available. Professional tone.`;

    try {
      const result = await Promise.race([
        this.llm.generate(prompt),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 20000)),
      ]);
      return (result as string)?.trim() || combined;
    } catch (err) {
      console.warn('[Aggregator] LLM timeout/error, using fallback:', err);
      return combined;
    }
  }
}
