// apps/dashboard/tabs/DashboardTab.tsx
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Users, Globe, Activity, Sparkles } from 'lucide-react';
import { StatCard } from '../projections/StatCard';
import { Customer, OverviewData } from '../events/chat';

interface Props { data: OverviewData | null; customers: Customer[]; t: any; isOnline: boolean; onSend: (m: string) => void; }

export const DashboardTab: React.FC<Props> = ({ data, customers, t, isOnline, onSend }) => {
  const revenue = data?.revenue ?? 0;
  const orders  = data?.orders  ?? 0;
  const countries = data?.countries ?? 0;
  const trend   = data?.monthlyTrend ?? [];
  const products = data?.topProducts ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div style={{ borderRadius: 16, padding: '20px 24px', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: '#fcd34d' }} /> AI Decision Brain
          </div>
          <div style={{ opacity: .85, marginTop: 4, fontSize: 13 }}>Generate executive sales intelligence</div>
        </div>
        <button onClick={() => onSend('Analyze current sales performance and provide strategic insights.')}
          disabled={!isOnline}
          style={{ background: '#fff', color: '#2563eb', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: isOnline ? 'pointer' : 'not-allowed', opacity: isOnline ? 1 : 0.5 }}>
          Analyze ✨
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
        <StatCard label={t.revenue}          value={`$${revenue.toLocaleString(undefined,{maximumFractionDigits:0})}`} icon={<TrendingUp size={18}/>}   color="blue" />
        <StatCard label={t.orders}           value={orders}           icon={<ShoppingCart size={18}/>} color="emerald" />
        <StatCard label={t.activeCustomers}  value={customers.length} icon={<Users size={18}/>}        color="amber" />
        <StatCard label={t.countries}        value={countries}        icon={<Globe size={18}/>}         color="purple" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, flexWrap: 'wrap' } as any}>
        <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            <Activity size={16} style={{ color: 'var(--accent)' }} /> {t.growthTrend}
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 10 }} itemStyle={{ color: 'var(--accent)' }} labelStyle={{ color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 18 }}>{t.productDist}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {products.map((p: any, i: number) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{i+1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Units</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.sales}</div>
              </div>
            ))}
            {products.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 24 }}>{t.noData}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
