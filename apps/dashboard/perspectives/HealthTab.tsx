// apps/dashboard/tabs/HealthTab.tsx
import React from 'react';
import { Server, Database, Activity } from 'lucide-react';
import { StatCard } from '../projections/StatCard';

interface Props { connStatus: 'online'|'offline'|'checking'; customersCount: number; monthlyTrend: any[]; t: any; healthData?: any; }

const Card: React.FC<{ title: React.ReactNode; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>{title}</div>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
  </div>
);

export const HealthTab: React.FC<Props> = ({ connStatus, customersCount, monthlyTrend, t, healthData }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title={<><Server size={16} /> {t.backendService}</>}>
        <Row label="Status" value={<span style={{ color: connStatus === 'online' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{connStatus === 'online' ? '● Online' : '● Offline'}</span>} />
        <Row label="API" value="http://localhost:3001/api" />
        <Row label={t.lastConnection} value={new Date().toLocaleTimeString()} />
      </Card>
      <Card title={<><Database size={16} /> {t.dataIndexes}</>}>
        <Row label={t.totalCustomers}  value={customersCount} />
        <Row label="Trend data points" value={monthlyTrend.length} />
      </Card>
    </div>
    <Card title={<><Activity size={16} /> {t.systemInfo}</>}>
      <Row label={t.frontendVersion} value="V9 Enterprise" />
      <Row label={t.themeMode}       value="system" />
      <Row label={t.languageMode}    value="English" />
    </Card>
    {healthData && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        <StatCard label={t.apiStatus}  value={healthData.status || 'ok'} icon={<Server size={18}/>}   color="blue" />
        <StatCard label={t.database}   value="healthy"                   icon={<Database size={18}/>} color="emerald" />
        <StatCard label={t.redis}      value="healthy"                   icon={<Server size={18}/>}   color="amber" />
        <StatCard label={t.worker}     value="healthy"                   icon={<Activity size={18}/>} color="purple" />
      </div>
    )}
  </div>
);
