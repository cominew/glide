import { OllamaClient } from './kernel/llm/ollama-client';
const llm = new OllamaClient();
llm.generate('Hello').then(r => console.log('LLM OK:', r.slice(0, 100))).catch(e => console.error('LLM Error:', e));