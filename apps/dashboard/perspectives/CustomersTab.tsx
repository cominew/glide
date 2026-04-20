// apps/dashboard/tabs/CustomersTab.tsx
import React from 'react';
import { Users, Award, ShoppingCart } from 'lucide-react';
import { StatCard } from '../projections/StatCard';
import { Customer } from '../events/chat';

interface Props { customers: Customer[]; onAnalyze: (m: string) => void; t: any; isOnline: boolean; }

export const CustomersTab: React.FC<Props> = ({ customers, onAnalyze, t, isOnline }) => {
  const highValue   = customers.filter(c => c.revenue > 1000).length;
  const activeCount = customers.filter(c => c.orders > 5).length;

  const Chip: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-overlay)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <StatCard label={t.totalCustomers} value={customers.length} icon={<Users size={18}/>}        color="blue" />
        <StatCard label={t.highValue}      value={highValue}        icon={<Award size={18}/>}        color="emerald" />
        <StatCard label={t.activeClients}  value={activeCount}      icon={<ShoppingCart size={18}/>} color="amber" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip label={t.newThisWeek}   onClick={() => onAnalyze('列出本周新客户')} />
        <Chip label={t.newThisMonth}  onClick={() => onAnalyze('列出本月新客户')} />
        <Chip label={t.top5Revenue}   onClick={() => onAnalyze('列出销售额最高的5名客户')} />
      </div>

      <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.customerIntel}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{customers.length} Active</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Customer','Orders','Revenue','Country','Action'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: h === 'Revenue' ? 'right' : h === 'Orders' ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} style={{ borderTop: '0.5px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--row-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>{c.name[0]}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>{c.orders}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>${c.revenue.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.country || '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button disabled={!isOnline}
                      onClick={() => onAnalyze(`Analyze customer ${c.name} including revenue trend, risk level, and opportunity.`)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: isOnline ? 'pointer' : 'not-allowed', opacity: isOnline ? 1 : 0.5 }}>
                      {t.analyze}
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
