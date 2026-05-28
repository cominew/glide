// apps/dashboard/projection.ts
// ══════════════════════════════════════════════════════════
//   Projection · 本地意图处理器
//
//   ★ 此文件在 apps/dashboard/ 根目录
//   ★ ritual.ts 通过 import './projection' 引入
//   ★ 不是 projections/projection.ts（那是 React Dashboard 的 UI 层）
//
//   职责分工（铁律，不可混淆）：
//     本地处理 → 时间、天气（含城市解析）、气泡召唤、Dashboard、音乐、新闻、问候
//     后端处理 → 客户查询、销售数据、邮件草稿、知识库问答等
//     判断依据 → isBackendIntent() 导出供 ritual.ts 使用
// ══════════════════════════════════════════════════════════

import { manifestationPool, mergeAllBubbles } from './manifestation';
import { field, EventSeed } from './field';


// 🌌 本地天气虚拟技能处理引擎
async function localWeatherSkill(text: string): Promise<boolean> {
  const t = text.toLowerCase();
  let city = 'Shenzhen';
  if (t.includes('shanghai') || t.includes('上海')) city = 'Shanghai';
  if (t.includes('beijing') || t.includes('北京')) city = 'Beijing';
  if (t.includes('iran') || t.includes('show')) city = 'Show, Iran';

  // 模拟气象频段的波长采集
  const mockWeatherResult = {
    city: city,
    temp: city.includes('Iran') ? '18°C' : '26°C',
    humidity: '42%',
    condition: 'Partly Cloudy',
    confidence: 0.95
  };

  console.log(`[Local Skill Field] 天气波长共振成功 [${city}]，抛出碎片`);
  
  // 核心改动：不再本地打断回话，而是发出标准 skill.output
  field.emit('skill.output', {
    skill: 'local.weather',
    fragments: [{
      name: 'weather.data',
      value: mockWeatherResult
    }]
  }, 'local_skill_weather');

  return true;
}

// 🎵 本地音乐技能处理引擎
function localMusicSkill(): boolean {
  field.emit('skill.output', {
    skill: 'local.music',
    fragments: [{
      name: 'music.data',
      value: { status: 'playing', track: 'Crystal Ball.mp3', volume: 0.7 }
    }]
  }, 'local_skill_music');
  return true;
}

// 修改原有的 handleUserUtterance 或者拦截入口
export async function handleLocalIntentsThroughField(text: string): Promise<boolean> {
  const t = text.toLowerCase();

  if (t.includes('weather') || t.includes('天气')) {
    await localWeatherSkill(text);
    return true; // 拦截成功，交由投影路由异步显形
  }

  if (t.includes('music') || t.includes('play') || t.includes('音乐')) {
    localMusicSkill();
    return true; 
  }

  return false; 
}

export function handleUserUtterance(text: string) {
  const t = text.toLowerCase();

  // 1. 战略意图种子拦截
  if (t.includes('japan') || t.includes('日本市场')) {
    const japanMarketSeed: EventSeed = {
      id: `intent_japan_${Date.now()}`,
      type: "strategic_intent",
      tags: ["JapanMarket", "sales_expansion", "risk_evaluation", "currency_jpy"],
      weight: 0.9,
      timestamp: Date.now(),
      payload: { query: text, aspect: "三策推演" }
    };
    field.emit('reality.seed.inject', japanMarketSeed, 'projection');
    return true;
  }

  // 2. CRM 客户相关拦截（涵盖 Adam Davis profile）
  if (t.includes('adam') || t.includes('customer') || t.includes('profile')) {
    const customerSeed: EventSeed = {
      id: `customer_adam_${Date.now()}`,
      type: "customer_deliberation",
      tags: ["AdamGreen", "AdamDavis", "sales", "profile"],
      weight: 0.95,
      timestamp: Date.now(),
      payload: { trace: "CRM 行为碎片聚合分析: " + text }
    };
    field.emit('reality.seed.inject', customerSeed, 'projection');
    // 注意：这里可以 return false 允许它继续走 SSE 后端获取更详尽的 profile 数据，
    // 或者 return true 让本地迅速完成气泡坍缩孵化。我们选择返回 false 让后端的高质量片段也能进来更新
    return false; 
  }

  return false; 
}

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────
function hit(t: string, kw: string[]) { return kw.some(k => t.includes(k)); }
function reply(text: string) { field.emit('pet.reply.message', { text }, 'projection'); }

