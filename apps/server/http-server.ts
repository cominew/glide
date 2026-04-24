// apps/server/http-server.ts
// ─────────────────────────────────────────────
// Glide OS v4 — HTTP Sensor Node
// No Dispatcher
// No Tasks
// No Coordinator
// HTTP only emits events into the field
// ─────────────────────────────────────────────

import express from 'express';
import cors from 'cors';

import type { GlideOS } from '../../kernel/bootstrap.js';
import type { GlideEvent } from '../../kernel/event-bus/event-contract.js';



// ─────────────────────────────────────────────
// SSE
// ─────────────────────────────────────────────

function openSSE(res: express.Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
}

function writeSSE(res: express.Response, event: GlideEvent) {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}


// ─────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────

export async function startHttpServer(os: GlideOS) {

  const app = express();

  app.use(cors());
  app.use(express.json());

  const { bus } = os;


  // ─────────────────────────────────────────
  // Health
  // ─────────────────────────────────────────

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'alive',
      timestamp: Date.now(),
    });
  });


  // ─────────────────────────────────────────
  // USER INPUT (NEW ENTRYPOINT)
  // ─────────────────────────────────────────

 app.post('/api/query', (req, res) => {

  const event = bus.emitEvent(
    'input.user',
    {
      input: req.body,
      source: 'http',
    },
    'SYSTEM'
  );

  res.json({
    accepted: true,
    eventId: event.id,
  });
});


  // ─────────────────────────────────────────
  // GLOBAL EVENT STREAM
  // ─────────────────────────────────────────

  app.get('/api/events/stream', (req, res) => {

    openSSE(res);

    const handler = (event: GlideEvent) => {
      writeSSE(res, event);
    };

    bus.onAny(handler);

    req.on('close', () => {
      bus.offAny(handler);
      res.end();
    });
  });


  // ─────────────────────────────────────────
  // SYSTEM SIGNALS
  // ─────────────────────────────────────────

app.post('/api/system/signal', (req, res) => {

  const event = bus.emitEvent(
    'system.signal',
    req.body,
    'SYSTEM'
  );

  res.json({
    accepted: true,
    eventId: event.id,
  });
});


  // ─────────────────────────────────────────
  // Start
  // ─────────────────────────────────────────

  const PORT = Number(process.env.PORT ?? 3001);

  app.listen(PORT, () => {
    console.log(`🌌 Glide v4 Sensor listening on http://localhost:${PORT}`);
  });
}