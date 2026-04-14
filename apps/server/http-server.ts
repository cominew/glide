// apps/server/http-server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { GlideOS }          from '../../kernel/bootstrap';
import { Task, GlideEvent } from '../../kernel/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

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

function buildOverview(customers: Customer[]) {
  const rev = (x: Customer) => (x.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const byMonth: Record<string,number> = {};
  const byProd:  Record<string,number> = {};
  for (const x of customers) {
    for (const o of x.orders ?? []) {
      if (o.date) { const m = o.date.slice(0,7); byMonth[m] = (byMonth[m]??0) + (o.amount??0); }
      byProd[o.product??'Unknown'] = (byProd[o.product??'Unknown']??0) + (o.quantity??1);
    }
  }
  return {
    revenue:  customers.reduce((s,x) => s+rev(x), 0),
    orders:   customers.reduce((s,x) => s+(x.orders??[]).length, 0),
    customers: customers.length,
    countries: new Set(customers.map(x=>x.country).filter(Boolean)).size,
    monthlyTrend: Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,amount])=>({month,amount})),
    topProducts:  Object.entries(byProd).sort(([,a],[,b])=>b-a).slice(0,5).map(([name,sales])=>({name,sales})),
  };
}

function buildTopCustomers(customers: Customer[], limit = 20) {
  return customers
    .map(c => ({
      name: c.name, country: c.country??'', email: c.email??'',
      orders: (c.orders??[]).length,
      revenue: (c.orders??[]).reduce((s,o) => s+(o.amount??0), 0),
    }))
    .sort((a,b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function createTaskFromRequest(body: { message?: string; sessionId?: string }): Task {
  const now = Date.now();
  return {
    id: `task_${now}_${Math.random().toString(36).slice(2,6)}`,
    type: 'human_request', intent: body.message ?? '',
    context: { sessionId: body.sessionId ?? 'default' },
    status: 'CREATED', source: 'human',
    createdAt: now, updatedAt: now,
    metadata: { priority: 5, risk: 'low', sessionId: body.sessionId },
  };
}

function setupSSEStream(res: express.Response, taskId: string, eventBus: GlideOS['eventBus']) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Events that come from Dispatcher (payload = Task object)
  const DISPATCHER_EVENTS = new Set([
    'task.validated','task.routed','task.executing',
    'task.failed','task.blocked','task.awaiting_human',
  ]);

  // Events that come from Orchestrator (payload = plain object, taskId on event root)
  const ORCHESTRATOR_EVENTS = new Set([
    'task.started','thinking.start','thinking.end',
    'planning.start','planning.end',
    'skill.start','skill.end','skill.error',
    'aggregation.end','answer.end','task.completed',
  ]);

  const handler = (event: any) => {
    const type = event.type as string;

    // Match by event.taskId (set by Orchestrator) OR by payload.id (set by Dispatcher)
    const isMatch =
      event.taskId === taskId ||
      event.payload?.id === taskId;

    if (!isMatch) return;
    if (!DISPATCHER_EVENTS.has(type) && !ORCHESTRATOR_EVENTS.has(type)) return;

    res.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  eventBus.onAny(handler);
  res.on('close', () => { eventBus.offAny(handler); res.end(); });
}

export async function startHttpServer(os: GlideOS) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const { dispatcher, eventBus, consciousLoop, constitution, humanGate } = os;

  app.get('/api/health', (_req, res) => {
    res.json({ status:'ok', kernel:true, dispatcher:true, timestamp:Date.now() });
  });

  app.get('/api/overview', (_req, res) => {
    res.json(buildOverview(loadCustomers()));
  });

  app.get('/api/customers/top', (req, res) => {
    const limit = Number((req.query as any).limit ?? 20);
    res.json(buildTopCustomers(loadCustomers(), limit));
  });

  app.post('/api/chat', async (req, res) => {
    const task   = createTaskFromRequest(req.body);
    const result = await dispatcher.dispatch(task);
    res.json(result);
  });

  app.post('/api/chat/stream', (req, res) => {
    const task = createTaskFromRequest(req.body);
    setupSSEStream(res, task.id, eventBus);
    dispatcher.dispatch(task).catch(err => {
      console.error('[HTTP] Dispatch error:', err);
      res.write(`event: task.failed\ndata: ${JSON.stringify({error:err.message})}\n\n`);
      res.end();
    });
  });

  // Global SSE stream — broadcasts ALL kernel events to the frontend.
// Frontend EventViewer subscribes here, not to /api/chat/stream.
// /api/chat/stream stays for the chat UI flow only.
 
 app.get('/api/events/stream', (req, res) => {
   res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
     Connection:      'keep-alive',
   });

   // Send a heartbeat every 15s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
   }, 15_000);

   // Forward ALL events from the kernel EventBus
   const handler = (event: any) => {
     try {
       const type = event.type ?? 'unknown';
       res.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);
     } catch {}
   };

   eventBus.onAny(handler);

   req.on('close', () => {
     clearInterval(heartbeat);
     eventBus.offAny(handler);
     res.end();
   });
 });

  app.post('/api/session/clear', (_req, res) => { res.json({ ok: true }); });

  app.get('/api/ops', (_req, res) => {
    const stats       = consciousLoop.getStats();
    const reflections = consciousLoop.getReflections(20);
    const ruleCount   = constitution.listRules().length;
    const pending     = humanGate.pendingCount();
    res.json({
      vitals: {
        llm:'Idle', dispatcher:'Listening', tasksRunning:0, pendingApproval:pending,
        memoryWrites:'OK', consciousLoop: stats.totalObserved>0?'Observing':'Idle',
        policyEngine:'Ready', scheduler:'Paused',
      },
      activeTasks:[], agenda:[], outcomes:[],
      governance: { rules:ruleCount, violations:0, awaitingHuman:pending },
      reflections: reflections.map(r => ({ id:r.id, anomaly:r.anomaly, observation:r.observation, eventType:r.eventType })),
    });
  });

  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => console.log(`[Server] 🚀 Glide backend at http://localhost:${PORT}`));
}
