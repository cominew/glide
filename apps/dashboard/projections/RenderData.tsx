// apps/dashboard/projections/RenderData.tsx
//
// Fix log:
//   [FIX-RENDER-1] MonthlyReport data layer was wrong:
//     The component read data.totalRevenue but data was the wrapper object
//     { type: 'monthly_report', data: { month, totalRevenue, ... } }.
//     Fixed: MonthlyReport now reads from the correct level (data.data ?? data).
//
//   [FIX-RENDER-2] identity.ambiguous now renders a candidate selector —
//     clickable buttons for each candidate that fire onCandidateSelect callback.
//     Parent (AssistantBubble) handles sending the selection as a new query.
//
//   [FIX-RENDER-3] profile.data now respects explicit currency field from kernel
//     (profile-fetcher now passes currency: 'USD' for US customers).
//
//   [FIX-RENDER-4] UnresolvedCard for profile.data with unresolved: true.

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  User, MapPin, Mail, Phone, ShoppingBag, TrendingUp,
  Package, Globe, Home, Clock, CreditCard, AlertTriangle, Users,
} from 'lucide-react';

// ── Currency ──────────────────────────────────────────────────────────────────

const COUNTRY_CURRENCY: Record<string, string> = {
  'UK': 'GBP', 'GB': 'GBP', 'UNITED KINGDOM': 'GBP',
  'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR',
  'BE': 'EUR', 'AT': 'EUR', 'PT': 'EUR', 'FI': 'EUR', 'IE': 'EUR',
  'GERMANY': 'EUR', 'FRANCE': 'EUR', 'ITALY': 'EUR', 'SPAIN': 'EUR',
  'JP': 'JPY', 'JAPAN': 'JPY',
  'CA': 'CAD', 'CANADA': 'CAD',
  'AU': 'AUD', 'AUSTRALIA': 'AUD',
  'CN': 'CNY', 'CHINA': 'CNY',
  'IL': 'ILS', 'ISRAEL': 'ILS',
  'AE': 'AED', 'UAE': 'AED', 'UNITED ARAB EMIRATES': 'AED',
  'BG': 'BGN', 'BULGARIA': 'BGN',
  'IN': 'INR', 'INDIA': 'INR',
  'IR': 'IRR', 'IRAN': 'IRR',
};

// ⭐ [FIX-RENDER-3] Respect explicit currency field from kernel
function detectCurrency(country?: string, explicitCurrency?: string): string {
  if (explicitCurrency && explicitCurrency !== 'USD') return explicitCurrency;
  if (!country) return 'USD';
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? 'USD';
}

function fmtCurrency(amount: number, country?: string, explicitCurrency?: string): string {
  const currency = detectCurrency(country, explicitCurrency);
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const sym: Record<string, string> = {
      GBP: '£', EUR: '€', USD: '$', JPY: '¥', CAD: 'CA$', AUD: 'A$',
      CNY: '¥', ILS: '₪', AED: 'AED ', BGN: 'лв', INR: '₹',
    };
    return `${sym[currency] ?? currency + ' '}${amount.toFixed(2)}`;
  }
}

// ── Unresolved card ───────────────────────────────────────────────────────────

const UnresolvedCard: React.FC<{ data: any }> = ({ data }) => (
  <div style={{
    marginTop: 8, padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--warning)', background: 'rgba(251,191,36,0.06)',
    display: 'flex', alignItems: 'flex-start', gap: 10,
  }}>
    <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>
        Identity could not be resolved
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {data.note ?? `No customer found matching "${data.name}".`}
      </div>
    </div>
  </div>
);

// ── Identity ambiguous — candidate selector ───────────────────────────────────
// ⭐ [FIX-RENDER-2] Clickable candidate list

