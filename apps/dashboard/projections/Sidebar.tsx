// apps/dashboard/components/Sidebar.tsx
import React from 'react';
import { LayoutDashboard, Users, Bot, Activity, Settings, Menu, X, Zap, FileText, Gauge } from 'lucide-react';
import { Tab, Customer } from '../events/chat';

const NAV_ITEMS: { icon: any; label: string; tab: Tab }[] = [
  { icon: LayoutDashboard, label: 'Dashboard',   tab: 'dashboard' },
  { icon: Users,           label: 'Customers',   tab: 'customers' },
  { icon: Bot,             label: 'AI',           tab: 'ai' },
  { icon: Gauge,           label: 'Operations',  tab: 'operations' },
  { icon: Activity,        label: 'Health',       tab: 'health' },
  { icon: FileText,        label: 'Logs',         tab: 'logs' },
  { icon: Settings,        label: 'Settings',     tab: 'settings' },
];

const Item: React.FC<{ icon: any; label: string; active: boolean; onClick: () => void; collapsed: boolean }> =
  ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button onClick={onClick} title={collapsed ? label : undefined}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: collapsed ? '10px 0' : '10px 14px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      borderRadius: 10, border: 'none', cursor: 'pointer',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      fontSize: 13, fontWeight: active ? 600 : 400,
      transition: 'background .15s, color .15s',
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-overlay)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
  >
    <Icon size={18} style={{ flexShrink: 0 }} />
    {!collapsed && <span>{label}</span>}
  </button>
);

export const Sidebar: React.FC<{
  collapsed: boolean; setCollapsed: (v: boolean) => void; tab: Tab; setTab: (t: Tab) => void;
}> = ({ collapsed, setCollapsed, tab, setTab }) => (
  <aside style={{
    width: collapsed ? 64 : 220, flexShrink: 0,
    background: 'var(--bg-surface)',
    borderRight: '0.5px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    transition: 'width .25s',
    zIndex: 20,
  }}>
    <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
      {!collapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              GLIDE<span style={{ color: 'var(--accent)' }}>.</span>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '.15em', color: 'var(--text-muted)' }}>AI OS</div>
          </div>
        </div>
      )}
      {collapsed && <Zap size={18} style={{ color: 'var(--accent)' }} />}
      <button onClick={() => setCollapsed(!collapsed)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, marginLeft: collapsed ? 0 : 4 }}>
        {collapsed ? <Menu size={15} /> : <X size={15} />}
      </button>
    </div>

    <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
      {!collapsed && (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 14px 8px' }}>
          Command Center
        </div>
      )}
      {NAV_ITEMS.map(it => (
        <Item key={it.tab} icon={it.icon} label={it.label}
          active={tab === it.tab} onClick={() => setTab(it.tab)} collapsed={collapsed} />
      ))}
    </nav>

    <div style={{ padding: '12px 8px', borderTop: '0.5px solid var(--border)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: 'var(--bg-elevated)', borderRadius: 10, border: '0.5px solid var(--border)',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
        {!collapsed && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Online</span>}
      </div>
    </div>
  </aside>
);
