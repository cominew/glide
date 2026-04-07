// globals.d.ts
declare module 'ollama' {
  export class OllamaClient {
    constructor();
    generateStream(query: string, callback: (token: string) => void): Promise<void>;
  }
}