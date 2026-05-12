// skills/profile-fetcher.skill.ts
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

export const skill: Skill = {
  name: 'profile-fetcher',
  description: 'Fetches full customer profile when identity is resolved or unresolved',
  keywords: [],

  canExist(event: GlideEvent, text?: string): boolean {
    if (event.type !== 'skill.output') return false;
    const skill = event.payload?.skill;
    if (skill !== 'name-disambiguation') return false;
    const fragments = event.payload?.fragments ?? [];
    // ⭐ 添加 identity.ambiguous 支持
    return fragments.some((f: any) =>
        f.name === 'identity.resolved' ||
        f.name === 'identity.unresolved' ||
        f.name === 'identity.ambiguous'
    );
},

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const fragments = input.fragments ?? [];
    
    // 优先使用已解析的身份
    const idResolved = fragments.find((f: any) => f.name === 'identity.resolved');
    const idUnresolved = fragments.find((f: any) => f.name === 'identity.unresolved');
    const idFragment = idResolved || idUnresolved;

    if (!idFragment) {
      return { state: 'partial', phase: 'retrieval', fragments: [], confidence: 0 };
    }

if (idFragment.name === 'identity.ambiguous') {
  const candidates = idFragment.value?.candidates ?? [];
  if (candidates.length > 0) {
    return {
      state: 'emitted',
      phase: 'retrieval',
      confidence: 0.8,
      fragments: [{
        type: 'data',
        name: 'customer_list',
        value: candidates.map((c: any) => ({
          name: c.name,
          country: c.country,
          note: 'Ambiguous match — please refine your query.',
        })),
        role: 'primary',
        confidence: 0.8,
        source: 'profile-fetcher.skill',
        phase: 'retrieval',
      }],
    };
  }
  return { state: 'partial', phase: 'retrieval', fragments: [], confidence: 0 };
}

    if (idFragment.name === 'identity.unresolved') {
      return {
        state: 'emitted',
        phase: 'retrieval',
        confidence: 0.8,
        fragments: [{
          type: 'data',
          name: 'profile.data',
          value: {
            name: idFragment.value?.query || idFragment.value,
            unresolved: true,
            currency: 'USD', 
            note: 'Customer identity not fully resolved from data source.'
          },
          role: 'primary',
          confidence: 0.8,
          source: 'profile-fetcher.skill',
          phase: 'retrieval',
        }],
      };
    }

    // 处理已找到的情况
    const customer = idFragment.value?.customer ?? idFragment.value;
    if (!customer) {
      return { state: 'partial', phase: 'retrieval', fragments: [], confidence: 0 };
    }

    const orders = customer.orders ?? [];
    const revenue = orders.reduce((sum: number, o: any) => sum + (o.amount ?? 0), 0);

    return {
      state: 'emitted',
      phase: 'retrieval',
      confidence: 1.0,
      fragments: [{
        type: 'data',
        name: 'profile.data',
        value: {
          name: customer.name,
          currency: 'USD',
          country: customer.country ?? null,
          city: customer.city ?? null,
          address: customer.address ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          orderCount: orders.length,
          totalRevenue: revenue,
          recentOrders: orders.slice(-5).map((o: any) => ({
            orderNo: o.orderNo,
            date: o.date,
            product: o.product,
            quantity: o.quantity,
            amount: o.amount,
          })),
          payments: customer.payments ?? [],
          shipments: customer.shipments ?? [],
          metrics: customer.metrics ?? null,
        },
        role: 'primary',
        confidence: 1.0,
        source: 'profile-fetcher.skill',
        phase: 'retrieval',
      }],
    };
  },
};