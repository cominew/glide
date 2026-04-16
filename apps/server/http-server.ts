// apps/server/http-server.ts
// ─────────────────────────────────────────────────────────────
// Glide Event OS — HTTP Server
// The sole bridge between the kernel and the outside world.
//
// Key quantum model routes:
//   GET  /api/events/stream         — global SSE (all events)
//   POST /api/proposals/:id/approve — collapse superposition → reality
//   POST /api/proposals/:id/reject  — discard proposal
//   GET  /api/proposals             — list pending proposals
// ─────────────────────────────────────────────────────────────

import express    from 'express';
import cors       from 'cors';
import path       from 'path';
import fs         from 'fs';
import { fileURLToPath } from 'url';

import { GlideOS }           from '../../kernel/bootstrap.js';
import { GlideEvent }        from '../../kernel/event-bus/event-bus.js';
import { Task }              from '../../kernel/types.js';
import { createTask }        from '../../runtime/tasks/task.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// ── Data helpers ───────────────────────────────────────────────

interface Customer {
  name: string; country?: string; email?: string;
  orders?: { amount?: number; date?: string; product?: string; quantity?: number }[];
}

function loadCustomers(): Customer[] {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'memory', 'indexes', 'customers', 'customers.json'), 'utf-8'
    ));
  } catch { return []; }
}

function buildOverview(c: Customer[]) {
  const rev = (x: Customer) => (x.orders ?? []).reduce((s,o) => s+(o.amount??0), 0);
  const byMonth: Record<string,number> = {};
  const byProd:  Record<string,number> = {};
  for (const x of c) {
    for (const o of x.orders ?? []) {
      if (o.date) { const m = o.date.slice(0,7); byMonth[m]=(byMonth[m]??0)+(o.amount??0); }
      byProd[o.product??'Unknown']=(byProd[o.product??'Unknown']??0)+(o.quantity??1);
    }
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
    name: x.name, country: x.country??'', email: x.email??'',
    orders: (x.orders??[]).length,
    revenue: (x.orders??[]).reduce((s,o)=>s+(o.amount??0),0),
  })).sort((a,b)=>b.revenue-a.revenue).slice(0,limit);
}

// ── SSE helpers ────────────────────────────────────────────────

function openSSE(res: express.Response) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection:      'keep-alive',
  });
}

function writeSSE(res: express.Response, event: GlideEvent) {
  try {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  } catch {}
}

// ── Main ───────────────────────────────────────────────────────

