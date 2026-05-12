// skills/name-disambiguation.skill.ts
import fs from 'fs';
import path from 'path';
import type { Skill, SkillContext, SkillResult, SkillFragment } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';

function loadCustomers(): any[] {
  for (const p of [
    path.join(process.cwd(), 'indexes/customers/customers.json'),
    path.join(process.cwd(), 'memory/indexes/customers/customers.json'),
  ]) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}
  }
  return [];
}

const ANALYTICS_PATTERNS = [
  /\b(?:sales\s+performance|revenue\s+trend|monthly\s+report|top\s+customers?|country\s+breakdown|strategic\s+insight|analyze\s+(?:sales|revenue|performance)|overview|total\s+revenue)\b/i,
];

const ANALYTIC_KEYWORDS = new Set(['top', 'sales', 'revenue', 'report', 'overview', 'ranking', 'country', 'countries']);

function isPureAnalytics(text: string): boolean {
  if (!text) return false;
  if (/\btop\s+\d+\s+\w+\s+by\s+\w+/i.test(text)) return true;
  if (/\btop\s+\w+\s+by\s+\w+/i.test(text)) return true;
  const containsName = /(?:called|named|client|customer|show me|for)\s+[A-Z][a-z]/i.test(text);
  if (containsName) return false;
  return ANALYTICS_PATTERNS.some(p => p.test(text));
}

const STOP_WORDS = new Set([
  'me','the','a','an','his','her','their','our','its',
  'show','find','get','give','tell','look','search',
  'full','recent','latest','current','some','this','that',
  'detail','details','profile','contact','info','information',
  'order','orders','history','account',
  'client','customer','user','person',
  'called','named','about','for','of','from','in',
  'including','with','having','contains','analyze','analysis',
]);

const STOPWORD_PATTERNS = [
  /^(the|a|an)\s+\w+$/i,
  /^(full|all|complete|detailed?|recent|latest|current|previous|new|old)$/i,
  /^(his|her|its|their|our|your|my|he|she|it|they|we|you|me|him|them|us)$/i,
  /^(show|tell|give|list|find|get|fetch|display|view|see)\b/i,
  /^\d{1,3}$/,
  /^(profile|detail|info|information|data|record|account|customer|client|contact)$/i,
];

function sanitizeInputForNameExtraction(text: string): string {
  const parts = text.split(/\s+(?:including|with|having|contains)\s+/i);
  return parts[0].trim();
}

function extractNames(text: string): string[] {
  if (!text) return [];
  const result = new Set<string>();
  const cleanedText = sanitizeInputForNameExtraction(text);
  const patterns = [
    /["']([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)["']/g,
    /show\s+me\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /(?:called|named)\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)?)/gi,
    /(?:customer|client)\s+(?:called|named)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /\b(?:for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleanedText)) !== null) {
      const c = m[1]?.trim();
      if (c && c.length > 1 && !STOP_WORDS.has(c.toLowerCase()) && !ANALYTIC_KEYWORDS.has(c.toLowerCase())) {
        result.add(c);
      }
    }
  }
  return [...result];
}

function findCustomers(name: string): any[] {
  const all = loadCustomers();
  const key = name.toLowerCase();
  return all.filter(c => {
    const n = (c.name ?? '').toLowerCase();
    return n === key || n.startsWith(key);
  });
}

function makeFragment(params: {
  name: string;
  value: any;
  role: SkillFragment['role'];
  confidence: number;
}): SkillFragment {
  return {
    type: 'data',
    name: params.name,
    value: params.value,
    role: params.role,
    confidence: params.confidence,
    source: 'name-disambiguation.skill',
    phase: 'identity',
  };
}

export function isStopwordPhrase(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length < 2) return true;
  return STOPWORD_PATTERNS.some(pattern => pattern.test(trimmed));
}

export const skill: Skill = {
  name: 'name-disambiguation',
  description: 'Resolve customer identity from user input',
  keywords: ['customer', 'name', 'client'],

  canExist(event: GlideEvent, text?: string): boolean {
    const inputText = text ?? String(event.payload?.input?.message ?? '');
    if (event.type !== 'input.user') return false;
    if (isPureAnalytics(inputText)) return false;
    // use extractNames (not the undefined extractedNames)
    return extractNames(inputText).length > 0;
  },

  async handler(input: any): Promise<SkillResult> {
    const text = typeof input === 'string'
      ? input
      : input?.input?.message ?? '';

    const names = extractNames(text);
    // filter stopwords
    const candidates = names.filter(name => !isStopwordPhrase(name));

    if (candidates.length === 0) {
      return {
        state: 'partial',
        phase: 'identity',
        fragments: [],
        confidence: 0,
      };
    }

    const fragments: SkillFragment[] = [];

    for (const name of candidates) {
      const matches = findCustomers(name);

      if (matches.length === 1) {
        fragments.push(
          makeFragment({
            name: 'identity.resolved',
            value: {
              name: matches[0].name,
              customer: matches[0],
              query: name,
            },
            role: 'primary',
            confidence: 0.95,
          })
        );
      } else if (matches.length > 1) {
        fragments.push(
          makeFragment({
            name: 'identity.ambiguous',
            value: {
              query: name,
              candidates: matches.map(c => ({
                name: c.name,
                country: c.country,
              })),
            },
            role: 'supplementary',
            confidence: 0.7,
          })
        );
      } else {
        fragments.push(
          makeFragment({
            name: 'identity.unresolved',
            value: {
              query: name,
              message: `No match for "${name}"`,
            },
            role: 'supplementary',
            confidence: 0.6,
          })
        );
      }
    }

    return {
      state: 'emitted',
      phase: 'identity',
      confidence: 0.95,
      fragments,
    };
  },
};