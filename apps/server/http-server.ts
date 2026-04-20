// apps/server/http-server.ts
// ─────────────────────────────────────────────────────────────
// Glide Event OS — HTTP Gateway v3
//
// Key: /api/chat/stream returns X-Task-Id header BEFORE SSE body.
// Frontend reads this header, then uses its own global EventSource
// to observe the task lifecycle — no second SSE connection needed.
//
// Route registry (each defined ONCE):
//   GET  /api/health
//   GET  /api/overview
//   GET  /api/customers/top
//   GET  /api/events/stream          ← global SSE, all components
//   POST /api/chat/stream            ← dispatch + X-Task-Id header
//   POST /api/session/clear
//   POST /api/authority/resolve
//   GET  /api/proposals
//   POST /api/proposals/:id/approve
//   POST /api/proposals/:id/reject
//   GET  /api/ops
// ─────────────────────────────────────────────────────────────

import express    from 'express';
import cors       from 'cors';
import fs         from 'fs';
import path       from 'path';
import { fileURLToPath } from 'url';

import type { GlideOS }    from '../../kernel/bootstrap.js';
import type { GlideEvent } from '../../kernel/event-bus/event-bus.js';
import { createTask }      from '../../runtime/tasks/task.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// ── SSE blocklist ─────────────────────────────────────────────

const SSE_BLOCKED = new Set([
  'system.clock.pulse',
  'event.state_changed',
  'event.archived',
  'event.ttl_expired',
  'conscious.state.updated',
]);

function isBlocked(e: GlideEvent): boolean {
  return SSE_BLOCKED.has(e.type) || !!(e.payload as any)?.internal;
}

function getEventTaskId(e: GlideEvent): string | undefined {
  return e.trace?.taskId ?? (e.payload as any)?.taskId ?? (e.payload as any)?.id;
}

// ── Customer data ──────────────────────────────────────────────

interface Customer {
  name: string; country?: string; email?: string;
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
  const rev = (x: Customer) => (x.orders ?? []).reduce((s, o) => s+(o.amount??0), 0);
  const byMonth: Record<string,number> = {};
  const byProd:  Record<string,number> = {};
  for (const x of c) for (const o of x.orders ?? []) {
    if (o.date) { const m = o.date.slice(0,7); byMonth[m]=(byMonth[m]??0)+(o.amount??0); }
    byProd[o.product??'Unknown']=(byProd[o.product??'Unknown']??0)+(o.quantity??1);
  }
  return {
    revenue:  c.reduce((s,x)=>s+rev(x),0),
    orders:   c.reduce((s,x)=>s+(x.orders??[]).length,0),
    customers: c.length,
    countries: new Set(c.map(x=>x.country).filter(Boolean)).size,
    monthlyTrend: Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,amount])=>({month,amount})),
    topProducts:  Object.entries(byProd).sort(([,a],[,b])=>b-a).slice(0,5).map(([name,sales])=>({name,sales})),
  };
}

function buildTopCustomers(c: Customer[], limit = 20) {
  return c.map(x=>({
    name:x.name, country:x.country??'', email:x.email??'',
    orders:(x.orders??[]).length,
    revenue:(x.orders??[]).reduce((s,o)=>s+(o.amount??0),0),
  })).sort((a,b)=>b.revenue-a.revenue).slice(0,limit);
}

// ── SSE helpers ───────────────────────────────────────────────

function openSSE(res: express.Response, extraHeaders: Record<string,string> = {}) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection:      'keep-alive',
    // Expose custom header to browser (CORS)
    'Access-Control-Expose-Headers': 'X-Task-Id',
    ...extraHeaders,
  });
}

function writeSSE(res: express.Response, event: GlideEvent) {
  try { res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); } catch {}
}

// ── Main ──────────────────────────────────────────────────────