export const AmbiguousSelector: React.FC<{
  data:              { query: string; candidates: Array<{ name: string; country?: string }> };
  onSelect:          (name: string) => void;
}> = ({ data, onSelect }) => (
  <div style={{ marginTop: 8 }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Users size={11} />
      Found {data.candidates.length} matches for "{data.query}" — select one:
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {data.candidates.map((c, i) => (
        <button
          key={i}
          onClick={() => onSelect(c.name)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-overlay)',
            color: 'var(--text-primary)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
        >
          <span>{c.name}</span>
          {c.country && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {c.country}
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
);

// ── Profile Card ──────────────────────────────────────────────────────────────

const ProfileCard: React.FC<{ data: any }> = ({ data }) => {
  if (data.unresolved) return <UnresolvedCard data={data} />;

  const cur = data.currency; // explicit currency from kernel

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <User size={11} /> Customer Profile
      </div>

      <div style={{ borderRadius: 10, padding: 14, backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            {data.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3 }}>{data.name}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              {data.country && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}><Globe size={8} />{data.country}</span>}
              {data.city    && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}><Home size={8} />{data.city}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {data.email   && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}><Mail size={10} style={{ color: '#60a5fa', flexShrink: 0 }} />{data.email}</div>}
          {data.phone   && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}><Phone size={10} style={{ color: '#34d399', flexShrink: 0 }} />{data.phone}</div>}
          {data.address && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}><MapPin size={10} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} /><span style={{ whiteSpace: 'pre-line' }}>{data.address}</span></div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Total Spent', value: fmtCurrency(data.totalRevenue ?? data.metrics?.totalSpent ?? 0, data.country, cur), color: '#34d399' },
          { label: 'Orders',      value: data.orderCount ?? data.metrics?.orderCount ?? 0,                                    color: '#60a5fa' },
          { label: 'Value Level', value: data.metrics?.valueLevel ?? '—',                                                     color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2, color }}>{value}</div>
          </div>
        ))}
      </div>

      {(data.recentOrders ?? data.orders)?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Clock size={10} /> Recent Orders
          </div>
          {(data.recentOrders ?? data.orders).slice(0, 5).map((o: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>{o.product ?? '—'}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginRight: 10 }}>{o.date ?? '—'}</span>
              <span style={{ fontWeight: 700, color: '#34d399', flexShrink: 0 }}>{fmtCurrency(o.amount ?? 0, data.country, cur)}</span>
            </div>
          ))}
        </div>
      )}

      {data.payments?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <CreditCard size={10} /> Payment Records
          </div>
          {data.payments.map((p: string, i: number) => (
            <div key={i} style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.split('\\').pop() ?? p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Customer List ─────────────────────────────────────────────────────────────

const CustomerList: React.FC<{ data: any[] }> = ({ data }) => (
  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
      <User size={11} /> {data.length} Customer{data.length !== 1 ? 's' : ''}
    </div>
    {data.map((c, i) => (
      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              {c.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
              {c.country && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.country}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>{fmtCurrency(c.revenue ?? 0, c.country)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.orders ?? 0} orders</div>
          </div>
        </div>
        {(c.email || c.phone) && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {c.email && <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={9} style={{ color: '#60a5fa' }} />{c.email}</span>}
            {c.phone && <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={9} style={{ color: '#34d399' }} />{c.phone}</span>}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ── Top Customers ─────────────────────────────────────────────────────────────

const TopCustomers: React.FC<{ data: any[] }> = ({ data }) => (
  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
      <TrendingUp size={11} /> Top Customers by Revenue
    </div>
    <div style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v.split(' ')[0]} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: any, _: any, p: any) => [fmtCurrency(v, p?.payload?.country), 'Revenue']} />
          <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    {data.map((c, i) => (
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-muted)' }}>{i+1}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</span>
          {c.country && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.country}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 800, color: '#34d399' }}>{fmtCurrency(c.revenue ?? 0, c.country)}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{c.orders} orders</span>
        </div>
      </div>
    ))}
  </div>
);

// ── Monthly Report ────────────────────────────────────────────────────────────
// ⭐ [FIX-RENDER-1] Read from correct data level

const MonthlyReport: React.FC<{ data: any }> = ({ data }) => {
  // data may be { type, data: innerData } or directly the inner object
  // Normalize: always work with the inner object
  const d = data?.data ?? data;

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShoppingBag size={11} /> Monthly Report · {d.month}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Revenue',   value: fmtCurrency(d.totalRevenue ?? 0), color: '#34d399' },
          { label: 'Orders',    value: d.totalOrders ?? 0,               color: '#60a5fa' },
          { label: 'Customers', value: d.uniqueCustomers ?? 0,           color: '#fbbf24' },
          { label: 'Products',  value: d.products?.length ?? 0,          color: '#a855f7' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color }}>{value}</div>
          </div>
        ))}
      </div>
      {d.products?.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Package size={10} /> Product Breakdown
          </div>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.products} layout="vertical" barCategoryGap="25%">
                <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={110}
                  tickFormatter={(v) => v.length > 16 ? v.slice(0, 16) + '…' : v} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any) => [fmtCurrency(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

// ── Country Ranking ───────────────────────────────────────────────────────────

const CountryRanking: React.FC<{ data: any[] }> = ({ data }) => (
  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Globe size={11} /> Revenue by Country
    </div>
    <div style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="country" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: any, _: any, p: any) => [fmtCurrency(v, p?.payload?.country), 'Revenue']} />
          <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    {data.map((c, i) => (
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 14 }}>{i+1}</span>
          <span style={{ color: 'var(--text-primary)' }}>{c.country}</span>
        </div>
        <div>
          <span style={{ fontWeight: 800, color: '#34d399' }}>{fmtCurrency(c.revenue, c.country)}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{c.orders} orders</span>
        </div>
      </div>
    ))}
  </div>
);

