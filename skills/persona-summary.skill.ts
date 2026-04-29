// skills/persona-summary.skill.ts
export const skill = {
  name: 'persona-summary',
  id: 'persona-summary.skill',
  domain: 'presentation',
  description: 'Generates human-readable profile summary from profile.data',

  onLoad(bus: any, ctx: any) {
    bus.on('skill.output', (event: any) => {
      const profileFragments = (event.payload?.fragments ?? []).filter((f: any) => f.name === 'profile.data');
      if (!profileFragments.length) return;

      this._processAndEmit(bus, event, profileFragments.map(f => f.value), ctx);
    });
  },

  async _processAndEmit(bus: any, event: any, profiles: any[], ctx: any) {
    const outputFragments: any[] = [];
    const taskId = event.trace?.taskId ?? event.payload?.taskId ?? event.id;

    if (profiles.length > 0) {
      const profile = profiles[0];

      outputFragments.push({
        type: 'data',
        name: 'profile.output',
        value: profile,
        complete: true,
      });

      let narrative: string | null = null;
      if (ctx?.llm) {
        try {
          const prompt = [
            '你是商业智能助手。基于以下客户数据生成一段自然、亲切的回复。',
            `客户数据：\n${JSON.stringify(profile, null, 2)}`,
            '要求：包含姓名、国家、城市、联系方式、订单数量、总消费金额，回复3-5句。',
          ].join('\n');
          narrative = (await ctx.llm.generate(prompt))?.trim() || null;
        } catch {}
      }

      if (!narrative) {
        const lines: string[] = [];
        lines.push(`**${profile.name}**`);
        const location = [profile.city, profile.country].filter(Boolean).join(', ');
        if (location) lines.push(`📍 ${location}`);
        if (profile.email) lines.push(`✉️ ${profile.email}`);
        if (profile.phone) lines.push(`📞 ${profile.phone}`);
        lines.push(`Orders: ${profile.orderCount} · Total Revenue: $${(profile.totalRevenue ?? 0).toFixed(2)}`);
        narrative = lines.join('\n');
      }

      outputFragments.push({
        type: 'data',
        name: 'persona.summary',
        value: narrative,
      });
    }

    bus.emitEvent('skill.output', {
      type: 'skill.output',
      skill: 'persona-summary.skill',
      fragments: outputFragments,
      complete: true,
      taskId,
    }, 'RUNTIME', taskId);
  },

  match() { return false; },
  guard() { return true; },
  observe() { return null; },
  execute() { return Promise.resolve([]); },
  emit(f: any[]) { return { type: 'skill.output', skill: 'persona-summary.skill', fragments: f, complete: true }; },
};

export default skill;