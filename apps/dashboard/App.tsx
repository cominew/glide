// apps/dashboard/App.tsx
// Glide v4 — event-native dashboard (inline styles only)

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar }       from './projections/Sidebar';
import { DashboardTab }  from './perspectives/DashboardTab';
import { CustomersTab }  from './perspectives/CustomersTab';
import { AITab }         from './perspectives/AITab';
import { HealthTab }     from './perspectives/HealthTab';
import { OperationsTab } from './perspectives/OperationsTab';
import { SettingsTab }   from './perspectives/SettingsTab';
import LogsTab           from './perspectives/LogsTab';
import useChat           from './observers/useChat';
import { useEventStream } from './observers/useEventStream';
import { api }           from './gateways/api';
import { Tab }           from './events/chat';
import {
  Search, RefreshCw, Languages, Bell, ShieldCheck, WifiOff, EyeOff,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './index.css';

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark',  isDark);
  root.classList.toggle('light', !isDark);
}

export default function App() {
  // ── Local preferences ──────────────────────────────────────
  const [lang,   setLang]   = useState<'zh' | 'en'>(
    () => (localStorage.getItem('lang') as any) ?? 'en'
  );
  const [theme,  setTheme]  = useState<'light' | 'dark' | 'system'>(
    () => (localStorage.getItem('theme') as any) ?? 'system'
  );
  const [notifs, setNotifs] = useState(
    () => localStorage.getItem('notifications') !== 'false'
  );

  // ── Navigation ─────────────────────────────────────────────
  const [tab,       setTab]       = useState<Tab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // ── Connection status & projection data ────────────────────
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [customers,    setCustomers]    = useState<any[]>([]);
  const [healthData,   setHealthData]   = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);

  // ── Event stream ───────────────────────────────────────────
  const glide = useEventStream();

  const connStatus: 'checking' | 'connecting' | 'online' | 'offline' =
    backendAlive === null
      ? 'checking'
      : backendAlive === false
        ? 'offline'
        : glide.connected
          ? 'online'
          : 'connecting';

  // ── Chat ───────────────────────────────────────────────────
  const {
    messages,
    chatLoading,
    sendMessage,
    clearMessages,
    streamText,
    observeEvent,
  } = useChat();

  // ⭐ FIX: consume ALL new events, not just the last one
  const processedIdxRef = useRef(0);

  useEffect(() => {
    const events = glide.events;
    if (processedIdxRef.current < events.length) {
      for (let i = processedIdxRef.current; i < events.length; i++) {
        observeEvent(events[i]);
      }
      processedIdxRef.current = events.length;
    }
  }, [glide.events, observeEvent]);

  const isOnline = backendAlive === true;

  const safeStreamText = isOnline
    ? streamText
    : 'Backend offline. Please check your connection.';

  // ── Theme & preferences persistence ───────────────────────
  useEffect(() => { localStorage.setItem('theme', theme); applyTheme(theme); }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme]);
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('notifications', String(notifs)); }, [notifs]);

  // ── Initial health check ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const health = await api.health();
        if (cancelled) return;
        const alive = health.status === 'ok' || health.status === 'alive';
        setBackendAlive(alive);
        if (alive) setHealthData(health);
      } catch {
        if (!cancelled) setBackendAlive(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Force refresh on projection:refresh (window show) ─────
  useEffect(() => {
    const unlisten = listen('projection:refresh', () => {
      setRefreshKey(k => k + 1);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // ── Refresh key on tab switch for chart panels ─────────────
  useEffect(() => {
    if (tab === 'dashboard' || tab === 'customers') {
      setRefreshKey(k => k + 1);
    }
  }, [tab]);

  // ── Event-driven data projection ──────────────────────────
  useEffect(() => {
    for (let i = glide.events.length - 1; i >= 0; i--) {
      const e = glide.events[i];
      const payload = e.payload;
      if (!payload) continue;

      const fragments = payload.fragments ?? [];
      const innerFragments = payload?.fragments?.[0]?.fragments ?? [];
      const allFragments = [...fragments, ...innerFragments];

      for (const frag of allFragments) {
        if (frag.type === 'data') {
          if (frag.name === 'overview') setOverviewData(frag.value);
          if (frag.name === 'customers' || frag.name === 'top_customers') {
            const raw = Array.isArray(frag.value)
              ? frag.value
              : frag.value?.customers ?? [];
            if (raw.length > 0)
              setCustomers(raw.map((c: any, i: number) => ({ ...c, id: c.id ?? String(i) })));
          }
        }
      }

      if (e.type === 'system.status') setHealthData(e.payload);
    }
  }, [glide.events, refreshKey]);

  // ── Initial static data fetch ─────────────────────────────
  const loadData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [overview, top] = await Promise.allSettled([
        api.overview(),
        api.top(),
      ]);
      if (overview.status === 'fulfilled') setOverviewData(overview.value);
      if (top.status === 'fulfilled') {
        const raw = top.value;
        setCustomers(raw.map((c: any, i: number) => ({ ...c, id: c.id ?? String(i) })));
      }
    } catch {}
    if (manual) setIsRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, []);

  // ── User action: send query ────────────────────────────────
  const handleSend = (msg: string) => {
    if (!isOnline) return;
    setTab('ai');
    sendMessage(msg);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100%', overflow: 'hidden',
      fontFamily: 'sans-serif', backgroundColor: 'var(--bg-base)',
      color: 'var(--text-primary)',
    }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} tab={tab} setTab={setTab} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: '80px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 40px', flexShrink: 0,
          zIndex: 10, backdropFilter: 'blur(12px)',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '8px 16px', borderRadius: '12px', width: '400px',
            backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)',
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text" autoComplete="off" placeholder="ask anything..."
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', width: '100%', color: 'var(--text-primary)' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleSend(e.currentTarget.value.trim());
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => invoke('hide_window')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <EyeOff size={18} />
            </button>
            <button onClick={() => loadData(true)}
              disabled={isRefreshing || backendAlive === null}
              style={{
                padding: '8px', borderRadius: '8px',
                opacity: (isRefreshing || connStatus === 'checking') ? 0.4 : 1,
                cursor: (isRefreshing || connStatus === 'checking') ? 'not-allowed' : 'pointer',
                background: 'none', border: 'none', color: 'var(--text-muted)',
              }}>
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
              style={{ padding: '8px', borderRadius: '8px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              <Languages size={20} />
            </button>

            <div style={{ position: 'relative', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Bell size={20} />
              <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px', borderLeft: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'right', display: 'none' }} className="sm:block">
                <p style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Root</p>
                <p style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {connStatus === 'online' ? '● live' : connStatus === 'connecting' ? '● attaching' : connStatus === 'checking' ? '● checking' : '● offline'}
                </p>
              </div>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)',
              }}>
                <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        </header>

        {/* Offline banner */}
        {backendAlive === false && (
          <div style={{
            padding: '8px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
            backgroundColor: '#451a03', borderBottom: '1px solid #92400e',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500, color: '#fbbf24' }}>
              <WifiOff size={12} /> Backend offline
            </div>
            <button onClick={() => {
              api.health()
                .then(h => {
                  if (h.status === 'ok' || h.status === 'alive') {
                    setBackendAlive(true);
                    setHealthData(h);
                  }
                })
                .catch(() => setBackendAlive(false));
            }}
              style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Retry
            </button>
          </div>
        )}

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px 24px' }}>
          {tab === 'dashboard' && (
            <DashboardTab key={refreshKey} data={overviewData} customers={customers}
              t={{} as any} isOnline={isOnline} onSend={handleSend} />
          )}
          {tab === 'customers' && (
            <CustomersTab key={refreshKey} customers={customers} onAnalyze={handleSend}
              t={{} as any} isOnline={isOnline} />
          )}
          {tab === 'ai' && (
            <AITab
              isOnline={isOnline}
              messages={messages}
              chatLoading={chatLoading}
              onSend={handleSend}
              onClear={clearMessages}
              streamText={safeStreamText}
              events={glide.events}
            />
          )}
          {tab === 'operations' && (
            <OperationsTab events={glide.events} connected={glide.connected} />
          )}
          {tab === 'health' && (
            <HealthTab connStatus={connStatus} customersCount={customers.length}
              monthlyTrend={overviewData?.monthlyTrend ?? []} t={{} as any}
              healthData={healthData} />
          )}
          {tab === 'settings' && (
            <SettingsTab lang={lang} setLang={setLang} theme={theme}
              setTheme={setTheme} notifs={notifs} setNotifs={setNotifs} t={{} as any} />
          )}
          {tab === 'logs' && (
            <LogsTab events={glide.events} connected={glide.connected} />
          )}
        </div>
      </main>
    </div>
  );
}