// ─────────────────────────────────────────────
// 城市坐标表（无需 API，覆盖常用城市）
// ─────────────────────────────────────────────
const CITIES: Record<string, [number, number, string]> = {
  // 中国
  shenzhen: [22.54, 114.06, 'Shenzhen 🇨🇳'],
  深圳: [22.54, 114.06, '深圳 🇨🇳'],
  guangzhou: [23.13, 113.27, 'Guangzhou 🇨🇳'],
  广州: [23.13, 113.27, '广州 🇨🇳'],
  beijing: [39.91, 116.39, 'Beijing 🇨🇳'],
  北京: [39.91, 116.39, '北京 🇨🇳'],
  shanghai: [31.23, 121.47, 'Shanghai 🇨🇳'],
  上海: [31.23, 121.47, '上海 🇨🇳'],
  chengdu: [30.57, 104.07, 'Chengdu 🇨🇳'],
  成都: [30.57, 104.07, '成都 🇨🇳'],
  hangzhou: [30.25, 120.17, 'Hangzhou 🇨🇳'],
  杭州: [30.25, 120.17, '杭州 🇨🇳'],
  wuhan: [30.59, 114.31, 'Wuhan 🇨🇳'],
  武汉: [30.59, 114.31, '武汉 🇨🇳'],
  'hong kong': [22.32, 114.17, 'Hong Kong 🇭🇰'],
  香港: [22.32, 114.17, 'Hong Kong 🇭🇰'],
  taipei: [25.05, 121.53, 'Taipei 🇹🇼'],
  台北: [25.05, 121.53, 'Taipei 🇹🇼'],
  // 东南亚 / 东亚
  singapore: [1.35, 103.82, 'Singapore 🇸🇬'],
  tokyo: [35.68, 139.69, 'Tokyo 🇯🇵'],
  东京: [35.68, 139.69, '东京 🇯🇵'],
  seoul: [37.57, 126.98, 'Seoul 🇰🇷'],
  bangkok: [13.76, 100.50, 'Bangkok 🇹🇭'],
  dubai: [25.2, 55.27, 'Dubai 🇦🇪'],
  // 欧洲
  london: [51.51, -0.13, 'London 🇬🇧'],
  berlin: [52.52, 13.41, 'Berlin 🇩🇪'],
  paris: [48.85, 2.35, 'Paris 🇫🇷'],
  amsterdam: [52.37, 4.9, 'Amsterdam 🇳🇱'],
  zurich: [47.38, 8.54, 'Zurich 🇨🇭'],
  // 美洲
  'new york': [40.71, -74.01, 'New York 🇺🇸'],
  'los angeles': [34.05, -118.24, 'Los Angeles 🇺🇸'],
  'san francisco': [37.77, -122.42, 'San Francisco 🇺🇸'],
  seattle: [47.61, -122.33, 'Seattle 🇺🇸'],
  toronto: [43.65, -79.38, 'Toronto 🇨🇦'],
  sydney: [-33.87, 151.21, 'Sydney 🇦🇺'],
};

// WMO 天气代码
const WMO: Record<string, [string, string]> = {
  '0': ['☀️', 'Clear sky'],
  '1': ['🌤', 'Mainly clear'],
  '2': ['⛅', 'Partly cloudy'],
  '3': ['☁️', 'Overcast'],
  '45': ['🌫', 'Foggy'],
  '48': ['🌫', 'Icy fog'],
  '51': ['🌦', 'Light drizzle'],
  '53': ['🌦', 'Moderate drizzle'],
  '55': ['🌧', 'Heavy drizzle'],
  '61': ['🌧', 'Light rain'],
  '63': ['🌧', 'Moderate rain'],
  '65': ['🌧', 'Heavy rain'],
  '71': ['🌨', 'Light snow'],
  '73': ['❄️', 'Moderate snow'],
  '75': ['❄️', 'Heavy snow'],
  '80': ['🌦', 'Showers'],
  '81': ['🌧', 'Moderate showers'],
  '82': ['⛈', 'Violent showers'],
  '95': ['⛈', 'Thunderstorm'],
  '99': ['⛈', 'Thunder + hail'],
};

