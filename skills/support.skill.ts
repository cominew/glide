import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const SUPPORT_FILE = path.join(ROOT, 'indexes', 'support', 'support.json');

let CACHE: any[] | null = null;
function loadTickets(): any[] {
  if (CACHE) return CACHE;
  try {
    CACHE = JSON.parse(fs.readFileSync(SUPPORT_FILE, 'utf-8'));
  } catch {
    CACHE = [];
  }
  return CACHE;
}

export const skill: Skill = {
  name: 'support',
  description: 'Customer support ticket lookup and status inspection.',
  keywords: ['support', 'ticket', 'help', 'issue', 'problem', 'customer service'],

  canExist(event: GlideEvent): boolean {
    if (event.type !== 'input.user') return false;
    const text = String(event.payload?.input?.message ?? '');
    return /\b(?:ticket|support|issue|case|help|problem|complaint)\b/i.test(text);
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const tickets = loadTickets();
    const query = String(input.query ?? input.input?.message ?? '').toLowerCase();
    const customerName = String(input.customerName ?? '').toLowerCase();
    const ticketId = String(input.ticketId ?? '').toLowerCase();
    const status = String(input.status ?? '').toLowerCase();
    const limit = Number(input.limit ?? 10);

    // 按 ticketId 精确查找
    if (ticketId) {
      const match = tickets.find((t: any) =>
        String(t.ticketId ?? '').toLowerCase() === ticketId
      );
      if (!match) {
        return {
          state: 'emitted',
          confidence: 1.0,
          phase: 'retrieval',
          fragments: [{
            type: 'data',
            name: 'ticket_not_found',
            value: ticketId,
            source: 'support.skill',
            phase: 'retrieval',
            confidence: 1.0,
          }],
        };
      }
      return {
        state: 'emitted',
        confidence: 1.0,
        phase: 'retrieval',
        fragments: [
          {
            type: 'data',
            name: 'ticket',
            value: match,
            source: 'support.skill',
            phase: 'retrieval',
            confidence: 1.0,
          },
          {
            type: 'data',
            name: 'ticket_status',
            value: match.status ?? 'unknown',
            source: 'support.skill',
            phase: 'retrieval',
            confidence: 1.0,
          },
        ],
      };
    }

    // 过滤搜索
    const matches = tickets.filter((t: any) => {
      if (customerName && !String(t.customerName ?? '').toLowerCase().includes(customerName)) return false;
      if (status && String(t.status ?? '').toLowerCase() !== status) return false;
      if (query) {
        const q = query;
        const hit = String(t.customerName ?? '').toLowerCase().includes(q) ||
                    String(t.subject ?? '').toLowerCase().includes(q) ||
                    String(t.ticketId ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    if (matches.length === 0) {
      return {
        state: 'emitted',
        confidence: 1.0,
        phase: 'retrieval',
        fragments: [{
          type: 'data',
          name: 'no_tickets',
          value: query || customerName || status,
          source: 'support.skill',
          phase: 'retrieval',
          confidence: 1.0,
        }],
      };
    }

    const ordered = [...matches].sort((a, b) =>
      String(b.ticketId ?? '').localeCompare(String(a.ticketId ?? ''))
    );
    const result = ordered.slice(0, limit);

    return {
      state: 'emitted',
      confidence: 1.0,
      phase: 'retrieval',
      fragments: [
        {
          type: 'data',
          name: 'support_tickets',
          value: result,
          source: 'support.skill',
          phase: 'retrieval',
          confidence: 1.0,
          role: 'primary',
        },
        {
          type: 'data',
          name: 'ticket_count',
          value: matches.length,
          source: 'support.skill',
          phase: 'retrieval',
          confidence: 1.0,
        },
      ],
    };
  },
};