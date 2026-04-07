// kernel/llm/ollama-client.ts
import http from 'http';

export class OllamaClient {
  constructor(private model: string = 'qwen2.5:3b') {}

  // 普通生成（非流式）
  async generate(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ model: this.model, prompt, stream: false });
      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.response);
          } catch {
            reject(new Error('Invalid response from Ollama'));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // 流式生成（逐 token 回调）
  async generateStream(prompt: string, onToken: (token: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ model: this.model, prompt, stream: true });
      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let fullResponse = '';
        let buffer = '';
        res.on('data', chunk => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.response) {
                onToken(json.response);
                fullResponse += json.response;
              }
            } catch (e) {}
          }
        });
        res.on('end', () => {
          resolve(fullResponse);
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}