// ─────────────────────────────────────────────
// 从用户输入提取城市名
// ─────────────────────────────────────────────
function extractCity(text: string): string | null {
  const lower = text.toLowerCase().trim();
  // 先直接匹配城市表
  for (const key of Object.keys(CITIES)) {
    if (lower.includes(key)) return key;
  }
  // 英文模式：weather in/for X，X weather
  const pats = [
    /weather\s+(?:in|for|at|of)\s+([a-z][a-z\s]+)/i,
    /temperature\s+(?:in|for|at)\s+([a-z][a-z\s]+)/i,
    /([a-z][a-z\s]+?)\s+weather/i,
    /(?:天气|气温)\s*([\u4e00-\u9fa5]+)/,
    /([\u4e00-\u9fa5]+)\s*(?:天气|气温|几度|下雨)/,
  ];
  for (const p of pats) {
    const m = p.exec(text);
    if (m) {
      const c = m[1].trim().toLowerCase();
      if (c.length > 1 && !['the', 'a', 'an', 'is', 'are', 'today'].includes(c)) return c;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// 获取天气数据（精准锁定深圳 & 汉化输出）
// ─────────────────────────────────────────────
async function fetchWeather(hint: string | null): Promise<{ text: string; city: string }> {
  let lat: number, lon: number, city: string;

  // 核心修复：如果 hint 包含“深圳”或为空，绝对锁定深圳本地坐标，杜绝 Geocoding 乱飘
  if (!hint || hint.includes('深圳') || hint.toLowerCase().includes('shenzhen')) {
    [lat, lon, city] = CITIES.深圳;
  } else {
    const k = hint.toLowerCase().trim();
    if (CITIES[k]) {
      [lat, lon, city] = CITIES[k];
    } else {
      // 容错：如果用户输入了带“市”的中文，如“广州市”，去掉“市”再查一次表
      const keyWithoutCity = k.replace(/市$/, '');
      if (CITIES[keyWithoutCity]) {
        [lat, lon, city] = CITIES[keyWithoutCity];
      } else {
        // Open-Meteo geocoding 兜底
        try {
          const r = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(hint)}&count=1&language=en`
          ).then(r => r.json());
          if (r.results?.[0]) {
            lat = r.results[0].latitude;
            lon = r.results[0].longitude;
            city = `${r.results[0].name}${r.results[0].country ? ', ' + r.results[0].country : ''}`;
          } else {
            // 彻底兜底：找不到就回大本营深圳
            [lat, lon, city] = CITIES.深圳;
          }
        } catch {
          [lat, lon, city] = CITIES.深圳;
        }
      }
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,apparent_temperature,weathercode,relative_humidity_2m,windspeed_10m`
      + `&forecast_days=1&timezone=auto`;
    const data = await fetch(url).then(r => r.json());
    const cur = data.current ?? {};
    const temp = Math.round(cur.temperature_2m ?? 0);
    const feel = Math.round(cur.apparent_temperature ?? temp);
    const hum = cur.relative_humidity_2m ?? '–';
    const wind = Math.round(cur.windspeed_10m ?? 0);
    const [emoji, desc] = WMO[String(cur.weathercode ?? 0)] ?? ['🌡', 'Unknown'];
    
    // 增加更亲切的智能双语显示
    const isChina = city.includes('深圳') || city.includes('北京') || city.includes('上海') || city.includes('广州');
    const text = isChina 
      ? `${emoji} **${city}**: 当前气温 ${temp}°C (体感 ${feel}°C) · ${desc}\n💧 湿度 ${hum}% · 💨 风速 ${wind} km/h`
      : `${emoji} **${city}**: ${temp}°C (feels ${feel}°C) · ${desc}\n💧 Humidity ${hum}% · 💨 Wind ${wind} km/h`;
      
    return { text, city };
  } catch {
    return { text: `⚠️ 暂未获取到 ${city} 的即时天气数据。`, city };
  }
}

// ─────────────────────────────────────────────
// 新闻抓取（Hacker News RSS via rss2json）
// ─────────────────────────────────────────────

async function fetchNews(): Promise<{ title: string; url: string }[]> {
  try {
    const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://news.ycombinator.com/rss');
    const data = await res.json();
    return data.items.slice(0, 5).map((item: any) => ({ title: item.title, url: item.link }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// 所有业务气泡的定义（取代 Dashboard）
// ─────────────────────────────────────────────
const BUSINESS_BUBBLES = [
  {
  id: 'news',
  icon: '📰',
  title: 'AI News',
  description: 'Latest AI & tech news',
  semanticTags: ['news'],
  dynamicContent: true,
},
  {
    id: 'client',
    icon: '👥',
    title: 'Customer',
    description: 'View customer profile and orders',
    semanticTags: ['customer'],
    dynamicContent: true, // 内容由 client.update 动态更新
  },
  {
    id: 'sales',
    icon: '📊',
    title: 'Sales',
    description: 'Monthly revenue and product breakdown',
    semanticTags: ['sales'],
    dynamicContent: true,
  },
  {
    id: 'knowledge',
    icon: '📚',
    title: 'Knowledge',
    description: 'Retrieved information',
    semanticTags: ['knowledge'],
    dynamicContent: true,
  },
  {
    id: 'agenda',
    icon: '📅',
    title: 'Agenda',
    description: 'Schedule and tasks',
    semanticTags: ['agenda'],
    content: () => buildAgendaContent(),
  },
  {
    id: 'authority',
    icon: '⚖️',
    title: 'Authority Queue',
    description: 'Pending approvals',
    semanticTags: ['approval'],
    content: () => buildAuthorityContent(),
  },
  {
    id: 'reflection',
    icon: '🪞',
    title: 'Reflection',
    description: 'System cognition & anomalies',
    semanticTags: ['reflection'],
    content: () => buildReflectionContent(),
  },
  {
    id: 'system-health',
    icon: '💚',
    title: 'System Health',
    description: 'Component status',
    semanticTags: ['health'],
    content: () => buildHealthContent(),
  },
  {
    id: 'system-logs',
    icon: '📜',
    title: 'System Logs',
    description: 'Event stream',
    semanticTags: ['logs'],
    content: () => buildLogsContent(),
  },
  {
    id: 'data-streams',
    icon: '🌊',
    title: 'Data Streams',
    description: 'Real-time event flow',
    semanticTags: ['stream'],
    content: () => buildStreamsContent(),
  },
  {
    id: 'mind-surface',
    icon: '🧠',
    title: 'Mind Surface',
    description: 'Cognitive awareness',
    semanticTags: ['mind'],
    content: () => buildMindSurfaceContent(),
  },
  {
    id: 'skills',
    icon: '⚙️',
    title: 'Skills',
    description: 'Active capabilities',
    semanticTags: ['skill'],
    content: () => buildSkillsContent(),
  },
  {
    id: 'config',
    icon: '⚙️',
    title: 'Configuration',
    description: 'Knowledge sources, skills generation',
    semanticTags: ['config'],
    content: () => buildConfigContent(),
  },
  {
    id: 'time',
    icon: '🕐',
    title: 'Time & Calendar',
    description: 'Current local time and traditional calendar',
    semanticTags: ['time', 'calendar', 'clock'],
    content: () => {
      const el = document.createElement('div');
      el.style.padding = '14px';
      el.style.color = '#ffffff';
      el.style.minWidth = '180px';
      
      const updateTime = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
        const dateStr = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
        
        // 此处可以写死或接入简易农历算法，展示带有中国传统文化韵味的时辰
        el.innerHTML = `
          <div style="font-size: 26px; font-weight: bold; color: #60a5fa; font-family: monospace;">${timeStr}</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">${dateStr}</div>
          <div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">丙戌年 · 智能量场守护中 🐿️</div>
        `;
      };
      updateTime();
      setInterval(updateTime, 1000); // 每一秒场域自更新一次
      return el;
    }
  },
];

// 初始化所有业务气泡（预先 spawn，但初始为隐藏）
export function initBusinessBubbles() {
  for (const bubble of BUSINESS_BUBBLES) {
    field.emit('manifestation.spawn', {
      ...bubble,
      content: bubble.dynamicContent ? () => document.createElement('div') : bubble.content,
      bubbleLifeMs: 0, // 永不自动消隐（由用户显式关闭）
      expandedLifeMs: 0,
    });
  }
}

// ─────────────────────────────────────────────
// 气泡内容构建函数（静态内容，动态内容通过 update 事件）
// ─────────────────────────────────────────────
function buildAgendaContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Upcoming events</div><div class="mod-row">Loading agenda...</div></div>';
  // 可监听 agenda.update 事件动态填充
  return el;
}

function buildAuthorityContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Pending approvals</div><div class="mod-row">No pending items</div></div>';
  return el;
}

function buildReflectionContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">System reflections</div><div class="mod-row">Observing...</div></div>';
  return el;
}

function buildHealthContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Component status</div><div class="mod-row">All systems nominal</div></div>';
  return el;
}

function buildLogsContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Event logs</div><div class="mod-row">No recent logs</div></div>';
  return el;
}

function buildStreamsContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Real-time streams</div><div class="mod-row">Connected</div></div>';
  return el;
}

function buildMindSurfaceContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Cognitive state</div><div class="mod-row">Awake</div></div>';
  return el;
}

function buildSkillsContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="mod-section"><div class="mod-label">Active skills</div><div class="mod-row">Loading...</div></div>';
  return el;
}

