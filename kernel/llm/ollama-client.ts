// D:\.openclaw\framework\llm\ollama-client.ts
import http from 'http';
import { Tool } from '../core/types.js';

export class OllamaClient {
  constructor(private model: string = 'qwen2.5:3b') {}

  /**
   * Generates a response from the LLM.
   * Supports streaming for a more responsive UI feel.
   */
  async generate(prompt: string, onToken?: (token: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ model: this.model, prompt, stream: !!onToken });
      
      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let fullResponse = '';
        res.on('data', (chunk) => {
          try {
            const json = JSON.parse(chunk.toString());
            if (json.response) {
              if (onToken) onToken(json.response);
              fullResponse += json.response;
            }
          } catch (e) {
            // Handle partial chunks if necessary
          }
        });
        res.on('end', () => resolve(fullResponse));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Optimized Tool Calling: Explicitly defines schema for the model to follow.
   */
  async decideTool(userInput: string, tools: Tool[]): Promise<any> {
    const prompt = `
      You are a tool-routing engine. 
      Available tools: ${JSON.stringify(tools.map(t => ({ name: t.name, desc: t.description })))}
      Query: "${userInput}"
      Return ONLY a JSON object: { "tool": "name", "params": {} }
    `;
    const result = await this.generate(prompt);
    try {
      return JSON.parse(result.replace(/```json|```/g, ''));
    } catch {
      return { tool: 'none' };
    }
  }
}