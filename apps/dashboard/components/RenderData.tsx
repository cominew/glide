// apps/dashboard/components/RenderData.tsx
//
// Renders structured data from skill outputs into rich visual components.
// Handles: customer_list, top_customers, monthly_report, sales_by_country,
//          sales_data, knowledge_answer, overview, and raw fallback.

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { User, MapPin, Mail, Phone, ShoppingBag, TrendingUp, Package, Globe } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const Badge: React.FC<{ text: string; color?: string }> = ({ text, color = 'bg-blue-500/10 text-blue-400' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${color}`}>
    {text}
  </span>
);

// ── Customer List ─────────────────────────────────────────────────────────────

const CustomerList: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-2 mt-2">
    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
      <User size={11} /> {data.length} Customer{data.length !== 1 ? 's' : ''} Found
    </div>
    {data.map((c, i) => (
      <div
        key={i}
        className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 hover:border-blue-500/30 transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/20 flex items-center justify-center font-black text-blue-300 text-sm shrink-0">
              {c.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="font-bold text-slate-200 text-sm leading-tight">{c.name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={9} className="text-slate-500" />
                <span className="text-[10px] text-slate-500">{c.country || '—'}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-black text-emerald-400">{fmt$(c.revenue ?? 0)}</div>
            <div className="text-[10px] text-slate-500">{c.orders ?? 0} orders</div>
          </div>
        </div>
        {(c.email || c.phone) && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-3">
            {c.email && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Mail size={9} className="text-blue-400" /> {c.email}
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Phone size={9} className="text-emerald-400" /> {c.phone}
              </div>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ── Top Customers (ranked list with bar chart) ────────────────────────────────

const TopCustomers: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-3 mt-2">
    <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
      <TrendingUp size={11} /> Top Customers by Revenue
    </div>
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => v.split(' ')[0]} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
            formatter={(v: any) => [fmt$(v), 'Revenue']}
          />
          <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="space-y-1.5">
      {data.map((c, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-slate-800 text-[10px] font-black text-slate-400 flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-sm text-slate-300 font-medium">{c.name}</span>
            {c.country && <Badge text={c.country} color="bg-slate-700/50 text-slate-400" />}
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-emerald-400">{fmt$(c.revenue ?? 0)}</div>
            <div className="text-[10px] text-slate-500">{c.orders} orders</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Monthly Report ────────────────────────────────────────────────────────────

const MonthlyReport: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-3 mt-2">
    <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
      <ShoppingBag size={11} /> Monthly Report · {data.month}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: 'Revenue',   value: fmt$(data.totalRevenue ?? 0), color: 'text-emerald-400' },
        { label: 'Orders',    value: data.totalOrders ?? 0,        color: 'text-blue-400' },
        { label: 'Customers', value: data.uniqueCustomers ?? 0,    color: 'text-amber-400' },
        { label: 'Products',  value: data.products?.length ?? 0,   color: 'text-purple-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{label}</div>
          <div className={`text-lg font-black mt-0.5 ${color}`}>{value}</div>
        </div>
      ))}
    </div>
    {data.products?.length > 0 && (
      <>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Package size={10} /> Product Breakdown
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.products} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} tickLine={false}
                axisLine={false} width={100} tickFormatter={(v) => v.length > 14 ? v.slice(0,14)+'…' : v} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [fmt$(v), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#a855f7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    )}
  </div>
);

// ── Country Ranking ───────────────────────────────────────────────────────────

const CountryRanking: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-3 mt-2">
    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
      <Globe size={11} /> Revenue by Country
    </div>
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="country" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
            formatter={(v: any) => [fmt$(v), 'Revenue']}
          />
          <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="space-y-1">
      {data.map((c, i) => (
        <div key={i} className="flex justify-between items-center py-1 border-b border-slate-800/50 last:border-0 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-4">{i + 1}</span>
            <span className="text-slate-300 font-medium">{c.country}</span>
          </div>
          <div className="text-right">
            <span className="font-black text-emerald-400">{fmt$(c.revenue)}</span>
            <span className="text-slate-500 text-[10px] ml-2">{c.orders} orders</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Overview / Sales Summary ──────────────────────────────────────────────────

const OverviewCard: React.FC<{ data: any }> = ({ data }) => (
  <div className="grid grid-cols-2 gap-2 mt-2">
    {[
      { label: 'Total Revenue', value: fmt$(data.revenue ?? data.total ?? 0), color: 'text-emerald-400' },
      { label: 'Orders',        value: data.orders ?? '—',                     color: 'text-blue-400' },
      { label: 'Customers',     value: data.customers ?? '—',                  color: 'text-amber-400' },
      { label: 'Countries',     value: data.countries ?? '—',                  color: 'text-purple-400' },
    ].map(({ label, value, color }) => (
      <div key={label} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
        <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{label}</div>
        <div className={`text-base font-black mt-0.5 ${color}`}>{value}</div>
      </div>
    ))}
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────

export const RenderData: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  if (Array.isArray(data) && !data.length)
    return <div className="text-slate-500 italic text-xs mt-1">No results found.</div>;

  // Array of observations (multi-skill result)
  if (Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((item, i) => <RenderData key={i} data={item} />)}
      </div>
    );
  }

  switch (data.type) {
    case 'customer_list':
      return data.data?.length
        ? <CustomerList data={data.data} />
        : <div className="text-slate-500 italic text-xs mt-1">No customers found.</div>;

    case 'top_customers':
      return data.data?.length
        ? <TopCustomers data={data.data} />
        : <div className="text-slate-500 italic text-xs mt-1">No data available.</div>;

    case 'monthly_report':
      return <MonthlyReport data={data} />;

    case 'sales_by_country':
      return data.data?.length
        ? <CountryRanking data={data.data} />
        : <div className="text-slate-500 italic text-xs mt-1">No country data.</div>;

    case 'overview':
    case 'total_revenue':
      return <OverviewCard data={data} />;

    case 'knowledge_answer':
      return (
        <div className="mt-2 p-3 bg-slate-900/50 border border-slate-700/40 rounded-xl text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {data.answer}
        </div>
      );
  }

  // Legacy array format (customer/country tables)
  if (Array.isArray(data) && data[0]?.name !== undefined) {
    return data[0]?.country !== undefined && data[0]?.orders !== undefined
      ? <TopCustomers data={data} />
      : <CustomerList data={data} />;
  }

  // Raw fallback
  return (
    <pre className="text-[10px] bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-auto max-h-40 mt-2 border border-slate-800">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};
