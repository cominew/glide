import { WebSocketServer, WebSocket } from 'ws';
import { Agent } from '../../runtime/agent';

export function initWebSocket(server: any, agent: Agent) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] Client connected');

    // 订阅技能执行结果
    agent.on('skill:after', (skillName: string, result: any) => {
      ws.send(JSON.stringify({ type: 'skill-result', skill: skillName, result }));
    });

    ws.on('message', async (data: string) => {
      const { type, payload } = JSON.parse(data.toString());
      if (type === 'subscribe') {
        ws.send(JSON.stringify({ type: 'subscribed', channels: payload }));
      }
    });
  });
}