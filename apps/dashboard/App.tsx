// App.tsx
import { useState, useEffect, useCallback } from 'react';
import { Sidebar }        from './components/Sidebar';
import { DashboardTab }   from './tabs/DashboardTab';
import { CustomersTab }   from './tabs/CustomersTab';
import { AITab }          from './tabs/AITab';
import { OperationsTab }  from './tabs/OperationsTab';
import { HealthTab }      from './tabs/HealthTab';
import { SettingsTab }    from './tabs/SettingsTab';
import LogsTab            from './tabs/LogsTab';
import useChat            from './hooks/useChat';
import { useEventStream } from './hooks/useEventStream';
import { api }            from './services/api';
import { Lang, Tab, Customer, OverviewData } from './types/chat';
import { Search, RefreshCw, Languages, Bell, ShieldCheck, WifiOff } from 'lucide-react';

const i18n = {
  zh: {
    dashboard:'数据看板', customers:'客户档案', ai:'AI 助理', health:'系统健康', settings:'设置', operations:'运营驾驶舱',
    online:'在线', offline:'离线', revenue:'年度营收', orders:'总订单数', activeCustomers:'活跃客户',
    countries:'覆盖国家', growthTrend:'营收增长趋势', productDist:'热门产品排行', customerIntel:'客户情报',
    askPlaceholder:'输入指令或问题...', systemHealth:'节点状态', config:'系统配置',
    language:'语言', theme:'主题', notifications:'通知', saveSettings:'保存', apiStatus:'API 网关',
    database:'数据库', redis:'Redis 缓存', worker:'任务队列', refresh:'刷新',
    backendOffline:'后端离线', retryConnect:'重试',
    noData:'暂无数据', totalCustomers:'总客户数', highValue:'高价值客户 (>$1000)',
    activeClients:'活跃客户 (>5订单)', newThisWeek:'本周新客户', newThisMonth:'本月新客户',
    top5Revenue:'销售额前5', analyze:'分析', backendService:'后端服务',
    dataIndexes:'数据索引', systemInfo:'系统信息', frontendVersion:'前端版本',
    themeMode:'主题模式', languageMode:'语言', lastConnection:'最后连接时间', clear:'清除',
  },
  en: {
    dashboard:'Dashboard', customers:'Customers', ai:'AI', health:'Health', settings:'Settings', operations:'Operations',
    online:'ONLINE', offline:'OFFLINE', revenue:'Annual Revenue', orders:'Orders',
    activeCustomers:'Active Clients', countries:'Countries', growthTrend:'Revenue Trend',
    productDist:'Top Products', customerIntel:'Customer Intel',
    askPlaceholder:'Ask anything...', systemHealth:'Health', config:'Config',
    language:'Language', theme:'Theme', notifications:'Notifications', saveSettings:'Save',
    apiStatus:'API Gateway', database:'Database', redis:'Redis Cache', worker:'Worker Queue', refresh:'Refresh',
    backendOffline:'Backend offline', retryConnect:'Retry',
    noData:'No data', totalCustomers:'Total Customers', highValue:'High-value (>$1000)',
    activeClients:'Active (>5 orders)', newThisWeek:'New this week', newThisMonth:'New this month',
    top5Revenue:'Top 5 by revenue', analyze:'Analyze', backendService:'Backend Service',
    dataIndexes:'Data Indexes', systemInfo:'System Info', frontendVersion:'Frontend version',
    themeMode:'Theme mode', languageMode:'Language', lastConnection:'Last connection', clear:'Clear',
  },
} as const;

