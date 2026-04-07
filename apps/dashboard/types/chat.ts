// apps/dashboard/types/chat.ts

export type AgentResult = {
  type: 'ai' | 'tool' | 'error';

  text?: string;
  data?: any;

  metadata?: {
    usedSkills?: string[];

    timeline?: {
      plan?: {
        steps: any[];
        raw: string;
      };

      steps?: {
        skill: string;
        input: any;
        output: any;
        duration: number;
      }[];

      finalAnswer?: string;
    };

    [key: string]: any;
  };
};

export interface ChatMessage {
  id:      number;
  role:    'user' | 'assistant';
  text?:   string;
  result?: AgentResult;
}

export type Lang = 'zh' | 'en';
export type Tab  = 'dashboard' | 'customers' | 'ai' | 'health' | 'settings' | 'logs';

export interface Customer {
  id:       string;
  name:     string;
  email?:   string;
  orders:   number;
  revenue:  number;
  country?: string;
}

export interface MonthlyTrendPoint {
  month:  string;
  amount: number;
}

export interface OverviewData {
  revenue:      number;
  orders:       number;
  customers:    number;
  countries:    number;
  monthlyTrend: MonthlyTrendPoint[];
  topProducts:  { name: string; sales: number }[];
}


