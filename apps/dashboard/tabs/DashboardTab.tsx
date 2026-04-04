// D:\.openclaw\app\web-dashboard\src\tabs\DashboardTab.tsx

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Users, Globe, Activity, Sparkles } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Customer, OverviewData } from '../types/chat';

interface DashboardTabProps {
  data: OverviewData | null;
  customers: Customer[];
  t: any; // i18n object
  isOnline: boolean;
  onSend: (msg: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ data, customers, t, isOnline, onSend }) => {
  const totalRevenue = data?.revenue || 0;
  const totalOrders = data?.orders || 0;
  const uniqueCountries = data?.countries || 0;
  const monthlyTrend = data?.monthlyTrend || [];
  const topProducts = data?.topProducts || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* AI Insight Card */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl cursor-pointer hover:scale-[1.01] transition">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="text-amber-300" /> 🧠 AI Decision Brain
            </h2>
            <p className="opacity-90 mt-2">Click to generate executive sales intelligence</p>
          </div>
          <button
            onClick={() => onSend("Analyze current sales performance and provide strategic insights.")}
            className="flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
            disabled={!isOnline}
          >
            ✨ Analyze
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t.revenue} value={`$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<TrendingUp size={20} />} color="blue" />
        <StatCard label={t.orders} value={totalOrders} icon={<ShoppingCart size={20} />} color="emerald" />
        <StatCard label={t.activeCustomers} value={customers.length} icon={<Users size={20} />} color="amber" />
        <StatCard label={t.countries} value={uniqueCountries} icon={<Globe size={20} />} color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 p-6 rounded-xl shadow-sm">
          <h3 className="font-bold text-slate-200 mb-5 flex items-center gap-2">
            <Activity size={18} className="text-blue-400" /> {t.growthTrend}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }} itemStyle={{ color: '#60a5fa' }} />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="url(#colorLoad)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-xl shadow-sm">
          <h3 className="font-bold text-slate-200 mb-5">{t.productDist}</h3>
          <div className="space-y-4">
            {topProducts.map((p: any, i: number) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">{i+1}</div>
                  <div>
                    <div className="text-sm font-bold text-slate-300">{p.name}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Units</div>
                  </div>
                </div>
                <div className="text-sm font-black text-slate-200">{p.sales}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};