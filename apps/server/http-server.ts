import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Agent } from '../../runtime/agent.js';
import { OllamaClient } from '../../kernel/llm/ollama-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

interface Customer {
  name: string;
  country?: string;
  email?: string;
  orders?: { amount?: number; date?: string; product?: string; quantity?: number }[];
}

function loadCustomers(): Customer[] {
  const file = path.join(ROOT, 'memory', 'indexes', 'customers', 'customers.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return []; }
}

function buildOverview(customers: Customer[]) {
  const rev = (c: Customer) => (c.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const totalRevenue = customers.reduce((s, c) => s + rev(c), 0);
  const totalOrders = customers.reduce((s, c) => s + (c.orders ?? []).length, 0);
  const countrySet = new Set(customers.map(c => c.country).filter(Boolean));

  const byMonth: Record<string, number> = {};
  for (const c of customers)
    for (const o of (c.orders ?? []))
      if (o.date) byMonth[o.date.slice(0, 7)] = (byMonth[o.date.slice(0, 7)] ?? 0) + (o.amount ?? 0);

  const monthlyTrend = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, amount]) => ({ month, amount }));

  const byProduct: Record<string, number> = {};
  for (const c of customers)
    for (const o of (c.orders ?? []))
      byProduct[o.product ?? 'Unknown'] = (byProduct[o.product ?? 'Unknown'] ?? 0) + (o.quantity ?? 1);

  const topProducts = Object.entries(byProduct)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, sales]) => ({ name, sales }));

  return { revenue: totalRevenue, orders: totalOrders, customers: customers.length, countries: countrySet.size, monthlyTrend, topProducts };
}

function buildTopCustomers(customers: Customer[], limit = 20) {
  return customers
    .map(c => ({
      name: c.name,
      country: c.country ?? '',
      email: c.email ?? '',
      revenue: (c.orders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0),
      orders: (c.orders ?? []).length,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

async function main() {
  const agent = new Agent(ROOT);
  await agent.init();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/overview', (_req, res) => {
    try { res.json(buildOverview(loadCustomers())); }
    catch (err) { res.status(500).json({ error: String(err) }); }
  });

  app.get('/api/customers/top', (req, res) => {
    try { res.json(buildTopCustomers(loadCustomers(), Number(req.query.limit ?? 20))); }
    catch (err) { res.status(500).json({ error: String(err) }); }
  });

  app.post('/api/chat', async (req, res) => {
  const query = req.body.message || req.body.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const result = await agent.process(query);
    const output = result.output;
    const responseText = typeof output === 'string' ? output : (output?.text || 'No response');
    res.json({
      text: responseText,
      data: output?.data || null,
      metadata: result.metadata || {},
      success: true
    });
  } catch (err) {
    console.error('[Chat] Error:', err);
    res.status(500).json({ error: String(err) });
  }
});

  app.post('/api/chat/stream', async (req, res) => {
    const query: string = req.body.message || req.body.query;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 1️⃣ Planning
      sendEvent('planning', { status: 'start' });
      const steps = await agent.getPlan(query);
      sendEvent('planning', { steps });

      // 2️⃣ Execute skills
      for (const step of steps) {
        sendEvent('skill-start', { skill: step.skill, params: step.params });
        const result = await agent.executeSkill(step.skill, { query, ...step.params });
        sendEvent('skill-end', { skill: step.skill, output: result.output });
      }

      // 3️⃣ LLM stream
      sendEvent('answer-start', {});
      const llm = new OllamaClient();
      await llm.generateStream(query, (token: string) => {
        sendEvent('answer-token', { token });
      });
      sendEvent('answer-end', {});
    } catch (err) {
      sendEvent('error', { message: String(err) });
    } finally {
      res.end();
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => console.log(`[Server] 🚀 Glide backend running at http://localhost:${PORT}`));
}

main().catch(err => { console.error('[Server] Fatal startup error:', err); process.exit(1); });