function buildConfigContent(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="mod-section">
      <div class="mod-label">Knowledge Source</div>
      <div class="mod-row">Path: <span id="kb-path">/knowledge</span> <button class="mod-action-btn" id="change-kb">Change</button></div>
      <div class="mod-label">Rebuild RAG Index</div>
      <div class="mod-row"><button class="mod-action-btn" id="rebuild-rag">Rebuild</button></div>
      <div class="mod-label">Generate New Skill</div>
      <div class="mod-row"><input placeholder="Skill name" id="new-skill-name" /><button class="mod-action-btn" id="gen-skill">Generate</button></div>
    </div>`;
  setTimeout(() => {
    document.getElementById('change-kb')?.addEventListener('click', () => field.emit('config.changeKnowledgePath', {}));
    document.getElementById('rebuild-rag')?.addEventListener('click', () => field.emit('config.rebuildRAG', {}));
    document.getElementById('gen-skill')?.addEventListener('click', () => {
      const name = (document.getElementById('new-skill-name') as HTMLInputElement).value;
      if (name) field.emit('config.generateSkill', { name });
    });
  }, 100);
  return el;
}

// ─────────────────────────────────────────────
// 本地意图映射
// ─────────────────────────────────────────────
const BUBBLE_INTENTS: [string[], string][] = [
  [['client','customer','profile','客户'], 'client'],
  [['sales','revenue','销售','收入'], 'sales'],
  [['knowledge','document','知识','文档'], 'knowledge'],
  [['agenda','schedule','calendar','日程','日历'], 'agenda'],
  [['authority','approval','审批','权限'], 'authority'],
  [['reflection','reflect','反思','复盘'], 'reflection'],
  [['health','status','健康'], 'system-health'],
  [['logs','log','日志'], 'system-logs'],
  [['stream','streams','事件流'], 'data-streams'],
  [['mind','surface','conscious','意识场'], 'mind-surface'],
  [['skill','skills','能力'], 'skills'],
  [['config','configure','设置','配置'], 'config'],
  [['time', 'calendar', 'clock', '时间', '日历', '时钟', '几点'], 'time'],
];

function detectBubbleId(text: string): string | null {
  const t = text.toLowerCase();
  for (const [kws, id] of BUBBLE_INTENTS) {
    if (hit(t, kws)) return id;
  }
  return null;
}

// ─────────────────────────────────────────────
// 气泡 ID 映射
// ─────────────────────────────────────────────
const BUBBLE_MAP: [string[], string][] = [
  [['music', 'song', 'listen', 'play music', '音乐', '听歌'], 'music'],
  [['mail', 'email', 'inbox', '邮件', '收件'], 'mail'],
  [['agenda', 'calendar', 'schedule', 'meeting', '日程', '日历', '会议'], 'agenda'],
  [['weather', '天气'], 'weather'],
  [['crm', '客户管理'], 'crm'],
  [['news', 'headlines', '新闻'], 'news'],
  [['approval', 'approve', '审批', '待批'], 'approval'],
  [['reflection', 'reflect', '复盘', '回顾'], 'reflection'],
  [
    ['debug', 'dashboard', 'monitor', 'ops', 'mind surface', 'authority', 'logs', 'stream', 'health', '面板', '控制台', '调试'],
    'dashboard',
  ],
];

function detectBubble(t: string): string | null {
  for (const [kws, id] of BUBBLE_MAP) {
    if (hit(t, kws)) return id;
  }
  return null;
}

// ─────────────────────────────────────────────
// 后端意图清单（交给后端 skill，本地不处理）
// ─────────────────────────────────────────────
const BACKEND_PATTERNS = [
  'show me',
  'find client',
  'find customer',
  'client called',
  'customer called',
  'who is',
  'tell me about',
  'full profile',
  'recent activities',
  'sales report',
  'revenue',
  'monthly report',
  'sales revenue',
  'draft email',
  'write email',
  'send email',
  'do we have',
  'how many',
  'list all',
  'what happened',
  'customers from',
  'clients from',
  'orders for',
];

export function isBackendIntent(text: string): boolean {
  const t = text.toLowerCase();
  return BACKEND_PATTERNS.some(p => t.includes(p));
}

// ─────────────────────────────────────────────
// 小蜜能力介绍（首次唤醒 + "help" 指令）
// ─────────────────────────────────────────────
const INTRO = `Hi! I'm your little sugar glider 🐿✨

**⚡ Instant (local):**
🌤 Weather  — "weather in Shenzhen" / "深圳天气"
🕐 Time     — "what time is it"
🎵 Music    — "play music"
📬 Mail     — "show mail"
📅 Agenda   — "show agenda"
👥 CRM      — "show clients"
📡 News     — "show news"
✅ Approvals— "show approvals"
🪞 Reflect  — "show reflection"
🖥 Dashboard— "open dashboard" / "debug"

**🧠 Backend AI (smarter):**
🔍 "show me Adam Davis full profile"
📊 "sales report 2026-03"
✉️  "draft email to Adam Green"
❓  "do we have clients from LA?"

Just ask — I'll route it! ✨`;

// ─────────────────────────────────────────────
// 动态内容更新（从后端事件）
// ─────────────────────────────────────────────
// apps/dashboard/projection.ts

// apps/dashboard/projection.ts

export function setupDynamicUpdates() {
  
  // 1. 客户更新
  field.observe('client.update', (e) => {
    // 强制先让气泡在池子里准备好
    field.emit('manifestation.request', { id: 'client', level: 'full' });
    
    setTimeout(() => {
      const bubble = manifestationPool.get('client');
      if (bubble) {
        // 🟢 绝招：如果气泡节点不在 DOM 树里，强行挂载到全屏图层中
        if (!bubble.el.isConnected) {
          document.getElementById('field-layer')?.appendChild(bubble.el);
        }
        bubble.expand();
      }
    }, 50);
  });

  // 2. 知识库（产品 Astrion 核心卡片）更新
  field.observe('knowledge.update', (e) => {
  field.emit('manifestation.request', { id: 'knowledge', level: 'full' });
  setTimeout(() => {
    const bubble = manifestationPool.get('knowledge');
    if (bubble) {
      if (!bubble.el.isConnected) document.getElementById('field-layer')?.appendChild(bubble.el);
      bubble.expand();
    }
  }, 50);
});

field.observe('news.update', (e) => {
  const bubble = manifestationPool.get('news');
  if (bubble) {
    bubble.updateContent(() => buildNewsContent(e.payload.articles));
    bubble.expand();
  }
});

}

// ─────────────────────────────────────────────
// 主监听器
// ─────────────────────────────────────────────
export function initLocalIntentHandler() {
  field.observe('chat.user.message', async (event) => {
    const text: string = (event.payload as any)?.text ?? '';
    const source: string = (event.payload as any)?.source ?? '';
    if (!text.trim()) return;

    if (source === 'auto-intro') {
      reply(INTRO);
      return;
    }

    const t = text.toLowerCase();

    // ── 1. 问候语 ──────────────────────────
    if (hit(t, ['hi', 'hello', 'hey', 'how are you', 'how\'s it going', 'what\'s up', '你好', '嗨'])) {
      reply("Hey there! I'm your sugar glider 🐿️. Need help? Just ask or say 'what can you do' for a full list.");
      return;
    }

    if (hit(t, ['what\'s your name', 'your name', 'what is your name'])) {
      reply("I'm your little sugar glider 🐿️, you can call me Glide! Need any help?");
      return;
    }

    // ── 2. 能力介绍 ──────────────────────────
    if (hit(t, ['what can you do', 'help me', 'how can you help', 'capabilities', 'introduce yourself', 'who are you', '你能做什么', '你会什么', '介绍一下'])) {
      reply(INTRO);
      return;
    }

    // ── 3. 新闻气泡 ──────────────────────────
    if (hit(t, ['news', 'headlines', '最新动态', '科技新闻'])) {
      field.emit('manifestation.request', { id: 'news', level: 'full' });
      reply('Fetching latest AI news...');
      fetchNews().then(articles => field.emit('news.update', { articles }));
      return;
    }

    // ── 4. 日程气泡 ──────────────────────────
    if (hit(t, ['agenda', 'schedule', '日历', '日程'])) {
      field.emit('manifestation.request', { id: 'agenda', level: 'full' });
      reply('Opening agenda...');
      return;
    }

    // ── 5. 客户数据气泡 ──────────────────────
    if (hit(t, ['client', 'customer', '客户'])) {
      field.emit('manifestation.request', { id: 'client', level: 'full' });
      reply('Fetching client data...');
      return;
    }

    // ── 6. 销售报告气泡 ──────────────────────
    if (hit(t, ['sales', 'revenue', '销售', '收入'])) {
      field.emit('manifestation.request', { id: 'sales', level: 'full' });
      reply('Sales report...');
      return;
    }

    // ── 7. 反思/认知气泡 ─────────────────────
    if (hit(t, ['reflection', 'reflect', '反思', '复盘'])) {
      field.emit('manifestation.request', { id: 'reflection', level: 'full' });
      reply('Reflection panel opened.');
      return;
    }

    // ── 8. 权限队列气泡 ──────────────────────
    if (hit(t, ['authority', 'approval', '审批', '权限'])) {
      field.emit('manifestation.request', { id: 'authority', level: 'full' });
      reply('Authority queue opened.');
      return;
    }

    // ── 9. 音乐控制（必须在后端意图之前）──────
    if (hit(t, ['play music', '播放音乐', '开始播放'])) {
      field.emit('manifestation.request', { id: 'music', level: 'full' });
      field.emit('music.toggle', { source: 'voice' });
      reply('▶️ Resuming music...');
      return;
    }
    if (hit(t, ['pause music', '暂停音乐', '暂停播放', '停止播放'])) {
      field.emit('music.toggle', { source: 'voice' });
      reply('⏸ Paused.');
      return;
    }
    if (hit(t, ['下一首', 'next song', '切歌', '下一曲', 'next'])) {
      field.emit('music.next', { source: 'voice' });
      reply('⏭ Switching to next track...');
      return;
    }
    if (hit(t, ['上一首', 'previous song', '上一曲', 'previous'])) {
      field.emit('music.prev', { source: 'voice' });
      reply('⏮ Playing previous track...');
      return;
    }

  // ── 10. 时间 ────────────────
    if (hit(t, ['time', 'what time', 'clock', '几点', '现在几点', 'current time', '时间', '日历'])) {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      // 核心向场域发出 request 唤起上面定义的 time 气泡
      field.emit('manifestation.request', { id: 'time', level: 'full' });
      reply(`🕐 当前时间是 ${time}，已为你调出实时时钟气泡。`);
      return;
    }

    // ── 11. 天气 ──────────────────────────────
    if (hit(t, ['weather', 'temperature', 'forecast', '天气', '气温', '几度', '下雨', '冷', '热'])) {
      const hint = extractCity(text);
      reply(hint ? `Checking weather for **${hint}**… ☁️` : 'Checking live weather… ☁️');
      const result = await fetchWeather(hint);
      reply(result.text);
      field.emit('weather.update', result);
      field.emit('manifestation.request', { id: 'weather', level: 'full' });
      return;
    }

    // ── 12. Dashboard / Debug ─────────────────
    if (hit(t, ['dashboard', 'debug', 'monitor', 'ops', 'mind surface', 'authority', 'logs', 'stream', 'health', '控制台', '调试', '面板'])) {
      field.emit('dashboard.open', { trigger: 'user-intent' });
      window.dispatchEvent(new CustomEvent('glide:open-dashboard'));
      reply('Opening Dashboard 🖥');
      return;
    }

    // ── 13. 气泡召唤（show/open + 模块名）────
    const bubbleId = detectBubbleId(text);
    if (bubbleId) {
      field.emit('manifestation.request', { id: bubbleId, level: 'full' });
      reply(`✨ Opening ${bubbleId} bubble...`);
      return;
    }
    
    const showMatch = /(?:show|open|display|see|view|召唤|打开|查看)\s+(.+)/i.exec(text);
    if (showMatch) {
      const id = detectBubble(showMatch[1].toLowerCase());
      if (id === 'dashboard') {
        field.emit('dashboard.open', { trigger: 'user-intent' });
        window.dispatchEvent(new CustomEvent('glide:open-dashboard'));
        reply('Opening Dashboard! 🖥');
        return;
      }
      if (id) {
        field.emit('manifestation.request', { id, level: 'full' });
        reply(`✨ ${id.charAt(0).toUpperCase() + id.slice(1)} opened!`);
        return;
      }
    }

    // ── 14. 音乐播放（旧式，直接播放本地文件）──
    if (hit(t, ['music', 'play', 'song', 'listen', '音乐', '听歌', '播放'])) {
      try {
        const audio = new Audio('/music/Crystal Ball.mp3');
        audio.volume = 0.7;
        await audio.play();
        field.emit('manifestation.request', { id: 'music', level: 'full' });
        reply('🎵 Music playing — bubble opened!');
      } catch {
        reply('Can\'t find music file.');
      }
      return;
    }

    // ── 15. 融合示例 ─────────────────────────
    if (hit(t, ['merge music and weather', 'combine bubbles', '融合', '合并气泡'])) {
      field.emit('manifestation.mergeRequest', { ids: ['music', 'weather'] });
      reply('Merging bubbles... 🫧');
      return;
    }

    // ── 16. 休息 ──────────────────────────────
    if (hit(t, ['rest', 'sleep', 'bye', 'goodbye', 'night', '休息', '晚安', '再见', '拜拜'])) {
      setTimeout(() => window.dispatchEvent(new Event('pet:sleep')), 1200);
      reply('Alright, taking a nap~ Call me anytime (˘ω˘)zzZ');
      return;
    }

    if (hit(t, ['show all bubbles', 'show all', '显示所有气泡', '全部显示'])) {
      field.emit('field.bubbles.show', {});
      reply('✨ All bubbles are now visible!');
      return;
    }

    if (hit(t, ['merge all bubbles', 'merge all', '合并所有气泡', '全部合并'])) {
      mergeAllBubbles();
      reply('🫧 Merging all visible bubbles into one composite view...');
      return;
    }

    // ── 新增：隐藏/关闭所有气泡命令（彻底解决隐藏失效 Bug） ────────────────
    if (hit(t, ['hide all bubbles', 'hide all', 'close all', 'hidden', '隐藏所有气泡', '关闭所有气泡', '全部隐藏', '隐藏气泡', '收起气泡'])) {
      // 从 manifestationPool 获取所有存活气泡，通知它们执行退场/隐入奇点动画
      manifestationPool.all().forEach(m => {
  if (typeof (m as any).vanish === 'function') (m as any).vanish();
  else m.el.classList.add('hidden'); // fallback
      });
      reply('✨ 收到，已将所有可见气泡隐藏，让认知界面回归纯净。');
      return;
    }

    // ── 17. 后端意图检查（必须放在所有本地处理之后）──
    if (isBackendIntent(t)) return;

    // ── 18. 无法处理 → 转后端 ────────────────
    reply('Checking with backend AI… 🤔');
  });
}

function buildNewsContent(articles: { title: string; url: string }[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mod-section';
  el.style.padding = '14px';
  if (!articles.length) {
    el.innerHTML = '<div>No news available.</div>';
    return el;
  }
  el.innerHTML = `
  <div class="mod-label">📡 Hacker News Top 5</div>
  <div style="display:flex;flex-direction:column;gap:6px;">
  ${articles.map(article => `
    <div class="mod-row news-item" data-url="${article.url}" style="cursor:pointer;">
    <span class="mod-row-icon">📌</span>
    <div class="mod-row-text">${article.title}</div>
    </div>
    `).join('')}
    </div>
    <div class="mod-label" style="margin-top:12px;">Click any story to open in browser</div>
    `;
  
    // 事件委托
  el.querySelectorAll('.news-item').forEach(row => {
    row.addEventListener('click', (e) => {
      const url = row.getAttribute('data-url');
      if (url) window.open(url, '_blank');
    });
  });
  return el;
}
