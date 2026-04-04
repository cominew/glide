// D:\.openclaw\app\web-dashboard\src\components\Sidebar.tsx
import React from 'react';
import { LayoutDashboard, Users, Bot, Activity, Settings, Menu, X, Cpu, FileText } from 'lucide-react';
import { Tab } from '../types/chat';

interface SidebarItemProps {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <Icon size={20} />
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </button>
);

export const Sidebar: React.FC<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}> = ({ collapsed, setCollapsed, tab, setTab }) => {
  const items: { icon: any; label: string; tab: Tab }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', tab: 'dashboard' },
  { icon: Users, label: 'Customers', tab: 'customers' },
  { icon: Bot, label: 'AI', tab: 'ai' },
  { icon: Activity, label: 'Health', tab: 'health' },
  { icon: Settings, label: 'Settings', tab: 'settings' },
  { icon: FileText, label: 'Logs', tab: 'logs' },
];
 

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-72'} bg-[#0b0f1a] border-r border-slate-800 flex flex-col shrink-0 z-20 transition-all duration-300`}>
      {/* Header */}
      <div className="p-8 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-xl shadow-blue-500/10">
            <Cpu className="text-white" size={24} />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-white font-black text-xl tracking-tighter">OPENCLAW<span className="text-blue-500">.</span></h1>
              <p className="text-[9px] font-mono text-slate-600 tracking-widest mt-0.5">UNIFIED CORE OS</p>
            </div>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white transition">
          {collapsed ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-5 space-y-2 overflow-y-auto">
        <p className="px-4 py-3 text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">{!collapsed && 'Command Center'}</p>
        {items.map(item => (
          <SidebarItem
            key={item.tab}
            icon={item.icon}
            label={item.label}
            active={tab === item.tab}
            onClick={() => setTab(item.tab)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Status (simplified) */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          {!collapsed && <span className="text-xs text-slate-300 font-medium">Online</span>}
        </div>
      </div>
    </aside>
  );
};