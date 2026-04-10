// kernel/policy-engine.ts

import { SkillStep } from './types';

export class PolicyEngine {

  constructor(private constitution: string) {}

  validatePlan(steps: SkillStep[]): SkillStep[] {

    return steps
      .map(step => this.validateStep(step))
      .filter(Boolean) as SkillStep[];
  }

  private validateStep(step: SkillStep): SkillStep | null {

  const allowedSkills = [
    'sales',
    'customer',
    'knowledge_retrieval',
    'support'
  ];

  if (!allowedSkills.includes(step.skill)) {
    console.warn(`[Policy] Blocked skill: ${step.skill}`);
    return null;
  }

  const params: any = step.params ?? {};

  if (typeof params.dateRange === 'string') {
    params.dateRange = this.normalizeDate(params.dateRange);
  }

  return {
    ...step,
    params
  };
}

  private normalizeDate(date: string): string {
    return date.replace(/[^0-9-]/g, '').slice(0, 7);
  }
}