// skills/customer.skill.ts
import fs from 'fs';
import path from 'path';
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

function loadCustomers(): any[] {
  for (const p of [
    path.join(process.cwd(), 'indexes', 'customers', 'customers.json'),
    path.join(process.cwd(), 'memory', 'indexes', 'customers', 'customers.json'),
  ]) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
  }
  return [];
}

function matchesCustomerListIntent(text: string): boolean {
  const hasLocation = /customers?\s+(?:from|in)\s+[A-Za-z ]+/i.test(text);
  const isGenericList = /\b(?:list|all|show all)\s+(?:customer|client)/i.test(text);
  const hasPersonLookup = /(?:called|named)\s+[A-Za-z]/i.test(text)
                       || /(?:show|find|get)\s+(?:me\s+)?[a-z]+\s+(?:full|profile|detail|contact)/i.test(text);
  return (hasLocation || isGenericList) && !hasPersonLookup;
}

export const skill: Skill = {
  name: 'customer',
  description: 'Customer lists by location or generic list requests',
  keywords: ['customer', 'list', 'location'],

  canExist(event: GlideEvent): boolean {
    if (event.type !== 'input.user') return false;
    const text = String(event.payload?.input?.message ?? '');
    return matchesCustomerListIntent(text);
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const text = typeof input === 'string' ? input : input.input?.message ?? '';
    if (!text) {
      return { state: 'partial', confidence: 0, phase: 'retrieval', fragments: [] };
    }

    const locMatch = text.match(/customers?\s+(?:from|in)\s+([A-Za-z ]+)/i)
                  ?? text.match(/(?:from|in)\s+([A-Za-z ]+)\s+customers?/i);
    const allCustomers = loadCustomers();

    let customerList: any[];

    if (locMatch?.[1]) {
      const loc = locMatch[1].trim().toLowerCase();
      customerList = allCustomers
        .filter(c => (c.country ?? '').toLowerCase().includes(loc) || (c.city ?? '').toLowerCase().includes(loc))
        .map(c => ({
          name: c.name,
          country: c.country,
          city: c.city,
          email: c.email,
          orders: (c.orders ?? []).length,
          revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
        }));
    } else {
      // 默认返回收入前20的客户
      customerList = allCustomers
        .map(c => ({
          name: c.name,
          country: c.country,
          email: c.email,
          orders: (c.orders ?? []).length,
          revenue: (c.orders ?? []).reduce((s: number, o: any) => s + (o.amount ?? 0), 0),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);
    }

    return {
      state: 'emitted',
      confidence: 1.0,
      phase: 'retrieval',
      fragments: [{
        type: 'data',
        name: 'customer_list',
        value: customerList,
        role: 'primary',
        confidence: 1.0,
        source: 'customer.skill',
        phase: 'retrieval',
      }],
    };
  },
};