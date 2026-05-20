// skills/persona-summary.skill.ts
import type { Skill, SkillContext, SkillResult, SkillFragment } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

// 复用项目中已有的货币检测逻辑（例如从 RenderData 或其他工具导入）
function detectCurrency(country?: string): string {
  if (!country) return 'USD';
  const c = country.toUpperCase();
  if (c === 'UK' || c === 'GB' || c === 'UNITED KINGDOM') return 'GBP';
  if (['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE', 'GERMANY', 'FRANCE'].includes(c)) return 'EUR';
  if (c === 'JP' || c === 'JAPAN') return 'JPY';
  if (c === 'CA' || c === 'CANADA') return 'CAD';
  if (c === 'AU' || c === 'AUSTRALIA') return 'AUD';
  // 默认使用数据集中最常见的货币
  return 'USD';
}

export const skill: Skill = {
  name: 'persona-summary',
  description: 'Generates human-readable profile summary from profile.data',
  keywords: [],
  
canExist(event: GlideEvent, text?: string): boolean {
    if (event.type !== 'skill.output') return false;
    const skill = event.payload?.skill;
    // 保持原有对 profile-fetcher 的响应
    if (skill === 'profile-fetcher') {
        const fragments = event.payload?.fragments ?? [];
        return fragments.some((f: any) => f.name === 'profile.data');
    }
    // ⭐ 新增：响应 sales 技能的输出
    if (skill === 'sales') {
        const fragments = event.payload?.fragments ?? [];
        return fragments.some((f: any) =>
            f.name === 'monthly_report' || f.name === 'overview' || f.name === 'sales_by_country'
        );
    }
    return false;
},

  async handler(input: any, context?: SkillContext): Promise<SkillResult> {
    const fragments = input?.fragments ?? [];
    const profileFragment = fragments.find((f: any) => f.name === 'profile.data');
    if (!profileFragment?.value) {
      return { state: 'partial', phase: 'analysis', fragments: [], confidence: 0 };
    }

    const profile = profileFragment.value;
    if (profile.unresolved) {
      return {
        state: 'emitted',
        phase: 'analysis',
        confidence: 0.9,
        fragments: [{
          type: 'data',
          name: 'persona.summary',
          value: `I'm sorry, but I couldn't find any specific information for "${profile.name}" in our records. Would you like to try a different name?`,
          role: 'summary',
          confidence: 0.9,
          source: 'persona-summary.skill',
          phase: 'analysis',
        }],
      };
    }

    // 从订单中提取真实货币

    const firstOrder = profile.recentOrders?.[0] ?? profile.orders?.[0];
    const currencySymbol = firstOrder?.currency ?? '$'; 

    // 构建 LLM prompt
    const country = profile.country ?? 'an unknown country';
    const prompt = `Write a short, friendly summary in English for the following customer profile.
All amounts are in ${currencySymbol}. The customer is from ${profile.country ?? 'an unknown country'}.
Profile data:\n${JSON.stringify(profile, null, 2)}`;

    let narrative: string | null = null;
    if (context?.llm) {
      try {
        narrative = (await context.llm.generate(prompt))?.trim() || null;
      } catch {}
    }

    if (!narrative) {
      const lines = [
        profile.name,
        [profile.city, profile.country].filter(Boolean).join(', '),
        profile.email,
        profile.phone,
        `Orders: ${profile.orderCount ?? 0}`
      ].filter(Boolean);
      narrative = lines.join(' | ');
    }

    return {
      state: 'emitted',
      phase: 'analysis',
      confidence: 0.9,
      fragments: [
        {
          type: 'data',
          name: 'persona.summary',
          value: narrative,
          role: 'summary',
          confidence: 0.9,
          source: 'persona-summary.skill',
          phase: 'analysis',
        },
        {
          type: 'signal',
          name: 'stabilization.ready',
          value: { reason: 'persona-summary-complete' },
          role: 'summary',
          confidence: 0.95,
          source: 'persona-summary.skill',
          phase: 'analysis',
        }
      ],
    };
  },
};