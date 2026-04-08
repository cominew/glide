// apps/dashboard/components/RenderData.tsx

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { User, MapPin, Mail, Phone, ShoppingBag, TrendingUp, Package, Globe, Home, Clock } from 'lucide-react';

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(n);

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = 'bg-blue-500/10 text-blue-400' }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${className}`}>{text}</span>
);

// ── Customer List ─────────────────────────────────────────────────────────────

const CustomerList: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-2 mt-2">
    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
      <User size={11} /> {data.length} Customer{data.length !== 1 ? 's' : ''} Found
    </div>
    {data.map((c, i) => (
      <div key={i} className="rounded-xl p-3 hover:opacity-90 transition-all"
        style={{ backgroundColor:'var(--bg-overlay)', border:'1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
              style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>
              {c.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color:'var(--text-primary)' }}>{c.name}</div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {c.country && <span className="flex items-center gap-1 text-[10px]" style={{ color:'var(--text-muted)' }}><MapPin size={8} />{c.country}</span>}
                {c.city    && <span className="flex items-center gap-1 text-[10px]" style={{ color:'var(--text-muted)' }}><Home size={8} />{c.city}</span>}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-black text-emerald-400">{fmt$(c.revenue ?? 0)}</div>
            <div className="text-[10px]" style={{ color:'var(--text-muted)' }}>{c.orders ?? 0} orders</div>
          </div>
        </div>
        {(c.email || c.phone || c.address) && (
          <div className="mt-2 pt-2 flex flex-wrap gap-3" style={{ borderTop:'1px solid var(--border)' }}>
            {c.email   && <div className="flex items-center gap-1 text-[10px]" style={{ color:'var(--text-secondary)' }}><Mail size={9} className="text-blue-400" />{c.email}</div>}
            {c.phone   && <div className="flex items-center gap-1 text-[10px]" style={{ color:'var(--text-secondary)' }}><Phone size={9} className="text-emerald-400" />{c.phone}</div>}
            {c.address && <div className="flex items-center gap-1 text-[10px]" style={{ color:'var(--text-secondary)' }}><MapPin size={9} className="text-amber-400" />{c.address.slice(0,60)}</div>}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ── Top Customers ─────────────────────────────────────────────────────────────

const TopCustomers: React.FC<{ data: any[]; location?: string }> = ({ data, location }) => (
  <div className="space-y-3 mt-2">
    <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
      <TrendingUp size={11} /> {location ? `Customers from ${location}` : 'Top Customers by Revenue'}
    </div>
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize:9, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => v.split(' ')[0]} />
          <YAxis tick={{ fontSize:9, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ backgroundColor:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}
            formatter={(v: any) => [fmt$(v), 'Revenue']} />
          <Bar dataKey="revenue" fill="var(--accent)" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="space-y-1.5">
      {data.map((c, i) => (
        <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center"
              style={{ backgroundColor:'var(--bg-overlay)', color:'var(--text-muted)' }}>{i+1}</span>
            <span className="text-sm font-medium" style={{ color:'var(--text-primary)' }}>{c.name}</span>
            {c.country && <Badge text={c.country} className="bg-slate-500/10 text-slate-400" />}
            {c.city    && <Badge text={c.city}    className="bg-amber-500/10 text-amber-400" />}
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-emerald-400">{fmt$(c.revenue ?? 0)}</div>
            <div className="text-[10px]" style={{ color:'var(--text-muted)' }}>{c.orders} orders</div>
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
        { label:'Revenue',   value:fmt$(data.totalRevenue ?? 0), color:'text-emerald-400' },
        { label:'Orders',    value:data.totalOrders ?? 0,        color:'text-blue-400' },
        { label:'Customers', value:data.uniqueCustomers ?? 0,    color:'text-amber-400' },
        { label:'Products',  value:data.products?.length ?? 0,   color:'text-purple-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="p-3 rounded-xl" style={{ backgroundColor:'var(--bg-overlay)', border:'1px solid var(--border)' }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>{label}</div>
          <div className={`text-lg font-black mt-0.5 ${color}`}>{value}</div>
        </div>
      ))}
    </div>
    {data.products?.length > 0 && (
      <>
        <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color:'var(--text-muted)' }}><Package size={10} /> Product Breakdown</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.products} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" tick={{ fontSize:9, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize:8, fill:'var(--text-muted)' }} tickLine={false}
                axisLine={false} width={100} tickFormatter={(v) => v.length > 14 ? v.slice(0,14)+'…' : v} />
              <Tooltip contentStyle={{ backgroundColor:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}
                formatter={(v: any) => [fmt$(v), 'Revenue']} />
              <Bar dataKey="revenue" fill="#a855f7" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    )}
  </div>
);

// ── Sales Data (individual customer order history) ────────────────────────────

const SalesData: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-3 mt-2">
    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
      <Clock size={11} /> Order History · {data.customer}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[
        { label:'Total Spent', value:fmt$(data.totalSpent ?? 0), color:'text-emerald-400' },
        { label:'Orders',      value:data.orderCount ?? 0,       color:'text-blue-400' },
        { label:'Country',     value:data.country ?? '—',        color:'text-amber-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="p-3 rounded-xl" style={{ backgroundColor:'var(--bg-overlay)', border:'1px solid var(--border)' }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>{label}</div>
          <div className={`text-sm font-black mt-0.5 ${color}`}>{value}</div>
        </div>
      ))}
    </div>
    {data.orders?.length > 0 && (
      <div className="space-y-1">
        {data.orders.slice(0, 5).map((o: any, i: number) => (
          <div key={i} className="flex justify-between items-center py-1.5 text-xs"
            style={{ borderBottom:'1px solid var(--border)', color:'var(--text-secondary)' }}>
            <div className="flex-1 truncate mr-3">{o.product ?? '—'}</div>
            <div className="flex items-center gap-3 shrink-0">
              <span style={{ color:'var(--text-muted)' }}>{o.date ?? '—'}</span>
              <span className="font-bold text-emerald-400">{fmt$(o.amount ?? 0)}</span>
            </div>
          </div>
        ))}
      </div>
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
          <XAxis dataKey="country" tick={{ fontSize:9, fill:'var(--text-muted)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize:9, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ backgroundColor:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}
            formatter={(v: any) => [fmt$(v), 'Revenue']} />
          <Bar dataKey="revenue" fill="#10b981" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="space-y-1">
      {data.map((c, i) => (
        <div key={i} className="flex justify-between items-center py-1 text-sm"
          style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-4" style={{ color:'var(--text-muted)' }}>{i+1}</span>
            <span style={{ color:'var(--text-primary)' }}>{c.country}</span>
          </div>
          <div>
            <span className="font-black text-emerald-400">{fmt$(c.revenue)}</span>
            <span className="text-[10px] ml-2" style={{ color:'var(--text-muted)' }}>{c.orders} orders</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Overview ──────────────────────────────────────────────────────────────────

const OverviewCard: React.FC<{ data: any }> = ({ data }) => (
  <div className="grid grid-cols-2 gap-2 mt-2">
    {[
      { label:'Total Revenue', value:fmt$(data.revenue ?? data.total ?? 0), color:'text-emerald-400' },
      { label:'Orders',        value:data.orders ?? '—',                     color:'text-blue-400' },
      { label:'Customers',     value:data.customers ?? '—',                  color:'text-amber-400' },
      { label:'Countries',     value:data.countries ?? '—',                  color:'text-purple-400' },
    ].map(({ label, value, color }) => (
      <div key={label} className="p-3 rounded-xl" style={{ backgroundColor:'var(--bg-overlay)', border:'1px solid var(--border)' }}>
        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>{label}</div>
        <div className={`text-base font-black mt-0.5 ${color}`}>{value}</div>
      </div>
    ))}
  </div>
);

// ── Multi-skill result array ──────────────────────────────────────────────────

const MultiResult: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-4">
    {data.map((item, i) => <RenderData key={i} data={item} />)}
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────

export const RenderData: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  if (Array.isArray(data) && !data.length)
    return <div className="text-xs mt-1 italic" style={{ color:'var(--text-muted)' }}>No results found.</div>;
  if (Array.isArray(data)) return <MultiResult data={data} />;

  switch (data.type) {
    case 'customer_list':
      return data.data?.length
        ? <CustomerList data={data.data} />
        : <div className="text-xs mt-1 italic" style={{ color:'var(--text-muted)' }}>No customers found.</div>;

    case 'top_customers':
      return data.data?.length
        ? <TopCustomers data={data.data} location={data.location} />
        : <div className="text-xs mt-1 italic" style={{ color:'var(--text-muted)' }}>No data.</div>;

    case 'monthly_report':   return <MonthlyReport data={data} />;
    case 'sales_data':       return <SalesData data={data} />;
    case 'sales_by_country': return data.data?.length ? <CountryRanking data={data.data} /> : null;
    case 'overview':
    case 'total_revenue':    return <OverviewCard data={data} />;

    case 'knowledge_answer':
      return (
        <div className="mt-2 p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap"
          style={{ backgroundColor:'var(--bg-overlay)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>
          {data.answer}
        </div>
      );

    default:
      return (
        <pre className="text-[10px] p-3 rounded-xl overflow-auto max-h-40 mt-2"
          style={{ backgroundColor:'var(--bg-overlay)', color:'#10b981', border:'1px solid var(--border)' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
};