// ── Overview ──────────────────────────────────────────────────────────────────

const OverviewCard: React.FC<{ data: any }> = ({ data }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
    {[
      { label: 'Total Revenue', value: fmtCurrency(data.revenue ?? data.total ?? 0), color: '#34d399' },
      { label: 'Orders',        value: data.orders ?? '—',   color: '#60a5fa' },
      { label: 'Customers',     value: data.customers ?? '—', color: '#fbbf24' },
      { label: 'Countries',     value: data.countries ?? '—', color: '#a855f7' },
    ].map(({ label, value, color }) => (
      <div key={label} style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color }}>{value}</div>
      </div>
    ))}
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────

export const RenderData: React.FC<{
  data:       any;
  onSend?:    (msg: string) => void;  // for candidate selection
}> = ({ data, onSend }) => {
  if (!data) return null;

  if (Array.isArray(data) && !data.length) return (
    <div style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic', color: 'var(--text-muted)' }}>No results found.</div>
  );
  if (Array.isArray(data)) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.map((item, i) => <RenderData key={i} data={item} onSend={onSend} />)}
    </div>
  );

  switch (data.type) {
    case 'profile.data':
      return <ProfileCard data={data.data ?? data} />;

    case 'identity.ambiguous':
      return onSend
        ? <AmbiguousSelector
            data={data.data ?? data}
            onSelect={(name) => onSend(`Show me the full profile of customer ${name}`)}
          />
        : <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Candidates: {(data.data?.candidates ?? []).map((c: any) => c.name).join(', ')}
          </div>;

    case 'customer_list':
      return data.data?.length
        ? <CustomerList data={data.data} />
        : <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 4 }}>No customers found.</div>;

    case 'top_customers':
      return data.data?.length ? <TopCustomers data={data.data} /> : null;

    case 'monthly_report':
      return <MonthlyReport data={data} />;

    case 'sales_by_country':
      return data.data?.length ? <CountryRanking data={data.data} /> : null;

    case 'overview':
    case 'total_revenue':
      return <OverviewCard data={data.data ?? data} />;

    case 'knowledge_answer':
      return (
        <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          {data.answer}
        </div>
      );

    default:
      return (
        <pre style={{ fontSize: 10, padding: 10, borderRadius: 8, overflow: 'auto', maxHeight: 160, marginTop: 6, backgroundColor: 'var(--bg-overlay)', color: '#10b981', border: '1px solid var(--border)' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
};