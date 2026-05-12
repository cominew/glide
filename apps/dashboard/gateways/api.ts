// apps/dashboard/gateways/api.ts
// ─────────────────────────────────────────────────────────────
// Glide v4 — HTTP Gateway Client
// ─────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3001/api';

export const api = {

  async health(): Promise<{ status: string; timestamp: number }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ...data, status: data.status === 'alive' ? 'ok' : data.status };
  },

  // Returns both eventId and scopeId — scopeId is the unified causal chain key
  // 
  
  async query(message: string, sessionId?: string): Promise<{ eventId: string; scopeId: string }> {
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, sessionId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { eventId: data.eventId, scopeId: data.scopeId };
  },

  async signal(payload: Record<string, any>): Promise<{ eventId: string; scopeId: string }> {
    const res = await fetch(`${API_BASE}/system/signal`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { eventId: data.eventId, scopeId: data.scopeId };  
  },

  async overview(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/overview`);
      if (res.ok) return res.json();
    } catch {}
    return { revenue: 0, orders: 0, customers: 0, countries: 0, monthlyTrend: [], topProducts: [] };
  },

  async top(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/customers/top`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.customers ?? [];
      }
    } catch {}
    return [];
  },
};