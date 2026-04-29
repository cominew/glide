// apps/dashboard/events/chat.ts

export type AgentResult = {
  type:  'ai' | 'tool' | 'error';
  text?: string;
  data?: any;
  metadata?: { usedSkills?: string[]; timeline?: Timeline; [key: string]: any };
};

export interface TimelineStep {
  skill: string; params?: Record<string, unknown>; input?: any;
  output?: any; duration?: number; outputType?: string;
  status?: 'running'|'done'|'error'; thoughtBefore?: string; thoughtAfter?: string;
}

export interface Timeline {
  thinking: string;
  plan: { steps: any[]; raw: string };
  steps: TimelineStep[];
  finalAnswer: string;
}

export interface ChatMessage {
  id: number; role: 'user'|'assistant'; text?: string; result?: AgentResult;
}

export type Lang = 'zh' | 'en';
export type Tab  = 'dashboard'|'customers'|'ai'|'operations'|'health'|'logs'|'settings';

export interface Customer {
  id: string; name: string; email?: string;
  orders: number; revenue: number; country?: string;
}

export interface MonthlyTrendPoint { month: string; amount: number; }

export interface OverviewData {
  revenue: number; orders: number; customers: number; countries: number;
  monthlyTrend: MonthlyTrendPoint[];
  topProducts: { name: string; sales: number }[];
}
