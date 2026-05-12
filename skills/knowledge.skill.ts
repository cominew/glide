// skills/knowledge.skill.ts
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

const ROOT = path.resolve(process.cwd());

const DIRS = {
  constitution: path.join(ROOT, 'constitution'),
  business:     path.join(ROOT, 'knowledge', 'business'),
  decisions:    path.join(ROOT, 'knowledge', 'decisions'),
  failures:     path.join(ROOT, 'knowledge', 'failures'),
  brain_legacy: path.join(ROOT, 'memory', 'brain'),
  products:     path.join(ROOT, 'knowledge', 'business', 'products'),
  customers:    path.join(ROOT, 'knowledge', 'business', 'customers'),
  company:      path.join(ROOT, 'knowledge', 'business', 'company'),
};

// ── 路由规则 ──────────────────────────────────────────────
const ROUTES: { pattern: RegExp; dirs: string[]; label: string }[] = [
  {
    label: 'product',
    pattern: /astrion|remote|roscard|iremote|home.?assistant|integrat|install|firmware|setup|feature|spec|manual|device|hardware|wi.?fi|mqtt|pair/i,
    dirs: [DIRS.products, DIRS.business, DIRS.brain_legacy],
  },
  {
    label: 'company',
    pattern: /brand|company|business|about us|our product|who are we|glide|鼠脑/i,
    dirs: [DIRS.company, DIRS.business, DIRS.constitution],
  },
  {
    label: 'customer_profile',
    pattern: /forum|post|complaint|feedback|said|wrote|mention|review|whatsapp|telegram/i,
    dirs: [DIRS.customers, DIRS.business, DIRS.brain_legacy],
  },
  {
    label: 'decision',
    pattern: /why did|decision|chose|architecture|design|reason|rationale/i,
    dirs: [DIRS.decisions, DIRS.constitution],
  },
  {
    label: 'failure',
    pattern: /bug|error|issue|problem|fail|wrong|known issue|past mistake/i,
    dirs: [DIRS.failures],
  },
];

async function readDir(dir: string): Promise<{ file: string; content: string }[]> {
  if (!existsSync(dir)) return [];
  const out: { file: string; content: string }[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('_')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...await readDir(full));
        continue;
      }
      if (e.name.endsWith('.md') || e.name.endsWith('.txt')) {
        out.push({ file: full, content: await fs.readFile(full, 'utf-8') });
      }
    }
  } catch {}
  return out;
}

const STOPS = new Set([
  'is', 'the', 'a', 'an', 'for', 'how', 'to', 'and', 'or', 'what',
  'any', 'me', 'in', 'of', 'with', 'do', 'does', 'can', 'who',
  'are', 'has', 'its', 'it', 'this', 'that', 'about', 'get', 'use',
  'using', 'make', 'show', 'tell', 'give', 'please'
]);

function tokenise(q: string): string[] {
  return q.toLowerCase()
    .split(/[\s,?.!;:()\[\]'"\/\\]+/)
    .filter(w => w.length > 2 && !STOPS.has(w));
}

function score(content: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const lc = content.toLowerCase();
  let hits = tokens.filter(t => lc.includes(t)).length;
  if (lc.includes(tokens.join(' '))) hits += tokens.length;
  return hits / tokens.length;
}

export const skill: Skill = {
  name: 'knowledge_retrieval',
  description: 'Searches Glide knowledge base: product docs, company info, customer forum posts.',
  keywords: ['knowledge', 'search', 'docs', 'documentation', 'manual'],

  canExist(event: GlideEvent): boolean {
    if (event.type !== 'input.user') return false;
    const text = String(event.payload?.input?.message ?? '');
    return /astrion|remote|roscard|company|product|manual|documentation|knowledge|brand|decision/i.test(text);
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const query = (typeof input === 'string' ? input : input.query ?? input.input?.message ?? '').trim();
    if (!query) {
      return {
        state: 'partial',
        confidence: 0,
        phase: 'retrieval',
        fragments: [],
      };
    }

    const tokens = tokenise(query);
    const route = ROUTES.find(r => r.pattern.test(query)) || {
      dirs: [DIRS.business, DIRS.brain_legacy],
      label: 'general',
    };

    const docs: { file: string; content: string; sc: number }[] = [];
    for (const dir of route.dirs) {
      for (const doc of await readDir(dir)) {
        const sc = score(doc.content, tokens);
        if (sc > 0) docs.push({ ...doc, sc });
      }
    }
    docs.sort((a, b) => b.sc - a.sc);

    // 无结果
    if (!docs.length) {
      const available: string[] = [];
      for (const dir of Object.values(DIRS)) {
        if (!existsSync(dir)) continue;
        try {
          const files = await fs.readdir(dir);
          available.push(...files.filter(f => !f.startsWith('_')).map(f => path.basename(f, '.md')));
        } catch {}
      }
      return {
        state: 'emitted',
        confidence: 0.5,
        phase: 'retrieval',
        fragments: [
          {
            type: 'data',
            name: 'no_results',
            value: query,
            source: 'knowledge.skill',
            phase: 'retrieval',
            confidence: 0.5,
          },
          {
            type: 'data',
            name: 'available_topics',
            value: [...new Set(available)].slice(0, 15),
            source: 'knowledge.skill',
            phase: 'retrieval',
            confidence: 0.5,
          },
        ],
      };
    }

    // 构建答案
    const best = docs[0];
    const name = path.relative(ROOT, best.file);
    let answer = `# ${name}\n\n${best.content.slice(0, 2500)}`;

    const extras = docs.slice(1, 3).filter(d => d.sc >= 0.25);
    if (extras.length) {
      answer += '\n\n---\n**Also relevant:**\n';
      for (const d of extras) {
        answer += `\n# ${path.relative(ROOT, d.file)}\n${d.content.slice(0, 500)}\n`;
      }
    }

    return {
      state: 'emitted',
      confidence: Math.min(0.9, best.sc + 0.2),
      phase: 'retrieval',
      fragments: [
        {
          type: 'data',
          name: 'knowledge_answer',
          value: answer,
          role: 'primary',
          source: 'knowledge.skill',
          phase: 'retrieval',
          confidence: best.sc,
        },
      ],
    };
  },
};