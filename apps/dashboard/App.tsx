// apps/dashboard/App.tsx

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardTab } from './tabs/DashboardTab';
import { CustomersTab } from './tabs/CustomersTab';
import { AITab } from './tabs/AITab';
import { HealthTab } from './tabs/HealthTab';
import { SettingsTab } from './tabs/SettingsTab';
import LogsTab, { Log } from './components/LogsTab';
import { useChat } from './hooks/useChat';
import { api } from './services/api';
import { Lang, Tab, Customer, OverviewData } from './types/chat';
import { Search, RefreshCw, Languages, Bell, ShieldCheck, WifiOff } from 'lucide-react';

// ── i18n ──────────────────────────────────────────────────────────────────────

const i18n = {
  zh: {
    dashboard: '数据看板',
    customers: '客户档案',
    ai: 'AI 助理',
    health: '系统健康',
    settings: '设置',
    online: '在线',
    offline: '离线',
    revenue: '年度营收',
    orders: '总订单数',
    activeCustomers: '活跃客户',
    countries: '覆盖国家',
    growthTrend: '营收增长趋势',
    productDist: '热门产品排行',
    customerIntel: '客户情报',
    orderCount: '订单',
    askPlaceholder: '输入指令或问题...',
    systemHealth: '节点状态',
    config: '系统配置',
    language: '语言',
    theme: '主题',
    notifications: '通知',
    saveSettings: '保存',
    apiStatus: 'API 网关',
    database: '数据库',
    redis: 'Redis 缓存',
    worker: '任务队列',
    refresh: '刷新',
    connecting: '连接中...',
    backendOffline: '后端离线，无法连接',
    retryConnect: '重试连接',
    chatError: '请求失败，请重试',
    noData: '暂无数据',
    networkLoad: '网络负载',
    activeClusters: '活跃集群',
    neuralIndexing: '神经索引',
    uptime: '运行时间',
    trafficThroughput: '流量吞吐',
    regionalDistribution: '区域分布',
    totalCustomers: '总客户数',
    highValue: '高价值客户 (>$1000)',
    activeClients: '活跃客户 (>5订单)',
    newThisWeek: '本周新客户',
    newThisMonth: '本月新客户',
    top5Revenue: '销售额最高的5名客户',
    analyze: '分析',
    backendService: '后端服务',
    dataIndexes: '数据索引',
    systemInfo: '系统信息',
    frontendVersion: '前端版本',
    themeMode: '主题模式',
    languageMode: '语言',
    lastConnection: '最后连接尝试',
    clear: '清除',
    howCanIHelp: '我能帮您什么？',
    exampleQueries: ['"前5名客户"', '"来自英国的客户"', '"查找 Adam"', '"销售额最高的国家"', '"2026年1月销售报告"', '"什么是 RosCard？"'],
  },
  en: {
    dashboard: 'Dashboard',
    customers: 'Customers',
    ai: 'AI Assistant',
    health: 'Health',
    settings: 'Settings',
    online: 'ONLINE',
    offline: 'OFFLINE',
    revenue: 'Annual Revenue',
    orders: 'Orders',
    activeCustomers: 'Active Clients',
    countries: 'Countries',
    growthTrend: 'Revenue Trend',
    productDist: 'Top Products',
    customerIntel: 'Customer Intel',
    orderCount: 'orders',
    askPlaceholder: 'Ask anything...',
    systemHealth: 'Health',
    config: 'Config',
    language: 'Language',
    theme: 'Theme',
    notifications: 'Notifications',
    saveSettings: 'Save',
    apiStatus: 'API Gateway',
    database: 'Database',
    redis: 'Redis Cache',
    worker: 'Worker Queue',
    refresh: 'Refresh',
    connecting: 'Connecting...',
    backendOffline: 'Backend offline, cannot connect',
    retryConnect: 'Retry',
    chatError: 'Request failed, please retry',
    noData: 'No data',
    networkLoad: 'Network Load',
    activeClusters: 'Active Clusters',
    neuralIndexing: 'Neural Indexing',
    uptime: 'Uptime',
    trafficThroughput: 'Traffic Throughput',
    regionalDistribution: 'Regional Distribution',
    totalCustomers: 'Total Customers',
    highValue: 'High-value (>$1000)',
    activeClients: 'Active (>5 orders)',
    newThisWeek: 'New this week',
    newThisMonth: 'New this month',
    top5Revenue: 'Top 5 by revenue',
    analyze: 'Analyze',
    backendService: 'Backend Service',
    dataIndexes: 'Data Indexes',
    systemInfo: 'System Info',
    frontendVersion: 'Frontend version',
    themeMode: 'Theme mode',
    languageMode: 'Language',
    lastConnection: 'Last connection attempt',
    clear: 'Clear',
    howCanIHelp: 'How can I help you?',
    exampleQueries: ['"top 5 customers"', '"customers from UK"', '"find Adam"', '"top countries"', '"sales report 2026-01"', '"what is RosCard?"'],
  },
} as const;

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // Persisted preferences
  const [lang, setLang]   = useState<Lang>(() => (localStorage.getItem('lang') as Lang) ?? 'en');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => (localStorage.getItem('theme') as any) ?? 'system');
  const [notifs, setNotifs] = useState(() => localStorage.getItem('notifications') !== 'false');

  // UI state
  const [tab, setTab]           = useState<Tab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [connStatus, setConnStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Data state
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [healthData, setHealthData]     = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Chat
  const { messages, chatLoading, sendMessage, clearMessages } = useChat();

  // Logs (placeholder — connect to real log stream later)
  const [logs, setLogs] = useState<Log[]>([]);

  const t = i18n[lang];
  const isOnline = connStatus === 'online';

  // ── Placeholder logs ────────────────────────────────────────────────────────
  useEffect(() => {
    setLogs([
      { id: '1', timestamp: new Date().toLocaleTimeString(), level: 'info',  message: 'Glide agent started' },
      { id: '2', timestamp: new Date().toLocaleTimeString(), level: 'info',  message: 'Skills loaded successfully' },
      { id: '3', timestamp: new Date().toLocaleTimeString(), level: 'warn',  message: 'Ollama model response slow' },
    ]);
  }, []);

  // ── Theme ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('theme', theme);
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [theme]);

  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('notifications', String(notifs)); }, [notifs]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const loadData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setConnStatus('checking');

    try {
      const [overview, topCustomers] = await Promise.all([api.overview(), api.top()]);
      setOverviewData(overview);
      setCustomers(topCustomers.map((c: any, i: number) => ({ ...c, id: String(i) })));
      setConnStatus('online');
    } catch (err) {
      console.error('[App] Failed to load data:', err);
      setConnStatus('offline');
      setOverviewData(null);
      setCustomers([]);
    }

    try {
      const health = await api.health();
      setHealthData(health);
    } catch {
      setHealthData(null);
    }

    if (manual) setIsRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Send helper ─────────────────────────────────────────────────────────────
  const handleSend = (msg: string) => {
    if (!isOnline) return;
    setTab('ai');
    sendMessage(msg);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-300 font-sans overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} tab={tab} setTab={setTab} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-10 bg-[#0b0f1a]/80 backdrop-blur-xl z-10 shrink-0">
          <div className="flex items-center gap-4 bg-slate-900/50 px-5 py-2.5 rounded-xl border border-slate-800 w-[400px] focus-within:border-blue-500/50 transition-all shadow-inner group">
            <Search size={18} className="text-slate-500 group-focus-within:text-blue-400 shrink-0" />
            <input
              type="text"
              id="global-search"
              autoComplete="off"
              placeholder={t.askPlaceholder}
              className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing || connStatus === 'checking'}
              title={t.refresh}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setLang(l => (l === 'zh' ? 'en' : 'zh'))}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            >
              <Languages size={20} />
            </button>
            <div className="relative group p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
              <Bell size={20} className="text-slate-500 group-hover:text-white" />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-[#0b0f1a]" />
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-white uppercase tracking-tighter">Root Administrator</p>
                <p className="text-[10px] text-blue-500 font-mono tracking-widest">ID_990422</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center border border-slate-700 shadow-xl">
                <ShieldCheck size={20} className="text-blue-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Offline banner */}
        {connStatus === 'offline' && (
          <div className="px-4 py-2 bg-amber-950 border-b border-amber-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
              <WifiOff size={12} />
              {t.backendOffline}
            </div>
            <button
              onClick={() => loadData(true)}
              className="text-xs font-bold text-amber-400 hover:underline"
            >
              {t.retryConnect}
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
          {tab === 'dashboard' && (
            <DashboardTab data={overviewData} customers={customers} t={t} isOnline={isOnline} onSend={handleSend} />
          )}
          {tab === 'customers' && (
            <CustomersTab customers={customers} onAnalyze={handleSend} t={t} isOnline={isOnline} />
          )}
          {tab === 'ai' && (
            <AITab
              isOnline={isOnline}
              messages={messages}
              chatLoading={chatLoading}
              onSend={handleSend}
              onClear={clearMessages}
            />
          )}
          {tab === 'health' && (
            <HealthTab
              connStatus={connStatus}
              customersCount={customers.length}
              monthlyTrend={overviewData?.monthlyTrend || []}
              t={t}
              healthData={healthData}
            />
          )}
          {tab === 'settings' && (
            <SettingsTab
              lang={lang}
              setLang={setLang}
              theme={theme}
              setTheme={setTheme}
              notifs={notifs}
              setNotifs={setNotifs}
              t={t}
            />
          )}
          {tab === 'logs' && <LogsTab logs={logs} />}
        </div>
      </main>
    </div>
  );
}
