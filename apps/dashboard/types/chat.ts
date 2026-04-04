// D:\.openclaw\app\web-dashboard\src\types\chat.ts

export type AgentResult = {
  type: 'ai' | 'tool' | 'error';
  text?: string;
  message?: string;
  data?: any;
  metadata?: any;
};

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  result?: AgentResult;
}

export type Lang = 'zh' | 'en';
export type Tab = 'dashboard' | 'customers' | 'ai' | 'health' | 'settings' | 'logs';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  orders: number;
  revenue: number;
  country?: string;
}

export interface OverviewData {
  revenue: number;
  orders: number;
  customers: number;
  countries: number;
  monthlyTrend: { month: string; revenue: number }[];
  topCustomers: Customer[];
  topCountries: { name: string; revenue: number; orders: number }[];
  topProducts: any[];
}