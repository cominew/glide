import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { Agent } from '../../framework/core/agent.js';

const app = express();
const PORT = 3001;
const BASE = 'D:/.openclaw';
const WS = path.join(BASE, 'workspace');
const IDX = (f: string) => path.join(WS, 'indexes', f);

app.use(cors());
app.use(express.json());

async function readJSON(p: string) {
  try {
    const data = await fs.readFile(p, 'utf-8');
    return JSON.parse(data);
  } catch { return null; }
}

async function getDashboardData() {
  const raw = await readJSON(IDX('customers/customers.json')) || [];
  const countriesData = await readJSON(IDX('countries/countries.json')) || {};

  const monthlyMap: Record<string, number> = {};
  const productMap = new Map();

  const processedCustomers = raw.map((c: any) => {
    const revenue = c.revenue || c.orders?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;
    c.orders?.forEach((o: any) => {
      if (o.date) {
        const month = o.date.slice(0, 7);
        monthlyMap[month] = (monthlyMap[month] || 0) + (o.amount || 0);
      }
      const pName = o.product || 'Unknown';
      const existing = productMap.get(pName) || { sales: 0, revenue: 0 };
      productMap.set(pName, { 
        sales: existing.sales + (o.quantity || 1), 
        revenue: existing.revenue + (o.amount || 0) 
      });
    });
    return { ...c, revenue };
  }).sort((a: any, b: any) => b.revenue - a.revenue);

  return {
    totalRevenue: processedCustomers.reduce((s: number, c: any) => s + c.revenue, 0),
    totalOrders: processedCustomers.reduce((s: number, c: any) => s + (c.orders?.length || 0), 0),
    customerCount: processedCustomers.length,
    monthlyTrend: Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount: +amount.toFixed(2) })).sort((a, b) => a.month.localeCompare(b.month)),
    topProducts: Array.from(productMap.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales).slice(0, 5),
    topCustomers: processedCustomers.slice(0, 5),
    countries: Object.keys(countriesData).length
  };
}

async function start() {
  try {
    const agent = new Agent(BASE);
    await agent.init();
    console.log('[Server] Agent initialized');

    app.get('/api/overview', async (_, res) => {
      try {
        const data = await getDashboardData();
        res.json(data);
      } catch (err) {
        console.error('Overview error:', err);
        res.status(500).json({ error: 'Failed to get overview' });
      }
    });

    app.get('/api/health', (_, res) => {
      res.json({ status: 'healthy' });
    });

    app.post('/api/chat', async (req, res) => {
      const query = req.body.message || req.body.query;
      if (!query) return res.status(400).json({ error: 'Query is required' });

      try {
        const result = await agent.process(query);
        console.log('[Chat] Result:', JSON.stringify(result, null, 2));
        res.json({
          text: result.output?.text || 'No response',
          data: result.output?.data || null,
          metadata: result.metadata || {},
          success: true
        });
      } catch (err: any) {
        console.error('[Chat] Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
      }
    });

    app.post('/api/feedback', async (req, res) => {
      const feedbackFile = path.join(WS, 'memory', 'feedback.json');
      try {
        const feedbacks = await readJSON(feedbackFile) || [];
        feedbacks.push({ ...req.body, timestamp: new Date().toISOString() });
        await fs.writeFile(feedbackFile, JSON.stringify(feedbacks, null, 2));
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: 'Failed to save feedback' });
      }
    });

    app.listen(PORT, () => console.log(`[Server] 🚀 Running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();