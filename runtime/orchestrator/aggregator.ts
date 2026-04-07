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
          const list = res.data || [];
          if (!list.length) {
            summaries.push('No customers found.');
          } else {
            const preview = list.slice(0, 5).map((c: any) =>
              `${c.name} (${c.country ?? '?'}) — $${(c.revenue ?? 0).toFixed(0)} revenue, ${c.orders ?? 0} orders` +
              (c.email ? `, email: ${c.email}` : '') +
              (c.phone ? `, phone: ${c.phone}` : '') +
              (c.address ? `, address: ${c.address}` : '')
            ).join('\n');
            summaries.push(`Found ${list.length} customer(s):\n${preview}`);
          }
          break;
        }

        case 'top_customers': {
          const list = (res.data || []).slice(0, 5);
          if (list.length === 0) break;
          const formatted = list.map((c: any, i: number) =>
            `${i+1}. ${c.name} — $${(c.revenue ?? 0).toFixed(0)} (${c.orders} orders)`
          ).join('\n');
          summaries.push(`Top customers:\n${formatted}`);
          break;
        }

        case 'overview':
        case 'total_revenue': {
          summaries.push(
            `Sales overview: $${(res.revenue ?? res.total ?? 0).toFixed(0)} revenue, ` +
            `${res.orders ?? '?'} orders, ${res.customers ?? '?'} customers, ${res.countries ?? '?'} countries.`
          );
          break;
        }

        case 'monthly_report': {
          const products = (res.products ?? []).slice(0, 3).map((p: any) =>
            `${p.name}: ${p.units} units, $${p.revenue?.toFixed(0)}`
          ).join('; ');
          summaries.push(
            `${res.month} report: $${(res.totalRevenue ?? 0).toFixed(0)} revenue, ` +
            `${res.totalOrders} orders, ${res.uniqueCustomers} customers. Top products: ${products || 'none'}.`
          );
          break;
        }

        case 'sales_by_country': {
          const top = (res.data ?? []).slice(0, 5);
          const list = top.map((c: any, i: number) =>
            `${i+1}. ${c.country} — $${(c.revenue ?? 0).toFixed(0)}`
          ).join(', ');
          summaries.push(`Revenue by country: ${list}`);
          break;
        }

        case 'sales_data': {
          summaries.push(
            `${res.customer}: ${res.orderCount} orders, $${(res.totalSpent ?? 0).toFixed(0)} total.`
          );
          if (res.orders?.length) {
            const lastOrder = res.orders[0];
            summaries.push(`Last order: ${lastOrder.product} on ${lastOrder.date}, amount $${lastOrder.amount?.toFixed(0)}.`);
          }
          break;
        }

        case 'knowledge_answer': {
          summaries.push(`Knowledge base: ${(res.answer as string).slice(0, 400)}`);
          break;
        }

        default:
          if (res.error) summaries.push(`Error: ${res.error}`);
      }
    }

    if (!summaries.length) return `I searched for "${query}" but found no relevant information.`;

    const singleType = results[0]?.type;
    const skipLLM = results.length === 1 && [
      'customer_list', 'monthly_report', 'overview',
      'total_revenue', 'sales_by_country', 'top_customers', 'sales_data'
    ].includes(singleType);

    if (skipLLM) return summaries.join('\n\n') || 'No summary available.';

    const shortSummary = summaries.join('\n').slice(0, 1500);
    const prompt = `Answer this question based only on the data below:
"${query}"

Data:
${shortSummary}

Give a concise, natural answer (2-4 sentences). Use numbers.`;

    try {
      const answer = await this.llm.generate(prompt);
      return answer?.trim() || shortSummary;
    } catch (err) {
      console.error('[Aggregator] LLM failed, using fallback:', err);
      return shortSummary;
    }
  }
}