function applyTheme(theme: 'light'|'dark'|'system') {
  const dark = theme==='dark' || (theme==='system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
}

export default function App() {
  const [lang,   setLang]   = useState<Lang>(()=>(localStorage.getItem('lang') as Lang)?? 'en');
  const [theme,  setTheme]  = useState<'light'|'dark'|'system'>(()=>(localStorage.getItem('theme') as any)?? 'system');
  const [notifs, setNotifs] = useState(()=>localStorage.getItem('notifications')!=='false');

  const [tab,        setTab]        = useState<Tab>('dashboard');
  const [collapsed,  setCollapsed]  = useState(false);
  const [connStatus, setConnStatus] = useState<'online'|'offline'|'checking'>('checking');

  const [overviewData, setOverviewData] = useState<OverviewData|null>(null);
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [healthData,   setHealthData]   = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { messages, chatLoading, sendMessage, clearMessages, streamText } = useChat();

  // ── Global event stream (replaces Log state + CognitiveStream) ──
  const { events, connected, filter, getSession, clear: clearEvents } = useEventStream();

  const t = i18n[lang];
  const isOnline = connStatus === 'online';

  useEffect(() => { localStorage.setItem('theme', theme); applyTheme(theme); }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => { if (theme==='system') applyTheme('system'); };
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h);
  }, [theme]);
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('notifications', String(notifs)); }, [notifs]);

  // Relay Operations tab prompt requests
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) { setTab('ai'); sendMessage(detail); }
    };
    window.addEventListener('glide:ask', h);
    return () => window.removeEventListener('glide:ask', h);
  }, [sendMessage]);

  const loadData = useCallback(async (manual=false) => {
    if (manual) setIsRefreshing(true);
    else setConnStatus('checking');
    try {
      const [overview, top] = await Promise.all([api.overview(), api.top()]);
      setOverviewData(overview);
      setCustomers(top.map((c:any,i:number)=>({...c,id:String(i)})));
      setConnStatus('online');
    } catch {
      setConnStatus('offline');
      setOverviewData(null); setCustomers([]);
    }
    try { setHealthData(await api.health()); } catch { setHealthData(null); }
    if (manual) setIsRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSend = (msg: string) => { if (!isOnline) return; setTab('ai'); sendMessage(msg); };

  return (
    <div style={{ display:'flex',height:'100vh',width:'100%',overflow:'hidden',background:'var(--bg-base)',color:'var(--text-primary)' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} tab={tab} setTab={setTab} />

      <main style={{ flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden' }}>

        <header style={{ height:64,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 28px',flexShrink:0,background:'var(--bg-surface)',borderBottom:'0.5px solid var(--border)',zIndex:10 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 14px',borderRadius:10,background:'var(--bg-elevated)',border:'0.5px solid var(--border)',width:360 }}>
            <Search size={14} style={{ color:'var(--text-muted)',flexShrink:0 }} />
            <input type="text" autoComplete="off" placeholder={t.askPlaceholder}
              style={{ background:'transparent',border:'none',outline:'none',fontSize:13,width:'100%',color:'var(--text-primary)' }} />
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <button onClick={()=>loadData(true)} disabled={isRefreshing}
              style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:6 }}>
              <RefreshCw size={18} style={{ animation:isRefreshing?'spin 1s linear infinite':'none' }} />
            </button>
            <button onClick={()=>setLang(l=>l==='zh'?'en':'zh')}
              style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:6 }}>
              <Languages size={18} />
            </button>
            <div style={{ position:'relative',padding:6,color:'var(--text-muted)',cursor:'pointer' }}>
              <Bell size={18} />
              <div style={{ position:'absolute',top:6,right:6,width:7,height:7,background:'var(--danger)',borderRadius:'50%' }} />
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:10,paddingLeft:16,borderLeft:'0.5px solid var(--border)' }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11,fontWeight:700,letterSpacing:'.05em',color:'var(--text-primary)' }}>Root Administrator</div>
                <div style={{ fontSize:10,fontFamily:'monospace',color:'var(--accent)' }}>ID_990422</div>
              </div>
              <div style={{ width:36,height:36,borderRadius:9,background:'var(--bg-elevated)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <ShieldCheck size={18} style={{ color:'var(--accent)' }} />
              </div>
            </div>
          </div>
        </header>

        {connStatus==='offline' && (
          <div style={{ padding:'7px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#451a03',borderBottom:'1px solid #92400e',flexShrink:0 }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#fbbf24' }}>
              <WifiOff size={12}/> {t.backendOffline}
            </div>
            <button onClick={()=>loadData(true)} style={{ fontSize:12,fontWeight:700,color:'#fbbf24',background:'none',border:'none',cursor:'pointer' }}>{t.retryConnect}</button>
          </div>
        )}

        <div style={{ flex:1,overflowY:'auto',padding:'24px 28px' }}>
          {tab==='dashboard'  && <DashboardTab  data={overviewData} customers={customers} t={t} isOnline={isOnline} onSend={handleSend} />}
          {tab==='customers'  && <CustomersTab  customers={customers} onAnalyze={handleSend} t={t} isOnline={isOnline} />}
          {tab==='ai'         && <AITab         isOnline={isOnline} messages={messages} chatLoading={chatLoading} onSend={handleSend} onClear={clearMessages} streamText={streamText} events={events} getSession={getSession} />}
          {tab==='operations' && (<OperationsTab events={events} connected={connected} getSession={getSession} onFilter={filter} />)}
          {tab==='health'     && <HealthTab     connStatus={connStatus} customersCount={customers.length} monthlyTrend={overviewData?.monthlyTrend??[]} t={t} healthData={healthData} />}
          {tab==='logs'       && <LogsTab       events={events} connected={connected} getSession={getSession} onFilter={filter} onClear={clearEvents} />}
          {tab==='settings'   && <SettingsTab   lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} notifs={notifs} setNotifs={setNotifs} t={t} />}         
        </div>
      </main>
    </div>
  );
}
