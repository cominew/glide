// apps/dashboard/App.tsx

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardTab } from './tabs/DashboardTab';
import { CustomersTab } from './tabs/CustomersTab';
import { AITab } from './tabs/AITab';
import { HealthTab } from './tabs/HealthTab';
import { SettingsTab } from './tabs/SettingsTab';
import LogsTab, { Log } from './components/LogsTab';
import useChat from './hooks/useChat';
import { api } from './services/api';
import { Lang, Tab, Customer, OverviewData } from './types/chat';
import { Search, RefreshCw, Languages, Bell, ShieldCheck, WifiOff } from 'lucide-react';

// ── i18n ──────────────────────────────────────────────────────────────────────

const i18n = {
  zh: {
    dashboard:'数据看板', customers:'客户档案', ai:'AI 助理', health:'系统健康', settings:'设置',
    online:'在线', offline:'离线', revenue:'年度营收', orders:'总订单数', activeCustomers:'活跃客户',
    countries:'覆盖国家', growthTrend:'营收增长趋势', productDist:'热门产品排行', customerIntel:'客户情报',
    orderCount:'订单', askPlaceholder:'输入指令或问题...', systemHealth:'节点状态', config:'系统配置',
    language:'语言', theme:'主题', notifications:'通知', saveSettings:'保存', apiStatus:'API 网关',
    database:'数据库', redis:'Redis 缓存', worker:'任务队列', refresh:'刷新', connecting:'连接中...',
    backendOffline:'后端离线，无法连接', retryConnect:'重试连接', chatError:'请求失败，请重试',
    noData:'暂无数据', totalCustomers:'总客户数', highValue:'高价值客户 (>$1000)',
    activeClients:'活跃客户 (>5订单)', newThisWeek:'本周新客户', newThisMonth:'本月新客户',
    top5Revenue:'销售额最高的5名客户', analyze:'分析', backendService:'后端服务',
    dataIndexes:'数据索引', systemInfo:'系统信息', frontendVersion:'前端版本',
    themeMode:'主题模式', languageMode:'语言', lastConnection:'最后连接尝试', clear:'清除',
    howCanIHelp:'我能帮您什么？',
  },
  en: {
    dashboard:'Dashboard', customers:'Customers', ai:'AI Assistant', health:'Health', settings:'Settings',
    online:'ONLINE', offline:'OFFLINE', revenue:'Annual Revenue', orders:'Orders',
    activeCustomers:'Active Clients', countries:'Countries', growthTrend:'Revenue Trend',
    productDist:'Top Products', customerIntel:'Customer Intel', orderCount:'orders',
    askPlaceholder:'Ask anything...', systemHealth:'Health', config:'Config', language:'Language',
    theme:'Theme', notifications:'Notifications', saveSettings:'Save', apiStatus:'API Gateway',
    database:'Database', redis:'Redis Cache', worker:'Worker Queue', refresh:'Refresh',
    connecting:'Connecting...', backendOffline:'Backend offline, cannot connect', retryConnect:'Retry',
    chatError:'Request failed, please retry', noData:'No data', totalCustomers:'Total Customers',
    highValue:'High-value (>$1000)', activeClients:'Active (>5 orders)', newThisWeek:'New this week',
    newThisMonth:'New this month', top5Revenue:'Top 5 by revenue', analyze:'Analyze',
    backendService:'Backend Service', dataIndexes:'Data Indexes', systemInfo:'System Info',
    frontendVersion:'Frontend version', themeMode:'Theme mode', languageMode:'Language',
    lastConnection:'Last connection attempt', clear:'Clear', howCanIHelp:'How can I help you?',
  },
} as const;

