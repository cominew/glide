// apps/dashboard/gateways/api.ts
// ─────────────────────────────────────────────────────────────
// Glide v4 — HTTP Gateway Client
//
// v4 server endpoints:
//   GET  /api/health          → { status: 'alive' }
//   POST /api/query           → { accepted, eventId }
//   GET  /api/events/stream   → SSE
//   POST /api/system/signal   → { accepted, eventId }
//
// overview / customers/top are no longer served by v4 server.
// These return empty data gracefully so the dashboard still renders.
// ─────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3001/api';

export const api = {

  async health(): Promise<{ status: string; timestamp: number }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // v4 returns 'alive', normalize to 'ok' for frontend compat
    return { ...data, status: data.status === 'alive' ? 'ok' : data.status };
  },

  // Send a user query into the event field
  async query(message: string, sessionId?: string): Promise<{ eventId: string }> {
    const res = await fetch(`${API_BASE}/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, sessionId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { eventId: data.eventId };
  },

  // Emit a system signal into the event field
  async signal(payload: Record<string, any>): Promise<{ eventId: string }> {
    const res = await fetch(`${API_BASE}/system/signal`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Overview — v4 server does not serve this.
  // Returns empty structure so DashboardTab renders without crashing.
  async overview(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/overview`);
      if (res.ok) return res.json();
    } catch {}
    return {
      revenue: 0, orders: 0, customers: 0, countries: 0,
      monthlyTrend: [], topProducts: [],
    };
  },

  // Top customers — v4 server does not serve this.
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
