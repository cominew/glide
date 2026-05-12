// apps/dashboard/perspectives/CustomersTab.tsx
//
// New feature: Time range filter
//   Customers are filtered by their most recent order date.
//   Options: 1 month / 3 months / 6 months / 1 year / All time
//   lastOrderDate is inferred from customer.recentOrders[0].date or customer.lastOrderDate.
//   Customers with no order date always appear (can't be excluded by time range).
//
// Fix log:
//   [BUG-A] Revenue column hardcoded '$' — currency now inferred from country.
//   [BUG-B] Chip queries were Chinese — rewritten in English.
//   [BUG-C] Chip buttons had no disabled state — fixed.

import React, { useState, useMemo } from 'react';
import { Users, Award, ShoppingCart, Calendar } from 'lucide-react';
import { StatCard } from '../projections/StatCard';
import { Customer } from '../events/chat';

interface Props {
  customers: Customer[];
  onAnalyze: (m: string) => void;
  t: any;
  isOnline: boolean;
}

// ── Currency ──────────────────────────────────────────────────────────────────
function detectCurrency(country?: string): string {
  if (!country) return 'USD';
  const c = country.toUpperCase();
  if (['UK', 'GB', 'UNITED KINGDOM'].includes(c)) return 'GBP';
  if (['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE'].includes(c)) return 'EUR';
  if (['JP', 'JAPAN'].includes(c)) return 'JPY';
  if (['CA', 'CANADA'].includes(c)) return 'CAD';
  if (['AU', 'AUSTRALIA'].includes(c)) return 'AUD';
  return 'USD';
}

function fmtCurrency(amount: number, country?: string): string {
  const currency = detectCurrency(country);
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    const sym: Record<string, string> = { GBP: '£', EUR: '€', USD: '$', JPY: '¥', CAD: 'CA$', AUD: 'A$' };
    return `${sym[currency] ?? currency}${amount.toFixed(2)}`;
  }
}

// ── Time range ────────────────────────────────────────────────────────────────
type Range = '1m' | '3m' | '6m' | '1y' | 'all';

const RANGE_OPTIONS: { value: Range; label: string; months: number | null }[] = [
  { value: '1m',  label: '1 month',  months: 1  },
  { value: '3m',  label: '3 months', months: 3  },
  { value: '6m',  label: '6 months', months: 6  },
  { value: '1y',  label: '1 year',   months: 12 },
  { value: 'all', label: 'All time', months: null },
];

// Try to get the most recent order date from various data shapes
function getLastOrderDate(c: any): Date | null {
  // Explicit field
  if (c.lastOrderDate) return new Date(c.lastOrderDate);

  // From recentOrders array (profile.data shape)
  const orders: any[] = c.recentOrders ?? c.orders ?? [];
  if (orders.length > 0) {
    const dates = orders
      .map((o: any) => o.date ? new Date(o.date) : null)
      .filter(Boolean) as Date[];
    if (dates.length) return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  return null;
}

function filterByRange(customers: any[], range: Range): any[] {
  if (range === 'all') return customers;
  const option = RANGE_OPTIONS.find(o => o.value === range)!;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - option.months!);

  return customers.filter(c => {
    const d = getLastOrderDate(c);
    if (!d) return true;  // no date info → always include
    return d >= cutoff;
  });
}

// ── Chip ──────────────────────────────────────────────────────────────────────
const Chip: React.FC<{ label: string; onClick: () => void; isOnline: boolean }> = ({ label, onClick, isOnline }) => (
  <button
    onClick={onClick}
    disabled={!isOnline}
    style={{
      padding: '7px 14px', borderRadius: 8,
      border: '0.5px solid var(--border)',
      background: 'var(--bg-elevated)',
      color: isOnline ? 'var(--text-secondary)' : 'var(--text-muted)',
      fontSize: 12, fontWeight: 600,
      cursor: isOnline ? 'pointer' : 'not-allowed',
      opacity: isOnline ? 1 : 0.45,
    }}
    onMouseEnter={e => { if (isOnline) (e.currentTarget as HTMLElement).style.background = 'var(--bg-overlay)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
  >
    {label}
  </button>
);

// ── Range selector ────────────────────────────────────────────────────────────
const RangeSelector: React.FC<{ value: Range; onChange: (r: Range) => void; count: number; total: number }> = ({ value, onChange, count, total }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
    <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>Active in:</span>
    {RANGE_OPTIONS.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          border: value === opt.value ? '1px solid var(--accent)' : '0.5px solid var(--border)',
          background: value === opt.value ? 'var(--accent-dim)' : 'var(--bg-elevated)',
          color: value === opt.value ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {opt.label}
      </button>
    ))}
    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
      {count < total ? `${count} of ${total}` : `${total} total`}
    </span>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export const CustomersTab: React.FC<Props> = ({ customers, onAnalyze, t, isOnline }) => {
  const [range, setRange] = useState<Range>('3m');

  const filtered = useMemo(() => filterByRange(customers, range), [customers, range]);

  const highValue   = filtered.filter(c => c.revenue > 1000).length;
  const activeCount = filtered.filter(c => c.orders > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <StatCard label={t.totalCustomers ?? 'Customers'} value={filtered.length} icon={<Users size={18} />}        color="blue" />
        <StatCard label={t.highValue      ?? 'High Value'} value={highValue}       icon={<Award size={18} />}        color="emerald" />
        <StatCard label={t.activeClients  ?? 'With Orders'} value={activeCount}    icon={<ShoppingCart size={18} />} color="amber" />
      </div>

      {/* Time range filter */}
      <RangeSelector value={range} onChange={setRange} count={filtered.length} total={customers.length} />

      {/* Quick queries */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip isOnline={isOnline} label={t.newThisWeek  ?? 'New this week'}
          onClick={() => onAnalyze('List customers who placed their first order this week')} />
        <Chip isOnline={isOnline} label={t.newThisMonth ?? 'New this month'}
          onClick={() => onAnalyze('List customers who placed their first order this month')} />
        <Chip isOnline={isOnline} label={t.top5Revenue  ?? 'Top 5 by revenue'}
          onClick={() => onAnalyze('Top 5 customers by revenue')} />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.customerIntel ?? 'Customer Intelligence'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            {filtered.length} shown
          </span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No customers with orders in the selected period.
            <br />
            <button
              onClick={() => setRange('all')}
              style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Show all time
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Customer', 'Last Order', 'Orders', 'Revenue', 'Country', 'Action'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', fontSize: 10, fontWeight: 700,
                      letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
                      textAlign: h === 'Revenue' ? 'right' : h === 'Orders' ? 'center' : 'left',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const lastDate = getLastOrderDate(c);
                  return (
                    <tr key={c.id}
                      style={{ borderTop: '0.5px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--row-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      {/* Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--accent-dim)', color: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 13, textTransform: 'uppercase',
                          }}>
                            {c.name[0]}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                            {c.email && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                {c.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Last order date */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {lastDate ? lastDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* Orders */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {c.orders}
                      </td>

                      {/* Revenue — currency-aware */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {fmtCurrency(c.revenue, c.country)}
                      </td>

                      {/* Country */}
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {c.country || '—'}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          disabled={!isOnline}
                          onClick={() => onAnalyze(`Show me the full profile of customer ${c.name}`)}
                          style={{
                            padding: '5px 12px', borderRadius: 7, border: 'none',
                            background: 'var(--accent)', color: '#fff',
                            fontSize: 12, fontWeight: 600,
                            cursor: isOnline ? 'pointer' : 'not-allowed',
                            opacity: isOnline ? 1 : 0.5,
                          }}
                        >
                          {t.analyze ?? 'Analyze'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