// ── Theme helper ──────────────────────────────────────────────────────────────

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  // Use explicit 'light' class so CSS variables respond
  root.classList.toggle('dark',  isDark);
  root.classList.toggle('light', !isDark);
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [lang,   setLang]   = useState<Lang>(() => (localStorage.getItem('lang') as Lang) ?? 'en');
  const [theme,  setTheme]  = useState<'light'|'dark'|'system'>(() => (localStorage.getItem('theme') as any) ?? 'system');
  const [notifs, setNotifs] = useState(() => localStorage.getItem('notifications') !== 'false');

  const [tab,       setTab]       = useState<Tab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [connStatus, setConnStatus] = useState<'online'|'offline'|'checking'>('checking');

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [healthData,   setHealthData]   = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);

  const { messages, chatLoading, sendMessage, clearMessages, streamText, streamTimeline } = useChat();
  const t        = i18n[lang];
  const isOnline = connStatus === 'online';

  // ── Theme ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  }, [theme]);

  // Re-apply on system preference change
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('notifications', String(notifs)); }, [notifs]);

  // ── Logs placeholder ──────────────────────────────────────────────────────

  useEffect(() => {
    setLogs([
      { id:'1', timestamp: new Date().toLocaleTimeString(), level:'info',  message:'Glide agent started' },
      { id:'2', timestamp: new Date().toLocaleTimeString(), level:'info',  message:'9 skills loaded' },
      { id:'3', timestamp: new Date().toLocaleTimeString(), level:'warn',  message:'memory/brain directory has limited context' },
    ]);
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setConnStatus('checking');

    try {
      const [overview, top] = await Promise.all([api.overview(), api.top()]);
      setOverviewData(overview);
      setCustomers(top.map((c: any, i: number) => ({ ...c, id: String(i) })));
      setConnStatus('online');
    } catch {
      setConnStatus('offline');
      setOverviewData(null);
      setCustomers([]);
    }

    try { setHealthData(await api.health()); } catch { setHealthData(null); }

    if (manual) setIsRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSend = (msg: string) => {
    if (!isOnline) return;
    setTab('ai');
    sendMessage(msg);
  };


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} tab={tab} setTab={setTab} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-20 flex items-center justify-between px-10 shrink-0 z-10 backdrop-blur-xl"
          style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>

          <div className="flex items-center gap-3 px-4 py-2 rounded-xl w-[400px] focus-within:ring-1 focus-within:ring-blue-500/50 transition-all"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input type="text" autoComplete="off" placeholder={t.askPlaceholder}
              className="bg-transparent border-none outline-none text-sm w-full"
              style={{ color: 'var(--text-primary)' }} />
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => loadData(true)} disabled={isRefreshing || connStatus==='checking'}
              className="p-2 rounded-lg transition-colors disabled:opacity-40 hover:opacity-70"
              style={{ color: 'var(--text-muted)' }} title={t.refresh}>
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setLang(l => l==='zh'?'en':'zh')}
              className="p-2 rounded-lg transition-colors hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              <Languages size={20} />
            </button>
            <div className="relative p-2 rounded-lg cursor-pointer hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </div>
            <div className="flex items-center gap-3 pl-5" style={{ borderLeft: '1px solid var(--border)' }}>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                  Root Administrator
                </p>
                <p className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>ID_990422</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        </header>

        {/* Offline banner */}
        {connStatus === 'offline' && (
          <div className="px-4 py-2 flex items-center justify-between shrink-0"
            style={{ backgroundColor: '#451a03', borderBottom: '1px solid #92400e' }}>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <WifiOff size={12} />{t.backendOffline}
            </div>
            <button onClick={() => loadData(true)} className="text-xs font-bold text-amber-400 hover:underline">
              {t.retryConnect}
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
          {tab === 'dashboard' && <DashboardTab data={overviewData} customers={customers} t={t} isOnline={isOnline} onSend={handleSend} />}
          {tab === 'customers' && <CustomersTab customers={customers} onAnalyze={handleSend} t={t} isOnline={isOnline} />}
          {tab === 'ai'        && <AITab isOnline={isOnline} messages={messages} chatLoading={chatLoading} onSend={handleSend} onClear={clearMessages} streamText={streamText} streamTimeline={streamTimeline} />}
          {tab === 'health'    && <HealthTab connStatus={connStatus} customersCount={customers.length} monthlyTrend={overviewData?.monthlyTrend||[]} t={t} healthData={healthData} />}
          {tab === 'settings'  && <SettingsTab lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} notifs={notifs} setNotifs={setNotifs} t={t} />}
          {tab === 'logs'      && <LogsTab logs={logs} />}
        </div>
      </main>
    </div>
  );
}
