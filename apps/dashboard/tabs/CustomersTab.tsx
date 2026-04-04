// D:\.openclaw\app\web-dashboard\src\tabs\CustomersTab.tsx

import React from 'react';
import { Users, Award, ShoppingCart } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Customer } from '../types/chat';

interface CustomersTabProps {
  customers: Customer[];
  onAnalyze: (msg: string) => void;
  t: any;
  isOnline: boolean;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ customers, onAnalyze, t, isOnline }) => {
  const highValueCount = customers.filter(c => c.revenue > 1000).length;
  const activeClientsCount = customers.filter(c => c.orders > 5).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label={t.totalCustomers} value={customers.length} icon={<Users size={20} />} color="blue" />
        <StatCard label={t.highValue} value={highValueCount} icon={<Award size={20} />} color="emerald" />
        <StatCard label={t.activeClients} value={activeClientsCount} icon={<ShoppingCart size={20} />} color="purple" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onAnalyze("列出本周新客户")} className="px-4 py-2 rounded-lg bg-blue-600/10 text-blue-400 text-sm font-bold hover:bg-blue-600/20 transition">
          📅 {t.newThisWeek}
        </button>
        <button onClick={() => onAnalyze("列出本月新客户")} className="px-4 py-2 rounded-lg bg-blue-600/10 text-blue-400 text-sm font-bold hover:bg-blue-600/20 transition">
          📆 {t.newThisMonth}
        </button>
        <button onClick={() => onAnalyze("列出销售额最高的5名客户")} className="px-4 py-2 rounded-lg bg-emerald-600/10 text-emerald-400 text-sm font-bold hover:bg-emerald-600/20 transition">
          🏆 {t.top5Revenue}
        </button>
      </div>

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-200 text-lg">{t.customerIntel}</h3>
          <span className="px-3 py-1 bg-blue-600/10 text-blue-400 rounded-lg text-xs font-bold uppercase">{customers.length} Active</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Orders</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Revenue</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Country</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold uppercase text-sm">
                        {c.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-300 text-sm">{c.name}</div>
                        {c.email && <div className="text-[10px] text-slate-500">{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-slate-400 text-sm">{c.orders}</td>
                  <td className="px-6 py-4 text-center font-black text-slate-200 text-sm">${c.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{c.country || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition text-xs font-bold"
                      onClick={() => onAnalyze(`Analyze customer ${c.name} including revenue trend, risk level, and opportunity.`)}
                      disabled={!isOnline}
                    >
                      ✨ {t.analyze}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};