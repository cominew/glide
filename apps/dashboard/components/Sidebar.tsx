// apps/dashboard/components/Sidebar.tsx

import React from 'react';
import { LayoutDashboard, Users, Bot, Activity, Settings, Menu, X, Zap, FileText } from 'lucide-react';
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
    title={collapsed ? label : undefined}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <Icon size={20} className="shrink-0" />
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
    { icon: Users,           label: 'Customers',  tab: 'customers' },
    { icon: Bot,             label: 'AI',          tab: 'ai' },
    { icon: Activity,        label: 'Health',      tab: 'health' },
    { icon: FileText,        label: 'Logs',        tab: 'logs' },
    { icon: Settings,        label: 'Settings',    tab: 'settings' },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-[#0b0f1a] border-r border-slate-800 flex flex-col shrink-0 z-20 transition-all duration-300`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-xl shadow-blue-500/20 shrink-0">
            <Zap className="text-white" size={20} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-white font-black text-lg tracking-tighter truncate">
                GLIDE<span className="text-blue-500">.</span>
              </h1>
              <p className="text-[9px] font-mono text-slate-600 tracking-widest mt-0.5 truncate">
                鼠脑 · AI CORE
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-500 hover:text-white transition shrink-0 ml-1"
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-4 pb-2 pt-1 text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">
            Command Center
          </p>
        )}
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

      {/* Status indicator */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          {!collapsed && <span className="text-xs text-slate-300 font-medium">Online</span>}
        </div>
      </div>
    </aside>
  );
};
