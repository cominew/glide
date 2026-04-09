// apps/server/http-server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Agent } from '../../runtime/agent.js';
import { SkillContext } from '../../kernel/types.js';
import { globalEventBus } from '../../kernel/event-bus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// 客户数据加载函数（保持不变）
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

  // 原有 API 端点（保持不变）
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

  // ======================= 新的 SSE 端点（事件驱动） =======================
  app.post('/api/chat/stream', async (req, res) => {
    const query = req.body.message || req.body.query;
    const sessionId = req.body.sessionId ?? 'default';
    if (!query) {
      res.status(400).json({ error: 'Missing message' });
      return;
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // 将 Agent 事件直接写入 SSE
    const eventHandler = (event: any) => {
      if (res.writableEnded) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    globalEventBus.onAny(eventHandler);

    // 构建 SkillContext
    const context: SkillContext = {
      memory: { history: [] },
      logger: console,
      llm: (agent as any)['llm'],   // 访问私有属性（需要确保 Agent 暴露 llm 或使用 getter）
      workspace: ROOT,
      originalQuery: query,
      sessionId,
    };

    // 执行 Agent（不等待）
    agent.execute(query, sessionId, taskId).catch((err: any) => {
      console.error('[Stream] Agent execution error:', err);
      globalEventBus.emitEvent('task:error', { error: String(err), phase: 'execution' }, taskId);
    });

    // 客户端断开时清理
    req.on('close', () => {
      globalEventBus.offAny(eventHandler);
      globalEventBus.stopHeartbeat(taskId);
      if (!res.writableEnded) res.end();
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => console.log(`[Server] 🚀 Glide backend running at http://localhost:${PORT}`));
}

main().catch(err => { console.error('[Server] Fatal startup error:', err); process.exit(1); });