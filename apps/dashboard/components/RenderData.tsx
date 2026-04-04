// D:\.openclaw\app\web-dashboard\src\components\RenderData.tsx

import React from 'react';

export const RenderData: React.FC<{ data: any }> = ({ data }) => {
  if (!data || (Array.isArray(data) && !data.length))
    return <div className="text-slate-400 italic text-xs">No results found.</div>;

  // 客户/国家表格
  if (Array.isArray(data) && (data[0]?.name !== undefined || data[0]?.country !== undefined)) {
    const isCountry = data[0]?.country !== undefined && data[0]?.name === undefined;
    return (
      <div>
        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">
          {isCountry ? '🌍 Countries' : '🏆 Customers'}
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left py-1">{isCountry ? 'Country' : 'Name'}</th>
              <th className="text-right py-1">Revenue</th>
              <th className="text-right py-1">Orders</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any, i: number) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-1 text-slate-700">{r.country ?? r.name}</td>
                <td className="py-1 text-right text-emerald-600 font-mono">${(+(r.revenue ?? 0)).toFixed(2)}</td>
                <td className="py-1 text-right text-slate-400">{r.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 月度报表
  if (data.month) {
    return (
      <div>
        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">📊 {data.month}</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            ['Orders', data.totalOrders],
            ['Units', data.totalUnits],
            ['Revenue', `$${(+(data.totalRevenue ?? 0)).toFixed(2)}`],
            ['Customers', data.uniqueCustomers]
          ].map(([k, v], i) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
              <div className="text-[9px] text-slate-400 uppercase font-bold">{k}</div>
              <div className="font-black text-slate-700 dark:text-slate-300 text-sm">{v}</div>
            </div>
          ))}
        </div>
        {(data.products ?? []).map((p: any, i: number) => (
          <div key={i} className="text-[10px] text-slate-500 py-0.5">{p.name} — {p.units} units · ${(+(p.revenue ?? 0)).toFixed(2)}</div>
        ))}
      </div>
    );
  }

  // 客户详情
  if (data.totalOrders !== undefined || data.totalAmount !== undefined) {
    return (
      <div>
        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">👤 Customer</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[
            ['Orders', data.totalOrders],
            ['Units', data.totalQuantity],
            ['Revenue', `$${(+(data.totalAmount ?? 0)).toFixed(2)}`]
          ].map(([k, v], i) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
              <div className="text-[9px] text-slate-400 uppercase font-bold">{k}</div>
              <div className="font-black text-slate-700 dark:text-slate-300 text-sm">{v}</div>
            </div>
          ))}
        </div>
        {(data.countries ?? []).length > 0 && <div className="text-xs text-slate-500 mt-1">Countries: {data.countries.join(', ')}</div>}
        {data.contacts && (
          <div className="text-xs text-slate-500 mt-1 space-y-0.5">
            {data.contacts.email && <div>📧 {data.contacts.email}</div>}
            {data.contacts.phone && <div>📞 {data.contacts.phone}</div>}
          </div>
        )}
      </div>
    );
  }

  return <pre className="text-[10px] bg-slate-900 text-emerald-400 p-2 rounded overflow-auto max-h-28">{JSON.stringify(data, null, 2)}</pre>;
};