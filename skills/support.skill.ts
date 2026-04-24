// skills/support.skill.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Support Skill (FINAL)
//
// ✔ pure skill
// ✔ deterministic
// ✔ race-free
// ✔ no module IO
// ✔ hot-reload safe
// ✔ multi-skill compatible
// ─────────────────────────────────────────────────────────────

import { Skill, SkillContext, SkillResult } from '../kernel/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SUPPORT_FILE =
  path.join(ROOT, 'indexes', 'support', 'support.json');

// ─────────────────────────────────────────────────────────────
// Deterministic Lazy Loader
// ─────────────────────────────────────────────────────────────

let CACHE: any[] | null = null;

function loadTickets(): any[] {

  if (CACHE) return CACHE;

  try {
    const raw = fs.readFileSync(SUPPORT_FILE, 'utf-8');
    CACHE = JSON.parse(raw);
  } catch {
    CACHE = [];
  }

  return CACHE;
}

// ─────────────────────────────────────────────────────────────
// Skill Definition
// ─────────────────────────────────────────────────────────────

export const skill: Skill = {

  name: 'support',

  description:
    'Customer support ticket lookup, status inspection, and issue tracking.',

  keywords: [
    'support',
    'ticket',
    'help',
    'issue',
    'problem',
    'customer service',
    'case',
    'complaint',
  ],

  inputs: [
    'query',
    'customerName',
    'ticketId',
    'status',
    'limit',
  ],

  outputs: ['fragments'],

  // ───────────────────────────────────────────────────────────

  async handler(
    input: any,
    _context?: SkillContext
  ): Promise<SkillResult> {

    const tickets = loadTickets();

    const query =
      String(input.query ?? '').toLowerCase();

    const customerName =
      String(input.customerName ?? '').toLowerCase();

    const ticketId =
      String(input.ticketId ?? '').toLowerCase();

    const status =
      String(input.status ?? '').toLowerCase();

    const limit = Number(input.limit ?? 10);

    // =========================================================
    // 1 — Direct Ticket Lookup
    // =========================================================

    if (ticketId) {

      const match = tickets.find(
        (t: any) =>
          String(t.ticketId ?? '')
            .toLowerCase() === ticketId
      );

      if (!match) {
        return {
          success: true,
          fragments: [
            {
              type: 'signal',
              name: 'ticket_not_found',
              value: ticketId,
            },
          ],
        };
      }

      return {
        success: true,
        fragments: [
          {
            type: 'data',
            name: 'ticket',
            value: match,
          },
          {
            type: 'insight',
            name: 'ticket_status',
            value: match.status ?? 'unknown',
          },
        ],
      };
    }

    // =========================================================
    // 2 — Filtered Search
    // =========================================================

    const matches = tickets.filter((t: any) => {

      if (customerName &&
          !String(t.customerName ?? '')
            .toLowerCase()
            .includes(customerName))
        return false;

      if (status &&
          String(t.status ?? '')
            .toLowerCase() !== status)
        return false;

      if (query) {
        const q = query;

        const hit =
          String(t.customerName ?? '').toLowerCase().includes(q) ||
          String(t.subject ?? '').toLowerCase().includes(q) ||
          String(t.ticketId ?? '').toLowerCase().includes(q);

        if (!hit) return false;
      }

      return true;
    });

    if (matches.length === 0) {
      return {
        success: true,
        fragments: [
          {
            type: 'signal',
            name: 'no_tickets',
            value: query || customerName || status,
          },
        ],
      };
    }

    // =========================================================
    // 3 — Deterministic Ordering
    // =========================================================

    const ordered =
      [...matches].sort((a, b) =>
        String(b.ticketId ?? '')
          .localeCompare(String(a.ticketId ?? ''))
      );

    const result = ordered.slice(0, limit);

    return {
      success: true,
      fragments: [
        {
          type: 'data',
          name: 'support_tickets',
          value: result,
        },
        {
          type: 'insight',
          name: 'ticket_count',
          value: matches.length,
        },
      ],
    };
  },
};