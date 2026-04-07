// apps/dashboard/components/Sidebar.tsx

import React from 'react';
import { LayoutDashboard, Users, Bot, Activity, Settings, Menu, X, Zap, FileText } from 'lucide-react';
import { Tab } from '../types/chat';

const SidebarItem: React.FC<{
  icon: any; label: string; active: boolean; onClick: () => void; collapsed: boolean;
}> = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
    style={{
      backgroundColor: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-overlay)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
  >
    <Icon size={19} className="shrink-0" />
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </button>
);

export const Sidebar: React.FC<{
  collapsed: boolean; setCollapsed: (v: boolean) => void; tab: Tab; setTab: (t: Tab) => void;
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
      className={`${collapsed ? 'w-20' : 'w-64'} flex flex-col shrink-0 z-20 transition-all duration-300`}
      style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl shrink-0" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
            <Zap className="text-white" size={18} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-black text-lg tracking-tighter truncate" style={{ color: 'var(--text-primary)' }}>
                GLIDE<span style={{ color: 'var(--accent)' }}>.</span>
              </h1>
              <p className="text-[9px] font-mono tracking-widest truncate" style={{ color: 'var(--text-muted)' }}>
                鼠脑 · AI CORE
              </p>
            </div>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 ml-1 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}>
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-4 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.3em]"
            style={{ color: 'var(--text-muted)' }}>
            Command Center
          </p>
        )}
        {items.map(item => (
          <SidebarItem key={item.tab} icon={item.icon} label={item.label}
            active={tab === item.tab} onClick={() => setTab(item.tab)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Status */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 p-3 rounded-xl"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          {!collapsed && <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Online</span>}
        </div>
      </div>
    </aside>
  );
};