export async function startHttpServer(os: GlideOS) {
  const app = express();
  app.use(cors({ exposedHeaders: ['X-Task-Id'] }));
  app.use(express.json());

  const { bus, dispatcher, store, guardian, proposals, humanGate, constitution } = os;
  const enforcer      = (os as any).enforcer      ?? null;
  const consciousLoop = (os as any).consciousLoop ?? null;

  // ── Health ────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok', events: store.count(),
      violations: guardian.getViolationCount(),
      proposals: proposals.count(), timestamp: Date.now(),
    });
  });

  // ── Business data ─────────────────────────────────────────
  app.get('/api/overview', (_req, res) => res.json(buildOverview(loadCustomers())));

  app.get('/api/customers/top', (req, res) => {
    res.json(buildTopCustomers(loadCustomers(), Number((req.query as any).limit ?? 20)));
  });

  // ── Global SSE — one stream, all components subscribe ─────
  // EventViewer, OperationsTab, ConsciousPanel, Logs all use this.
  // No taskId filtering here — each component filters in JS.
  app.get('/api/events/stream', (req, res) => {
    openSSE(res);
    const hb = setInterval(() => { try { res.write(':heartbeat\n\n'); } catch {} }, 15_000);
    const handler = (e: GlideEvent) => { if (!isBlocked(e)) writeSSE(res, e); };
    bus.onAny(handler);
    req.on('close', () => { clearInterval(hb); bus.offAny(handler); res.end(); });
  });

  // ── Chat dispatch — POST returns X-Task-Id header ─────────
  // Frontend reads the header, then watches the global EventSource
  // for events with that taskId. No second SSE connection needed.
  //
  // The response body is also an SSE stream (task-scoped) as fallback,
  // but the primary channel is the global /api/events/stream.
  app.post('/api/chat/stream', (req, res) => {
    const task = createTask({
      type:      'human_request',
      intent:    req.body.message ?? '',
      source:    'human',
      sessionId: req.body.sessionId,
    });

    // ✦ Key: send X-Task-Id BEFORE SSE body opens
    openSSE(res, { 'X-Task-Id': task.id });

    // Also stream task-scoped events (used by useChat's fetch reader)
    const hb = setInterval(() => { try { res.write(':heartbeat\n\n'); } catch {} }, 15_000);
    const handler = (e: GlideEvent) => {
      if (isBlocked(e)) return;
      const tid = getEventTaskId(e);
      if (tid === task.id) writeSSE(res, e);
    };

    bus.onAny(handler);
    req.on('close', () => { clearInterval(hb); bus.offAny(handler); res.end(); });

    // Dispatch AFTER SSE handler registered — no race condition
    dispatcher.dispatch(task).catch(err => {
      try {
        writeSSE(res, {
          id: 'err', type: 'task.failed', source: 'SYSTEM',
          timestamp: Date.now(), payload: { error: String(err) },
          trace: { taskId: task.id },
        });
        res.end();
      } catch {}
    });
  });

  // ── Session ───────────────────────────────────────────────
  app.post('/api/session/clear', (_req, res) => res.json({ ok: true }));

  // ── Authority ─────────────────────────────────────────────
  app.post('/api/authority/resolve', (req, res) => {
    const { taskId, approved, approvedBy } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    res.json({ ok: humanGate.resolve(taskId, approved === true, approvedBy ?? 'human:dashboard') });
  });

  // ── Proposals ─────────────────────────────────────────────
  app.get('/api/proposals', (_req, res) => res.json(proposals.getPending()));

  app.post('/api/proposals/:id/approve', async (req, res) => {
    const p = proposals.approve(req.params.id, req.body.approvedBy ?? 'human:dashboard');
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (p.executionIntent) {
      const task = createTask({ type:'human_request', intent:p.executionIntent.payload?.intent??p.title, source:'human' });
      dispatcher.dispatch(task).catch(console.error);
    }
    res.json({ ok: true, proposal: p });
  });

  app.post('/api/proposals/:id/reject', (req, res) => {
    res.json({ ok: proposals.reject(req.params.id, req.body.rejectedBy??'human:dashboard', req.body.reason) });
  });

  // ── Ops ───────────────────────────────────────────────────
  app.get('/api/ops', (_req, res) => {
    const reflections = consciousLoop?.getReflections(20) ?? [];
    const activeTasks = consciousLoop?.getActiveTasks()   ?? [];
    const pending     = humanGate.pendingCount();
    res.json({
      vitals: {
        dispatcher:'Listening', tasksRunning:activeTasks.length,
        pendingApproval:pending, policyEngine:'Ready',
        violations:guardian.getViolationCount(),
        constitutionCritical:enforcer?.getCriticalCount()??0,
        constitutionNotices:enforcer?.getNoticeCount()??0,
      },
      activeTasks,
      governance: {
        rules:constitution.listRules().length,
        violations:guardian.getViolationCount(),
        awaitingHuman:pending,
        audit:enforcer?.getAuditLog(10)??[],
      },
      proposalCounts: proposals.count(),
      pendingProposals: proposals.getPending().slice(0,5).map(p=>({ id:p.id, title:p.title, category:p.category, impact:p.impact })),
      reflections: reflections.map((r:any)=>({ id:r.id, anomaly:r.anomaly, observation:r.observation, eventType:r.eventType, observedAt:r.observedAt })),
      store: { total:store.count(), taskIds:store.taskIds().slice(-10) },
    });
  });

  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => console.log(`[HTTP] Glide v3 Gateway running at http://localhost:${PORT}`));
}
