// apps/dashboard/services/api.ts

const API_BASE = 'http://localhost:3001/api';

export const api = {
  async ask(message: string): Promise<any> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Backend returns: { output: { type, text, observations[] }, metadata }
    const output = raw.output ?? {};
    const observations: any[] = output.observations ?? [];

    // Pick structured data to show alongside the text answer
    let data: any = null;
    if (observations.length === 1) {
      data = observations[0];           // single skill — unwrap directly
    } else if (observations.length > 1) {
      data = observations;              // multi-skill — pass the array
    }

    const result = {
      type: output.type ?? 'ai',
      text: output.text ?? raw.text ?? '',
      data,
      metadata: {
        ...raw.metadata,
        timeline: raw.metadata?.timeline,
      },
    };

    console.debug('[api.ask] result:', result);
    return result;
  },

  async overview(): Promise<any> {
    const res = await fetch(`${API_BASE}/overview`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async top(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/customers/top`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.customers ?? [];
  },

  async health(): Promise<any> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
