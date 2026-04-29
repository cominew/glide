// apps/server/http-server.ts
// ─────────────────────────────────────────────────────────────
// Glide OS v4 — HTTP Sensor Node
//
// Routes:
//   GET  /api/health            — system alive check
//   GET  /api/overview          — business data summary
//   GET  /api/customers/top     — top customers by revenue
//   GET  /api/events/stream     — global SSE stream
//   POST /api/query             — emit input.user into event field
//   POST /api/system/signal     — emit arbitrary system signal
// ─────────────────────────────────────────────────────────────

import express from 'express';
import cors    from 'cors';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

import type { GlideOS }    from '../../kernel/bootstrap.js';
import type { GlideEvent } from '../../kernel/event-bus/event-contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../../');

// ── SSE blocklist ─────────────────────────────────────────────
const SSE_BLOCKED = new Set([
  'system.clock.pulse',
  'event.state_changed',
  'event.archived',
  'event.ttl_expired',
]);

// ── Customer data ──────────────────────────────────────────────

interface Customer {
  name: string; country?: string; city?: string;
  email?: string; phone?: string;
  orders?: { amount?: number; date?: string; product?: string; quantity?: number }[];
}

function loadCustomers(): Customer[] {
  for (const p of [
    path.join(ROOT, 'indexes', 'customers', 'customers.json'),
    path.join(ROOT, 'memory', 'indexes', 'customers', 'customers.json'),
  ]) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}
  }
  return [];
}

function buildOverview(c: Customer[]) {
  const rev = (x: Customer) => (x.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const byMonth: Record<string, number> = {};
  const byProd:  Record<string, number> = {};
  for (const x of c) {
    for (const o of x.orders ?? []) {
      if (o.date) { const m = o.date.slice(0,7); byMonth[m] = (byMonth[m]??0)+(o.amount??0); }
      byProd[o.product??'Unknown'] = (byProd[o.product??'Unknown']??0)+(o.quantity??1);
    }
  }
  return {
    revenue:  c.reduce((s, x) => s + rev(x), 0),
    orders:   c.reduce((s, x) => s + (x.orders ?? []).length, 0),
    customers: c.length,
    countries: new Set(c.map(x => x.country).filter(Boolean)).size,
    monthlyTrend: Object.entries(byMonth)
      .sort(([a],[b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount })),
    topProducts: Object.entries(byProd)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 5)
      .map(([name, sales]) => ({ name, sales })),
  };
}

function buildTopCustomers(c: Customer[], limit = 20) {
  return c.map(x => ({
    name:    x.name,
    country: x.country ?? '',
    city:    x.city ?? '',
    email:   x.email ?? '',
    phone:   x.phone ?? '',
    orders:  (x.orders ?? []).length,
    revenue: (x.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0),
  }))
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, limit);
}

// ── SSE ───────────────────────────────────────────────────────

function openSSE(res: express.Response) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection:      'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
}

function writeSSE(res: express.Response, event: GlideEvent) {
  try {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  } catch {}
}

// ── Server ────────────────────────────────────────────────────

export async function startHttpServer(os: GlideOS) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const { bus } = os;

  // ── Health ────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // ── Business data (read from index files) ─────────────────
  // These are pure data endpoints — they do not emit events.
  // The event field handles queries; these serve the dashboard UI.

  app.get('/api/overview', (_req, res) => {
    res.json(buildOverview(loadCustomers()));
  });

  app.get('/api/customers/top', (req, res) => {
  const limit = Number((req.query as any).limit ?? 20);
  const sort  = (req.query as any).sort as string || 'revenue'; // revenue | newest

  const allCustomers = loadCustomers();
  if (sort === 'newest') {
    // 按最近订单日期降序
    const sorted = allCustomers
      .map(c => ({
        ...c,
        lastOrderDate: (c.orders ?? []).reduce((latest: string, o: any) => {
          if (!o.date) return latest;
          return !latest || o.date > latest ? o.date : latest;
        }, '')
      }))
      .sort((a, b) => b.lastOrderDate.localeCompare(a.lastOrderDate)) // 新到旧
      .slice(0, limit);
    return res.json(sorted);
  }

  // 默认收入排序
  res.json(buildTopCustomers(allCustomers, limit));
});

  // ── Global SSE stream ─────────────────────────────────────
  app.get('/api/events/stream', (req, res) => {
    openSSE(res);

    const handler = (event: GlideEvent) => {
      if (SSE_BLOCKED.has(event.type)) return;
      if ((event.payload as any)?.internal) return;
      writeSSE(res, event);
    };

    bus.onAny(handler);
    req.on('close', () => { bus.offAny(handler); res.end(); });
  });

  // ── User query → emit into event field ───────────────────
  app.post('/api/query', (req, res) => {
    const event = bus.emitEvent(
      'input.user',
      { input: req.body, source: 'http' },
      'SYSTEM'
    );
    res.json({ accepted: true, eventId: event.id });
  });

  // ── System signal ─────────────────────────────────────────
  app.post('/api/system/signal', (req, res) => {
    const event = bus.emitEvent(
      'system.signal',
      req.body,
      'SYSTEM'
    );
    res.json({ accepted: true, eventId: event.id });
  });

  bus.emitEvent('system.status', { status: 'alive', timestamp: Date.now() }, 'SYSTEM');

  // ── Start ─────────────────────────────────────────────────
  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => {
    console.log(`🌌 Glide v4 Sensor listening on http://localhost:${PORT}`);
  });
}