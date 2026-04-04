// D:\.openclaw\app\web-dashboard\src\tabs\HealthTab.tsx

import React from 'react';
import { Server, Database, Activity } from 'lucide-react';
import { StatCard } from '../components/StatCard';

interface HealthTabProps {
  connStatus: 'online' | 'offline' | 'checking';
  customersCount: number;
  monthlyTrend: any[];
  t: any;
  healthData?: any;
}

export const HealthTab: React.FC<HealthTabProps> = ({ connStatus, customersCount, monthlyTrend, t, healthData }) => {
  const lastConnection = new Date().toLocaleTimeString();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-xl shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-slate-200"><Server size={18} /> {t.backendService}</h3>
          <div className="mt-2 text-sm">状态：{connStatus === 'online' ? '✅ 在线' : '❌ 离线'}</div>
          <div className="text-sm">API 地址：http://localhost:3001/api</div>
          <div className="mt-4 text-xs text-slate-500">{t.lastConnection}：{lastConnection}</div>
        </div>
        <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-xl shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-slate-200"><Database size={18} /> {t.dataIndexes}</h3>
          <div className="mt-2 text-sm">{t.totalCustomers}：{customersCount}</div>
          <div className="text-sm">{t.growthTrend} 数据点：{monthlyTrend.length}</div>
          <div className="text-sm">{t.countries}：{0}</div>
        </div>
      </div>
      <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-xl shadow-sm">
        <h3 className="font-bold flex items-center gap-2 text-slate-200"><Activity size={18} /> {t.systemInfo}</h3>
        <div className="mt-2 text-sm">{t.frontendVersion}：V9 Enterprise</div>
        <div className="text-sm">{t.themeMode}：system</div>
        <div className="text-sm">{t.languageMode}：English</div>
      </div>
      {healthData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t.apiStatus} value={healthData.status || 'unknown'} icon={<Server size={20} />} color="blue" />
          <StatCard label={t.database} value="healthy" icon={<Database size={20} />} color="emerald" />
          <StatCard label={t.redis} value="healthy" icon={<Server size={20} />} color="amber" />
          <StatCard label={t.worker} value="healthy" icon={<Activity size={20} />} color="purple" />
        </div>
      )}
    </div>
  );
};