import http from 'http';
export class OllamaClient {
    model;
    constructor(model = 'qwen2.5:3b') {
        this.model = model;
    }
    async generate(prompt) {
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
                    }
                    catch {
                        reject(new Error('Invalid response from Ollama'));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
}
