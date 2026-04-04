import { AgentResult, OverviewData, Customer } from '../types/chat';

const API_BASE = 'http://localhost:3001';

export const api = {
  async overview(): Promise<OverviewData> {
    const res = await fetch(`${API_BASE}/api/overview`);
    if (!res.ok) throw new Error('Failed to fetch overview');
    return res.json();
  },

  async top(): Promise<Customer[]> {
    const res = await fetch(`${API_BASE}/api/overview`);
    if (!res.ok) throw new Error('Failed to fetch overview');
    const data = await res.json();
    return data.topCustomers || [];
  },

  async health(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async ask(message: string): Promise<AgentResult> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Chat request failed');
    const data = await res.json();
    return {
      type: 'ai',
      text: data.text,
      data: data.data,
      metadata: data.metadata,
    };
  },
};