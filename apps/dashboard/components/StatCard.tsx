// D:\.openclaw\app\web-dashboard\src\components\StatCard.tsx

import React from 'react';

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactElement;
  color: 'blue' | 'emerald' | 'amber' | 'purple';
}> = ({ label, value, icon, color }) => {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  }[color];

  return (
    <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-xl hover:border-blue-500/50 transition-all group shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colorClasses} group-hover:bg-blue-600/20 transition-colors`}>
          {icon}
        </div>
      </div>
      <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{label}</h4>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
};