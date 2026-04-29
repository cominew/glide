// skills/profile-fetcher.skill.ts
// ─────────────────────────────────────────────────────────────
// Profile Fetcher Skill
//
// Causal position: identity.resolved (inside skill.output) → [this] → profile.data
//
// Listens for skill.output events containing an identity.resolved fragment.
// Extracts the resolved customer, computes derived fields, and emits a new
// skill.output event with profile.data fragments.
// ─────────────────────────────────────────────────────────────

export const skill = {
  name: 'profile-fetcher',
  id: 'profile-fetcher.skill',
  domain: 'customer-data',
  description: 'Fetches full customer profile when identity is resolved',

  onLoad(bus: any) {
    bus.on('skill.output', (event: any) => {
      const fragments = event.payload?.fragments ?? [];
      const idFragment = fragments.find((f: any) => f.name === 'identity.resolved');
      if (!idFragment) return;

      const customer = idFragment.value?.customer ?? idFragment.value;
      if (!customer) return;

      const orders = customer.orders ?? [];
      const revenue = orders.reduce((sum, o) => sum + (o.amount ?? 0), 0);

      const profileFragments = [{
        type: 'data',
        name: 'profile.data',
        value: {
          name: customer.name,
          country: customer.country ?? null,
          city: customer.city ?? null,
          address: customer.address ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          orderCount: orders.length,
          totalRevenue: revenue,
          recentOrders: orders.slice(-5).map(o => ({
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
      }];

      const taskId = event.trace?.taskId ?? event.payload?.taskId ?? event.id;
      bus.emitEvent('skill.output', {
        type: 'skill.output',
        skill: 'profile-fetcher.skill',
        fragments: profileFragments,
        complete: true,
        taskId,
      }, 'RUNTIME', taskId);
    });
  },
};

export default skill;