export async function startHttpServer(os: GlideOS) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const { bus, dispatcher, consciousLoop, constitution, humanGate,
          store, lifecycle, guardian, proposals } = os;

  // ── Global SSE — all kernel events projected to UI ─────────
  app.get('/api/events/stream', (req, res) => {
    openSSE(res);
    const hb = setInterval(() => { try { res.write(':heartbeat\n\n'); } catch {} }, 15_000);
    const handler = (e: GlideEvent) => writeSSE(res, e);
    bus.onAny(handler);
    req.on('close', () => { clearInterval(hb); bus.offAny(handler); res.end(); });
  });

  // ── Health ─────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status:     'ok',
      events:     store.count(),
      violations: guardian.getViolationCount(),
      proposals:  proposals.count(),
      timestamp:  Date.now(),
    });
  });

  // ── Business data ──────────────────────────────────────────
  app.get('/api/overview', (_req, res) => {
    res.json(buildOverview(loadCustomers()));
  });

  app.get('/api/customers/top', (req, res) => {
    res.json(buildTopCustomers(loadCustomers(), Number((req.query as any).limit ?? 20)));
  });

  // ── Chat: user message → single task dispatch ──────────────
  // Guard: if request comes in before SSE is open,
  // we still dispatch once and return the task state.
  app.post('/api/chat', async (req, res) => {
    const task = createTask({
      type: 'human_request', intent: req.body.message ?? '',
      source: 'human', sessionId: req.body.sessionId,
    });
    const result = await dispatcher.dispatch(task);
    res.json(result);
  });

  // ── Chat stream: dispatch + SSE filtered to this task ──────
  app.post('/api/chat/stream', (req, res) => {
    const task = createTask({
      type: 'human_request', intent: req.body.message ?? '',
      source: 'human', sessionId: req.body.sessionId,
    });

    openSSE(res);

    const handler = (e: GlideEvent) => {
      const tid = e.trace?.taskId ?? (e.payload as any)?.taskId ?? (e.payload as any)?.id;
      if (tid === task.id) writeSSE(res, e);
    };

    bus.onAny(handler);
    req.on('close', () => { bus.offAny(handler); res.end(); });

    dispatcher.dispatch(task).catch(err => {
      try {
        res.write(`event: task.failed\ndata: ${JSON.stringify({error:err.message})}\n\n`);
        res.end();
      } catch {}
    });
  });

  // ── Session clear ──────────────────────────────────────────
  app.post('/api/session/clear', (_req, res) => res.json({ ok:true }));

  // ── Human authority: approve/reject pending tasks ──────────
  app.post('/api/authority/resolve', (req, res) => {
    const { taskId, approved, approvedBy } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const ok = humanGate.resolve(taskId, approved === true, approvedBy ?? 'human:dashboard');
    res.json({ ok });
  });

  // ── Proposals: the Superposition layer API ─────────────────

  // List all pending proposals
  app.get('/api/proposals', (_req, res) => {
    res.json(proposals.getPending());
  });

  // Approve a proposal → wavefunction collapses → enters Dispatcher
  app.post('/api/proposals/:id/approve', async (req, res) => {
    const p = proposals.approve(req.params.id, req.body.approvedBy ?? 'human:dashboard');
    if (!p) return res.status(404).json({ error: 'Proposal not found or not pending' });

    // If the proposal has an executionIntent, dispatch it now
    if (p.executionIntent) {
      const task = createTask({
        type:    'human_request',
        intent:  p.executionIntent.payload?.intent ?? p.title,
        source:  'human',
        context: { proposalId: p.id, ...p.executionIntent.payload },
      });
      dispatcher.dispatch(task).catch(console.error);
    }

    res.json({ ok: true, proposal: p });
  });

  // Reject a proposal
  app.post('/api/proposals/:id/reject', (req, res) => {
    const ok = proposals.reject(req.params.id, req.body.rejectedBy ?? 'human:dashboard', req.body.reason);
    res.json({ ok });
  });

  // ── Operations dashboard ───────────────────────────────────
  app.get('/api/ops', (_req, res) => {
    const stats  = consciousLoop.getStats();
    const active = lifecycle.getActive();
    const pending = humanGate.pendingCount();

    res.json({
      vitals: {
        llm:             'Idle',
        dispatcher:      'Listening',
        tasksRunning:    active.filter(e => e.state === 'RUNNING').length,
        pendingApproval: pending,
        memoryWrites:    'OK',
        consciousLoop:   stats.totalObserved > 0 ? 'Observing' : 'Idle',
        policyEngine:    'Ready',
        violations:      guardian.getViolationCount(),
      },
      consciousState:  consciousLoop.getState(),
      proposalCounts:  proposals.count(),
      pendingProposals: proposals.getPending().slice(0,5).map(p=>({
        id: p.id, title: p.title, category: p.category, impact: p.impact,
      })),
      activeTasks: active.slice(0,10).map(e=>({
        id: e.trace?.taskId ?? e.id, name: (e.payload as any)?.intent ?? e.type,
        state: e.state,
      })),
      governance: {
        rules:         constitution.listRules().length,
        violations:    guardian.getViolationCount(),
        awaitingHuman: pending,
      },
      reflections: consciousLoop.getReflections(20).map(r=>({
        id: r.id, anomaly: r.anomaly,
        observation: r.observation, eventType: r.eventType,
      })),
      store: { total: store.count(), taskIds: store.taskIds().slice(-10) },
    });
  });

  // ── Start ──────────────────────────────────────────────────
  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () =>
    console.log(`[HTTP] 🚀 Glide Event OS server at http://localhost:${PORT}`)
  );
}
