// skills/name-disambiguation.skill.ts
import fs from 'fs';
import path from 'path';

function loadCustomers(): any[] {
  for (const p of [
    path.join(process.cwd(), 'indexes/customers/customers.json'),
    path.join(process.cwd(), 'memory/indexes/customers/customers.json'),
  ]) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (err) {
      console.error('[name-disambiguation] failed to load', p, err);
    }
  }
  return [];
}

const STOP_WORDS = new Set([
  'me','the','a','an','his','her','their','our','its','him',
  'show','find','get','give','tell','look','search',
  'full','recent','latest','current','some','this','that',
  'detail','details','profile','contact','info','information',
  'order','orders','history','account','list','all','any',
  'client','customer','user','person','he','she','they',
  'we','do','have','has','is','are','was','were','and',
  'called','named','about','for','of','from','in',
  'ny','la','dc','sf','nyc','uk','usa','uae',
]);

function isLocationQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(?:customers?|clients?)\s+(?:from|in)\s+[A-Za-z\s]+\b/i.test(lower)
      || /\b(?:from|in)\s+[A-Za-z\s]+\s+(?:customers?|clients?)\b/i.test(lower)
      || /\blist\s+(?:all\s+)?(?:customers?|clients?)\s+(?:from|in)\s+[A-Za-z\s]+\b/i.test(lower);
}

function isPureAnalyticsQuery(text: string): boolean {
  return /\b(?:sales performance|revenue trend|top customers|monthly report|country breakdown|overview|analyze sales|strategic insight)\b/i.test(text)
    && !/(?:called|named|client|customer)\s+[A-Za-z]/i.test(text);
}

function extractCandidateNames(text: string): string[] {
  const candidates: string[] = [];

  // Pattern 1: quoted names "Adam" or 'Adam'
  const quotedPattern = /["']([A-Za-z][A-Za-z\-\.\s]+?)["']/g;
  let m: RegExpExecArray | null;
  while ((m = quotedPattern.exec(text)) !== null) {
    const name = m[1].trim();
    if (!STOP_WORDS.has(name.toLowerCase()) && name.length > 1) candidates.push(name);
  }

  // Pattern 2: "called X" / "named X" / "show me X"
  const explicitPatterns = [
    /(?:called|named)\s+([A-Za-z][A-Za-z\-\.\s]+)/gi,
    /(?:show|find|get|lookup)\s+(?:me\s+)?(?:customers?|clients?)?\s*([A-Za-z][A-Za-z\-\.\s]+)/gi,
  ];

  for (const rx of explicitPatterns) {
    let me: RegExpExecArray | null;
    while ((me = rx.exec(text)) !== null) {
      const candidate = me[1].trim();
      if (!STOP_WORDS.has(candidate.toLowerCase()) && candidate.length > 1) candidates.push(candidate);
    }
  }

  return [...new Set(candidates)];
}

function findCustomers(nameQuery: string): any[] {
  const all = loadCustomers();
  const key = nameQuery.toLowerCase();
  return all.filter(c => {
    const name = (c.name ?? '').toLowerCase();
    return name === key
      || name.startsWith(key)
      || name.endsWith(key)
      || name.split(/\s+/).some((part: string) => part === key || part.startsWith(key));
  });
}

export const skill = {
  name: 'name-disambiguation',
  id: 'name-disambiguation.skill',
  domain: 'identity-resolution',
  description: 'Extracts person names from queries and resolves them to customer records',

  onLoad(bus: any) {
    bus.on('input.user', async (event: any) => {
      const text = String(event.payload?.input?.message ?? '');
      const taskId = event.trace?.taskId ?? event.id;
      if (isLocationQuery(text) || isPureAnalyticsQuery(text)) return;

      const candidates = extractCandidateNames(text);
      if (!candidates.length) return;

      const fragments: any[] = [];
      for (const nameCandidate of candidates) {
        const matches = findCustomers(nameCandidate);
        if (matches.length === 1) {
          fragments.push({ type: 'data', name: 'identity.resolved', value: { name: matches[0].name, customer: matches[0], query: nameCandidate }, complete: true });
        } else if (matches.length > 1) {
          fragments.push({ type: 'data', name: 'identity.ambiguous', value: { candidates: matches.map(c => ({ name: c.name, country: c.country })), query: nameCandidate } });
        } else {
          fragments.push({ type: 'signal', name: 'identity.not_found', value: nameCandidate });
        }
      }

      if (!fragments.length) return;
      bus.emitEvent('skill.output', {
        type: 'skill.output',
        skill: 'name-disambiguation.skill',
        fragments,
        complete: fragments.some(f => f.name === 'identity.resolved'),
        taskId,
      }, 'RUNTIME', taskId);
    });

    function trimTrailingStopWords(raw: string): string {
  const parts = raw.split(/\s+/);
  // 从后往前移除停用词
  while (parts.length > 1 && STOP_WORDS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  return parts.join(' ');
}

function extractCandidateNames(text: string): string[] {
  const candidates: string[] = [];

  // Pattern 1: quoted names
  const quotedPattern = /["']([A-Za-z][A-Za-z\-\.\s]+?)["']/g;
  let m: RegExpExecArray | null;
  while ((m = quotedPattern.exec(text)) !== null) {
    const name = trimTrailingStopWords(m[1].trim());
    if (!STOP_WORDS.has(name.toLowerCase()) && name.length > 1) candidates.push(name);
  }

  // Pattern 2: "called X" / "named X" / "show me X"
  const explicitPatterns = [
    /(?:called|named)\s+([A-Za-z][A-Za-z\-\.\s]+)/gi,
    /(?:show|find|get|lookup)\s+(?:me\s+)?(?:customers?|clients?)?\s*([A-Za-z][A-Za-z\-\.\s]+)/gi,
  ];

  for (const rx of explicitPatterns) {
    let me: RegExpExecArray | null;
    while ((me = rx.exec(text)) !== null) {
      let candidate = trimTrailingStopWords(me[1].trim());
      if (!STOP_WORDS.has(candidate.toLowerCase()) && candidate.length > 1) {
        candidates.push(candidate);
      }
    }
  }

  return [...new Set(candidates)];
}

// 改进 findCustomers：支持组合回退搜索
function findCustomers(nameQuery: string): any[] {
  const all = loadCustomers();
  const key = nameQuery.toLowerCase();

  // 直接匹配
  let matches = all.filter(c => {
    const name = (c.name ?? '').toLowerCase();
    return name === key || name.startsWith(key) || name.includes(key);
  });

  // 如果直接匹配失败，尝试将查询拆分为空格分隔的多个词，进行组合搜索
  if (!matches.length && key.includes(' ')) {
    const parts = key.split(/\s+/).filter(p => p.length > 1);
    for (let i = parts.length; i >= 1; i--) {
      const partialKey = parts.slice(0, i).join(' ');
      matches = all.filter(c => {
        const name = (c.name ?? '').toLowerCase();
        return name.startsWith(partialKey) || name.includes(partialKey);
      });
      if (matches.length) break;
    }
  }

  return matches.slice(0, 10);
}
  },

  match(event: any): boolean {
    const text = String(event.payload?.input?.message ?? '');
    if (isLocationQuery(text) || isPureAnalyticsQuery(text)) return false;
    return extractCandidateNames(text).length > 0;
  },
};

export default skill;