// apps/server/http-server.ts — pure SSE event bridge

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Agent } from '../../runtime/agent.js';
import { globalEventBus } from '../../kernel/event-bus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../../');

interface Customer {
  name: string; country?: string; email?: string;
  orders?: { amount?: number; date?: string; product?: string; quantity?: number }[];
}

function loadCustomers(): Customer[] {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT,'memory','indexes','customers','customers.json'),'utf-8')); }
  catch { return []; }
}

function buildOverview(c: Customer[]) {
  const rev = (x: Customer) => (x.orders??[]).reduce((s,o)=>s+(o.amount??0),0);
  const byMonth: Record<string,number> = {};
  const byProd:  Record<string,number> = {};
  for (const x of c) for (const o of (x.orders??[])) {
    if (o.date) byMonth[o.date.slice(0,7)] = (byMonth[o.date.slice(0,7)]??0)+(o.amount??0);
    byProd[o.product??'Unknown'] = (byProd[o.product??'Unknown']??0)+(o.quantity??1);
  }
  return {
    revenue:      c.reduce((s,x)=>s+rev(x),0),
    orders:       c.reduce((s,x)=>s+(x.orders??[]).length,0),
    customers:    c.length,
    countries:    new Set(c.map(x=>x.country).filter(Boolean)).size,
    monthlyTrend: Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,amount])=>({month,amount})),
    topProducts:  Object.entries(byProd).sort(([,a],[,b])=>b-a).slice(0,5).map(([name,sales])=>({name,sales})),
  };
}

function buildTopCustomers(c: Customer[], limit=20) {
  return c.map(x=>({ name:x.name, country:x.country??'', email:x.email??'',
    revenue:(x.orders??[]).reduce((s,o)=>s+(o.amount??0),0), orders:(x.orders??[]).length }))
    .sort((a,b)=>b.revenue-a.revenue).slice(0,limit);
}

async function main() {
  const agent = new Agent(ROOT);
  await agent.init();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/overview', (_req,res) => {
    try { res.json(buildOverview(loadCustomers())); }
    catch (e) { res.status(500).json({error:String(e)}); }
  });

  app.get('/api/customers/top', (req,res) => {
    try { res.json(buildTopCustomers(loadCustomers(), Number(req.query.limit??20))); }
    catch (e) { res.status(500).json({error:String(e)}); }
  });

  app.get('/api/health', (_req,res) => {
    res.json({status:'ok', uptime:process.uptime(), timestamp:new Date().toISOString()});
  });

  app.post('/api/session/clear', (req,res) => {
    agent.clearHistory(req.body.sessionId??'default');
    res.json({success:true});
  });

  // Feedback (like/dislike on experience records)
  app.post('/api/feedback', (req,res) => {
    const {taskId, feedback} = req.body;
    if (!taskId || !['like','dislike'].includes(feedback))
      return res.status(400).json({error:'Invalid'});
    const file = path.join(ROOT,'memory','experiences',`${taskId}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({error:'Not found'});
    try {
      const r = JSON.parse(fs.readFileSync(file,'utf-8'));
      r.userFeedback = feedback;
      fs.writeFileSync(file, JSON.stringify(r,null,2));
      res.json({success:true});
    } catch (e) { res.status(500).json({error:String(e)}); }
  });

  // REST chat fallback
  app.post('/api/chat', async (req,res) => {
    const query = req.body.message||req.body.query;
    const sid   = req.body.sessionId??'default';
    if (!query) return res.status(400).json({error:'Missing message'});
    try {
      const result = await agent.process(query, sid);
      res.json(result);
    } catch (err) {
      res.status(500).json({error:String(err)});
    }
  });

  // SSE streaming — pure event bridge, zero business logic
  app.post('/api/chat/stream', async (req,res) => {
    const query = req.body.message||req.body.query;
    const sid   = req.body.sessionId??'default';
    if (!query) { res.status(400).json({error:'Missing message'}); return; }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Flush headers immediately so browser sees the connection
    res.flushHeaders?.();

    let closed = false;

    const handler = (event: any) => {
      if (closed || event.taskId !== taskId) return;
      try {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {}
    };

    globalEventBus.onAny(handler);

    // Fire and forget — events stream through the bus
    agent.execute(query, sid, taskId).catch(err => {
      if (!closed) {
        res.write(`event: task:error\ndata: ${JSON.stringify({
          type:'task:error', taskId, timestamp:Date.now(),
          payload:{ error:String(err), phase:'execution' }
        })}\n\n`);
        res.end();
      }
    });

    req.on('close', () => {
      closed = true;
      globalEventBus.offAny(handler);
      globalEventBus.stopHeartbeat(taskId);
    });
  });

  const PORT = Number(process.env.PORT??3001);
  app.listen(PORT, ()=>console.log(`[Server] 🚀 Glide backend at http://localhost:${PORT}`));
}

main().catch(err=>{ console.error('[Server] Fatal:',err); process.exit(1); });
