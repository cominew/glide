// skills/customer.skill.ts
import fs from 'fs';
import path from 'path';

function loadCustomers(): any[] {
  for (const p of [
    path.join(process.cwd(), 'indexes/customers/customers.json'),
    path.join(process.cwd(), 'memory/indexes/customers/customers.json'),
  ]) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
  }
  return [];
}

export const skill = {
  name: 'customer',
  id: 'customer.skill',
  domain: 'customer-data',
  description: 'Customer lists by location or generic list requests',

  match(event: any): boolean {
    const text = String(event.payload?.input?.message ?? '');
    const hasLocation = /customers?\s+(?:from|in)\s+[A-Za-z ]+/i.test(text);
    const isGenericList = /\b(?:list|all|show all)\s+(?:customer|client)/i.test(text);
    const hasPersonLookup = /(?:called|named)\s+[A-Za-z]/i.test(text)
                         || /(?:show|find|get)\s+(?:me\s+)?[a-z]+\s+(?:full|profile|detail|contact)/i.test(text);
    return (hasLocation || isGenericList) && !hasPersonLookup;
  },

  guard(): boolean { return true; },

  observe(event: any) {
    return { text: String(event.payload?.input?.message ?? '') };
  },

  async execute(observation: any): Promise<any[]> {
    const text = observation.text;
    const locMatch = text.match(/customers?\s+(?:from|in)\s+([A-Za-z ]+)/i) ?? text.match(/(?:from|in)\s+([A-Za-z ]+)\s+customers?/i);
    const allCustomers = loadCustomers();

    if (locMatch?.[1]) {
      const loc = locMatch[1].trim().toLowerCase();
      const matches = allCustomers.filter(c =>
        (c.country ?? '').toLowerCase().includes(loc) || (c.city ?? '').toLowerCase().includes(loc)
      );
      return [{ type: 'data', name: 'customer_list', value: matches.map(c => ({
        name: c.name,
        country: c.country,
        city: c.city,
        email: c.email,
        orders: (c.orders ?? []).length,
        revenue: (c.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0),
      })) }];
    }

    const top = allCustomers.map(c => ({
      name: c.name,
      country: c.country,
      email: c.email,
      orders: (c.orders ?? []).length,
      revenue: (c.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0),
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

    return [{ type: 'data', name: 'customer_list', value: top }];
  },

  emit(fragments: any[]) {
    return { type: 'skill.output', skill: 'customer.skill', fragments, complete: true };
  },
};

export default skill;