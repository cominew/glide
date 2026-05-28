// apps/dashboard/ritual.ts
// Guide · 小蜜袋鼯 · Conscious Observer

import { listen }           from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke }           from '@tauri-apps/api/core';
import { field, ProjectionInstruction } from './field';
import { mountDrag, mountResize, Manifestation, manifestationPool } from './manifestation';
import { api }              from './gateways/api';
import { CHAT_SESSION_ID }  from './observers/useChat';

import { initLocalIntentHandler, isBackendIntent, initBusinessBubbles, setupDynamicUpdates } from './projection';

// 🎨 投影路由器：根据后端片段特征计算坍缩显像指令
function routeProjection(fragment: any): ProjectionInstruction | null {
  if (!fragment) return null;
  
  const name = fragment.name;
  const value = fragment.value || fragment;

  // 如果后端片段本身已经具备高维投影指令，直接信任并采纳
  if (fragment.projection) {
    return { ...fragment.projection, payload: value };
  }

  // 基础映射表：从低维数据名称向高维认知奇点坍缩
const MAP: Record<string, Omit<ProjectionInstruction, 'priority' | 'payload'>> = {
  'profile.data':         { id: 'client',    action: 'update', level: 'expanded' },
  'monthly_report':       { id: 'sales',     action: 'update', level: 'expanded' },
  'knowledge_answer':     { id: 'knowledge', action: 'update', level: 'expanded' },
  'weather.data':         { id: 'weather',   action: 'update', level: 'expanded' },
  'time.data':            { id: 'time',      action: 'update', level: 'bubble' },
  'music.data':           { id: 'music',     action: 'update', level: 'expanded' },
  'agenda.data':          { id: 'agenda',    action: 'update', level: 'expanded' },
  'reflection.data':      { id: 'reflection',action: 'update', level: 'expanded' },
};

  const base = MAP[name];
  if (!base) return null;

  // 动态计算能量权重（优先级）
  let priority = 0.5;
  if (value?.confidence) priority = value.confidence;
  if (value?.urgency) priority = Math.max(priority, value.urgency);

  return { ...base, priority, payload: value };
}

// ─────────────────────────────────────────────
// 热区上报（告诉 Rust 哪些区域需要接收鼠标事件）
// ─────────────────────────────────────────────
interface HitZone { x:number; y:number; w:number; h:number; }
let _hitZones: HitZone[] = [];
let _hitZoneTimer: ReturnType<typeof setTimeout> | null = null;

function reportHitZones() {
  if (_hitZoneTimer) clearTimeout(_hitZoneTimer);
  _hitZoneTimer = setTimeout(async () => {
    try {
      await invoke('update_hit_zones', { zones: _hitZones });
    } catch {}
  }, 16); // 防抖 16ms
}

export function addHitZone(id: string, el: HTMLElement) {
  removeHitZone(id);
  const r = el.getBoundingClientRect();
  _hitZones.push({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
  reportHitZones();
}

export function removeHitZone(id: string) {
  void id;
  refreshAllHitZones();
}

(window as any).refreshAllHitZones = refreshAllHitZones;

export function refreshAllHitZones() {
  _hitZones = [];
  // Guide 窗口
  const gw = document.getElementById('guide-window');
  if (gw && gw.classList.contains('visible')) {
    const r = gw.getBoundingClientRect();
    _hitZones.push({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
  }
  // 聊天框
  const cp = document.getElementById('chat-panel');
  if (cp && cp.classList.contains('open')) {
    const r = cp.getBoundingClientRect();
    _hitZones.push({ x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 });
  }
  
  // ✨ 修复关键点 2：这里选择器同时包容经典气泡与新版的流体气泡
  document.querySelectorAll<HTMLElement>('.manifestation:not(.hidden), .glide-reality-bubble').forEach(el => {
    const r = el.getBoundingClientRect();
    _hitZones.push({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
  });
  reportHitZones();
}


// ─────────────────────────────────────────────
// 状态（全部是运行时坍缩，不持久）
// ─────────────────────────────────────────────
let appWin:      ReturnType<typeof getCurrentWindow>;
let guideWindow: HTMLElement;
let guideSprite: HTMLElement;
let ritualLayer: HTMLElement;
let ritualVideo: HTMLVideoElement;
let chatPanel:   HTMLElement;
let chatHeader:  HTMLElement;
let chatMsgs:    HTMLElement;
let chatInput:   HTMLInputElement;
let chatSend:    HTMLButtonElement;
let chatX:       HTMLButtonElement;
let typingEl:    HTMLElement;
let starCanvas:  HTMLCanvasElement;

let currentScopeId: string | null = null;
let eventSource:    EventSource | null = null;
let initialized     = false;

type GuideAnim = 'g-sleep'|'g-doze'|'g-awake'|'g-thinking'
               |'g-happy'|'g-glide'|'g-close'|'g-vanish';
const ALL_G: GuideAnim[] = [
  'g-sleep','g-doze','g-awake','g-thinking','g-happy','g-glide','g-close','g-vanish',
];

type PetVis = 'hidden'|'floating'|'vanished';
let petVis:          PetVis  = 'hidden';
let chatOpen         = false;
let hasRitualPlayed  = false;
let isFirstWake      = true;
let chatDetached     = false;
let idleTimer:  ReturnType<typeof setTimeout> | null = null;
let yawnTimer:  ReturnType<typeof setTimeout> | null = null;

// ─────────────────────────────────────────────
// 穿透管理
// ─────────────────────────────────────────────
let hoverCount = 0;

// 穿透由 Rust 层通过热区轮询控制，前端不再直接调用 setIgnoreCursorEvents
// 前端只需要在元素位置变化时调用 refreshAllHitZones()
// 统一入口：初始化后立即上报一次，之后各状态变化时触发

// ─────────────────────────────────────────────
// 星尘
// ─────────────────────────────────────────────
interface Star { x:number;y:number;r:number;vx:number;vy:number;a:number;da:number; }

function initStars(cv: HTMLCanvasElement) {
  const S = cv.offsetWidth || 100;
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const stars: Star[] = Array.from({length:36}, () => ({
    x:Math.random()*S, y:Math.random()*S,
    r:Math.random()*1.1+.2,
    vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.15,
    a:Math.random(), da:Math.random()>.5?1:-1,
  }));
  function shooter() {
    const x0=Math.random()*S, y0=Math.random()*(S*.4),
          len=15+Math.random()*13, ang=Math.PI/6+Math.random()*Math.PI/7;
    let t=0;
    (function draw(){
      if(t>1){setTimeout(shooter,5000+Math.random()*9000);return;}
      const x1=x0+Math.cos(ang)*len*t,y1=y0+Math.sin(ang)*len*t,
            x2=x0+Math.cos(ang)*len*(t-.3),y2=y0+Math.sin(ang)*len*(t-.3);
      const g=ctx.createLinearGradient(x2,y2,x1,y1);
      g.addColorStop(0,'rgba(180,220,255,0)');
      g.addColorStop(1,`rgba(210,235,255,${.75*Math.sin(t*Math.PI)})`);
      ctx.strokeStyle=g; ctx.lineWidth=1.1;
      ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x1,y1);ctx.stroke();
      t+=.04;requestAnimationFrame(draw);
    })();
  }
  setTimeout(shooter,2000+Math.random()*3000);
  (function tick(){
    ctx.clearRect(0,0,S,S);
    for(const s of stars){
      s.x+=s.vx;s.y+=s.vy;s.a+=s.da*.007;
      if(s.a>=1){s.a=1;s.da=-1;}if(s.a<=0){s.a=0;s.da=1;}
      if(s.x<0)s.x=S;if(s.x>S)s.x=0;if(s.y<0)s.y=S;if(s.y>S)s.y=0;
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(165,212,255,${s.a*.55})`;ctx.fill();
    }
    requestAnimationFrame(tick);
  })();
}

// ─────────────────────────────────────────────
// 核心初始化
// ─────────────────────────────────────────────
async function init() {
  if (initialized) return;
  initialized = true;
  console.log('[Guide] init — pet mode');

  appWin = getCurrentWindow();

  guideWindow = document.getElementById('guide-window')!;
  guideSprite = document.getElementById('guide-sprite')!;
  ritualLayer = document.getElementById('ritual-layer')!;
  ritualVideo = document.getElementById('ritual-video') as HTMLVideoElement;
  chatPanel   = document.getElementById('chat-panel')!;
  chatHeader  = document.getElementById('chat-header')!;
  chatMsgs    = document.getElementById('chat-msgs')!;
  chatInput   = document.getElementById('chat-input') as HTMLInputElement;
  chatSend    = document.getElementById('chat-send') as HTMLButtonElement;
  chatX       = document.getElementById('chat-x') as HTMLButtonElement;
  typingEl    = document.getElementById('typing')!;
  starCanvas  = document.getElementById('star-canvas') as HTMLCanvasElement;

  if (!guideWindow) {
    console.error('[Guide] DOM not found');
    return;
  }

  // 热区由 Rust 轮询控制穿透，前端只需上报位置变化
  refreshAllHitZones();
  (window as any).__glide_refreshHitZones = refreshAllHitZones;

  ritualVideo.src = '/ritual/glide-entrance.mp4';
  initStars(starCanvas);
  initLocalIntentHandler();

  mountDrag({ el: guideWindow, onDragEnd: () => { if (!chatDetached && chatOpen) positionChatPanel(); } });
  mountDrag({ el: chatPanel, handle: chatHeader, onDragStart: () => { chatDetached = true; } });

  const chatResizeHandle = document.createElement('div');
  chatResizeHandle.className = 'chat-resize-handle';
  chatPanel.appendChild(chatResizeHandle);
  mountResize(chatPanel, chatResizeHandle);

  const win = await appWin;
  await win.onFocusChanged((e:{payload:boolean}) => { if (!e.payload) onBlur(); });
  await listen<string>('presence:shift', (e) => {
    console.log('[Guide] presence:shift →', e.payload);
    if (e.payload === 'arriving')   onHotkey();
    if (e.payload === 'dissolving') onBlur();
  });

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'chat-resize-handle';
  chatPanel.appendChild(resizeHandle);
  mountResize(chatPanel, resizeHandle);

  connectSSE();
  window.addEventListener('pet:sleep', () => onBlur());
  guideWindow.addEventListener('click', onGuideClick);
  guideWindow.addEventListener('mouseenter', () => { if(!chatOpen) guideSprite.classList.add('g-peek'); });
  guideWindow.addEventListener('mouseleave', () => { guideSprite.classList.remove('g-peek'); });
  chatX.addEventListener('click',    e => { e.stopPropagation(); closeChatPanel(); });
  chatSend.addEventListener('click',  handleSend);
  chatInput.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
  chatInput.addEventListener('input',   () => { clearYawnTimer(); resetIdleTimer(); });

  let attentionTimer: ReturnType<typeof setTimeout> | null = null;
function resetAttentionTimer() {
  if (attentionTimer) clearTimeout(attentionTimer);
  attentionTimer = setTimeout(() => {
    // 无交互且聊天未打开时，隐藏所有气泡（但不隐藏小蜜）
    if (!chatOpen) {
      manifestationPool.all().forEach((m: Manifestation) => {
        if (m.state !== 'hidden') m.vanish();
      });
    }
  }, 30_000);
}
// 监听任何鼠标移动或点击
window.addEventListener('mousemove', resetAttentionTimer);
window.addEventListener('click', resetAttentionTimer);
// 初始化时启动
resetAttentionTimer();

  // ══ 小蜜：全量意识场观察 ══
  field.observeAll(({ type, payload }) => {
    // 本地意图回复
    if (type === 'pet.reply.message') {
      const text = (payload as any)?.text;
      if (!text) return;
      typingEl.classList.remove('show');
      if (chatOpen) { appendMsg(text,'pet'); reactGuide('g-happy', 1400); }
      else { openChatPanel(); setTimeout(()=>appendMsg(text,'pet'),700); }
      return;
    }

// 后端答案（缘起：answer 是多个 skill 共振坍缩的结果）
if (['answer.ready','answer.manifested','answer.projected'].includes(type)) {
  const frags = (payload as any)?.fragments ?? [];
  
  // ========== 1. 打印调试信息 ==========
  console.log('[Answer] fragments:', frags.map((f: any) => ({
    name: f.name,
    unresolved: f.value?.unresolved,
    hasValue: !!f.value
  })));

  // ========== 2. 检测并自动弹出气泡（不依赖聊天框是否打开） ==========
  // 客户资料气泡
  const clientFragment = frags.find((f: any) => 
    f.name === 'profile.data' && f.value && f.value.unresolved !== true
  );
  if (clientFragment) {
    console.log('[Answer] Emitting client bubble');
    field.emit('manifestation.request', { id: 'client', level: 'full' });
    field.emit('client.update', clientFragment.value);
  }

  // 销售报告气泡
  const salesFragment = frags.find((f: any) => f.name === 'monthly_report' && f.value);
  if (salesFragment) {
    console.log('[Answer] Emitting sales bubble');
    field.emit('manifestation.request', { id: 'sales', level: 'full' });
    field.emit('sales.update', salesFragment.value);
  }

  // 知识答案气泡
  const knowledgeFragment = frags.find((f: any) => f.name === 'knowledge_answer' && f.value);
  if (knowledgeFragment) {
    console.log('[Answer] Emitting knowledge bubble');
    field.emit('manifestation.request', { id: 'knowledge', level: 'full' });
    field.emit('knowledge.update', { text: knowledgeFragment.value });
  }

  // ========== 3. 处理聊天框显示（原有逻辑） ==========
  const scope = (payload as any)?.scopeId || (payload as any)?.chainId || (payload as any)?.taskId;
  if (currentScopeId && scope && currentScopeId !== scope && currentScopeId !== '__any__') return;

  const text =
    frags.find((f: any) => f.name === 'persona.summary')?.value ||
    frags.find((f: any) => f.name === 'reasoning_result')?.value ||
    frags.find((f: any) => f.name === 'ai_response')?.value ||
    frags.find((f: any) => f.name === 'final.answer')?.value ||
    (payload as any)?.narrative;

  const profileFrag = frags.find((f: any) => f.name === 'profile.data');
  const reportFrag  = frags.find((f: any) => f.name === 'monthly_report');

  if (!chatOpen) return;
  typingEl.classList.remove('show');
  if (text) {
    appendMsg(text, 'pet');
  } else if (profileFrag && !profileFrag.value?.unresolved) {
    const v = profileFrag.value;
    appendMsg(`👤 **${v?.name}** · ${v?.country}\n💰 ${v?.totalRevenue ?? 0} · ${v?.orderCount ?? 0} orders`, 'pet');
  } else if (reportFrag) {
    const r = reportFrag.value;
    appendMsg(`📊 **${r?.month}**: $${(r?.totalRevenue ?? 0).toLocaleString()} · ${r?.totalOrders ?? 0} orders`, 'pet');
  }
  if (text || profileFrag || reportFrag) {
    currentScopeId = null;
    reactGuide('g-happy', 1400);
  }
  return;
}

    // skill.output（承：技能共振涌现）
if (type === 'skill.output') {
  const frags = (payload as any)?.fragments ?? [];
  const scope = (payload as any)?.scopeId || (payload as any)?.taskId;

  // 原有聊天框显示逻辑（保持不变）
  if (chatOpen) {
    const frag = frags.find((f:any)=>['knowledge_answer','monthly_report','customer_list'].includes(f.name));
    if (frag) {
      typingEl.classList.remove('show');
      appendMsg(typeof frag.value==='string' ? frag.value : JSON.stringify(frag.value,null,2).slice(0,500), 'pet');
      currentScopeId=null; reactGuide('g-happy',1400);
    }
  }

  // 🆕 投影路由器：将所有片段转换为投影指令
  for (const frag of frags) {
    const instruction = routeProjection(frag);
    if (!instruction) continue;
    console.log(`[Router] Fragment ${frag.name} → instruction`, instruction);
    field.emit('projection.instruction', instruction, 'projection_router');
  }

  return;
}

    // 异常（坏：因果链无法闭合）
    if (['query.failed','gateway.error','reality.anomaly.detected'].includes(type)) {
      if (chatOpen && currentScopeId) {
        typingEl.classList.remove('show');
        appendMsg("Hmm, couldn't get a clear answer. Try rephrasing? 🤔", 'pet');
        currentScopeId=null; reactGuide('g-sleep',2000);
      }
      return;
    }

    // Dashboard 打开（空：归寂后召唤别的世界）
    if (type === 'dashboard.open') {
      invoke('open_dashboard').catch(()=>window.dispatchEvent(new CustomEvent('glide:open-dashboard')));
      return;
    }

    // 新事件到达（起：场被扰动）
    if (['crm.lead.new','mail.new','approval.new','demo.event'].includes(type)) {
      if (petVis !== 'floating') reviveGuide();
      if (!chatOpen) {
        setGuide('g-awake');
        const msg = (payload as any)?.msg || (payload as any)?.title;
        if (msg) showToast(msg);
        setTimeout(() => { if (!chatOpen) setGuide('g-doze'); }, 2500);
      }
      return;
    }
  });

  initField();
  initBusinessBubbles();
  setupDynamicUpdates(); 
  registerMusicEvents();
  ensureFieldLayer();
  console.log('[Guide] ✅ ready');
}

function reactGuide(anim: GuideAnim, revertMs: number) {
  setGuide(anim);
  setTimeout(() => { if (chatOpen) clearSprite(); }, revertMs);
}

// 在初始化(init)或者 ready 的地方加上这一段确保容器可见
function ensureFieldLayer() {
  let layer = document.getElementById('field-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'field-layer';
    document.body.appendChild(layer);
  }
  
  layer.style.position = 'fixed';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.width = '100vw';
  layer.style.height = '100vh';
  layer.style.zIndex = '999999';
  layer.style.pointerEvents = 'none'; 
  layer.style.display = 'block';
  layer.style.opacity = '1';
  layer.classList.add('manifest');
}

type PresenceState = 'dormant' | 'arriving' | 'attentive' | 'projecting' | 'dissolving';

let currentPresence: PresenceState = 'dormant';
let transitionLock = false;

interface TransitionRequest {
  from: PresenceState;
  to: PresenceState;
  reason: string;
  authority: number; // 0-1，高 authority 可覆盖低
}

function requestPresenceTransition(req: TransitionRequest): boolean {
  if (transitionLock) return false;
  if (currentPresence !== req.from) return false;
  if (req.authority < 0.5 && currentPresence !== 'dormant') return false; // 低权威不可打断专注态

  transitionLock = true;
  console.log(`[Presence] ${req.from} → ${req.to} (${req.reason}, authority:${req.authority})`);
  executeTransition(req.to);
  setTimeout(() => { transitionLock = false; }, 200);
  return true;
}

function executeTransition(newState: PresenceState) {
  currentPresence = newState;
  switch (newState) {
    case 'arriving':
      guideWindow.classList.add('visible');
      setGuide('g-glide');
      break;
    case 'attentive':
      setGuide('g-awake');
      break;
    case 'dissolving':
      guideWindow.classList.remove('visible');
      closeChatPanel();
      setGuide('g-sleep');
      break;
  }
  field.emit('presence.changed', { state: newState });
}

// ─────────────────────────────────────────────
// initIfReady：无论 DOM readyState 如何都能工作
// ─────────────────────────────────────────────
function initIfReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}
initIfReady();

// ─────────────────────────────────────────────
// SSE → Field（事件流：起承转合）
// ─────────────────────────────────────────────
const SSE_NOISE = new Set([
  'system.clock.pulse','event.state_changed','event.archived',
  'event.ttl_expired','conscious.state.updated',
  'capability.observed','fragment.observed','resonance.observed',
  'awareness.disturbance','awareness.skill_arising',
]);

function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/events/stream');
  eventSource.onmessage = e => {
    try {
      const evt = JSON.parse(e.data);
      if (!SSE_NOISE.has(evt.type)) field.emit(evt.type, evt.payload ?? {}, 'sse');
    } catch {}
  };
  eventSource.onerror = () => setTimeout(connectSSE, 5000);
}

// ─────────────────────────────────────────────
// 热键（Ctrl+Shift+G）
// ─────────────────────────────────────────────
async function onHotkey() {
  if (!hasRitualPlayed) {
    await playEntrance();
    hasRitualPlayed = true;
    return;
  }
  // 请求切换：如果当前是 dormant/dissolving 则唤醒，否则隐藏
  const targetState = (currentPresence === 'dormant' || currentPresence === 'dissolving') ? 'arriving' : 'dissolving';
  const authority = (targetState === 'arriving') ? 1.0 : 0.9;
  const fromState = currentPresence;
  requestPresenceTransition({ from: fromState, to: targetState, reason: 'hotkey', authority });
}

function onGuideClick() {
  if (petVis==='vanished') { reviveGuide(); return; }
  if (!chatOpen) openChatPanel();
  else           closeChatPanel();
}

// ─────────────────────────────────────────────
// 入场仪式（起：从空寂中显现）
// ─────────────────────────────────────────────
async function playEntrance() {
  ritualLayer.classList.add('active');
  ritualLayer.style.display = 'block';
  // await setPassthrough(false);
  ritualVideo.currentTime = 0;
  ritualVideo.muted = false;
  const onEnd = () => afterEntrance();
  ritualVideo.addEventListener('ended', onEnd, { once:true });
  await ritualVideo.play().catch(() => { ritualVideo.removeEventListener('ended',onEnd); afterEntrance(); });
}

function afterEntrance() {
  ritualLayer.classList.remove('active');
  ritualLayer.style.display = 'none';

  placeGuideDefault();

  // 🟢 动画结束 → 现在才显示小蜜
  guideWindow.classList.add('visible');

  petVis = 'floating';
  setGuide('g-glide');

  setTimeout(() => {
    setGuide('g-doze');
    startIdleTimer();
  }, 1100);

  // 🟢 动画结束 → 现在才显示气泡
  setTimeout(() => {
    field.emit('field.bubbles.show', {});
  }, 2200);
}

// ─────────────────────────────────────────────
// 聊天面板
// ─────────────────────────────────────────────
function openChatPanel() {
  chatOpen=true; chatDetached=false;
  clearIdleTimer(); clearYawnTimer();
  if (isFirstWake) {
    isFirstWake=false; playWakeVoice();
    setGuide('g-glide');
    setTimeout(()=>setGuide('g-close'), 820);
    setTimeout(()=>{
      setGuide('g-awake'); _showChatDOM();
      setTimeout(()=>appendMsg("Hmm? You called? (｡•̀ᴗ-)✧",'pet'), 380);
      setTimeout(()=>field.emit('chat.user.message',{text:'what can you do',source:'auto-intro'}), 900);
    }, 1500);
  } else {
    playWakeVoice(); setGuide('g-awake');
    setTimeout(()=>{
      if(chatOpen){
        clearSprite();
        guideSprite.style.backgroundImage="url('/pets/pet_awake.png')";
        guideSprite.style.backgroundSize='70%';
        guideSprite.style.filter='drop-shadow(0 0 16px rgba(130,210,255,.72))';
      }
    }, 750);
    _showChatDOM();
  }
  scheduleYawn(); resetIdleTimer();
}

function _showChatDOM() {
  positionChatPanel();
  setTimeout(()=>{ chatPanel.classList.add('open'); chatInput.focus(); }, 330);
}

function closeChatPanel() {
  if(!chatOpen) return;
  chatOpen=false; chatPanel.classList.remove('open');
  currentScopeId=null; clearSprite(); setGuide('g-doze'); startIdleTimer();
}

function positionChatPanel() {
  if(chatDetached) return;
  const r=guideWindow.getBoundingClientRect(), W=310;
  let l=r.left+r.width/2-W/2;
  l=Math.min(window.innerWidth-W-10,Math.max(10,l));
  chatPanel.style.cssText=`left:${l}px;top:${Math.max(10,r.top-400)}px;right:auto;bottom:auto;`;
}

// ─────────────────────────────────────────────
// Guide 显示状态
// ─────────────────────────────────────────────
function placeGuideDefault() {
  const w=guideWindow.offsetWidth||100, h=guideWindow.offsetHeight||100;
  guideWindow.style.cssText=`left:${window.innerWidth-w-40}px;top:${window.innerHeight-h-40}px;right:auto;bottom:auto;`;
}

function hideGuide() {
  petVis='hidden'; setGuide('g-vanish');
  setTimeout(()=>{ guideWindow.classList.remove('visible'); clearSprite(); }, 1600);
}

function reviveGuide() {
  petVis='floating';
  if(!guideWindow.style.left) placeGuideDefault();
  guideWindow.classList.add('visible');
  setGuide('g-glide');
  setTimeout(()=>{ setGuide('g-doze'); startIdleTimer(); }, 1000);
}

function onBlur() { closeChatPanel(); setGuide('g-sleep'); }

function setGuide(next: GuideAnim) {
  clearSprite(); void guideSprite.offsetWidth; guideSprite.classList.add(next);
}

function clearSprite() {
  guideSprite.style.cssText='';
  guideSprite.classList.remove(...ALL_G,'g-peek');
}

// ─────────────────────────────────────────────
// 意图路由（本地/后端分离）
// ─────────────────────────────────────────────
const LOCAL_KW = [
  'what can you do','help me','capabilities','who are you','你能做什么','你好','hello','hi ',
  'time','what time','clock','几点',
  'weather','temperature','forecast','天气','气温','几度','下雨','冷','热',
  'dashboard','debug','monitor','ops','面板','调试',
  'show ','open ','display ',
  'music','play music','song','listen','音乐','听歌',
  '下一首','next song','上一首','previous','暂停','pause','播放','play',
  'rest','sleep','bye','goodbye','night','休息','晚安','再见',
];

function isLocal(text: string) {
  const t=text.toLowerCase();
  return !isBackendIntent(t) && LOCAL_KW.some(k=>t.includes(k));
}

// ─────────────────────────────────────────────
// 发送消息（承：用户意图进入场）
// ─────────────────────────────────────────────
async function handleSend() {
  const text=chatInput.value.trim();
  if(!text) return;
  chatInput.value='';
  appendMsg(text,'user'); scrollMsgs();
  field.emit('chat.user.message',{text});
  setGuide('g-thinking'); typingEl.classList.add('show');
  clearYawnTimer(); resetIdleTimer();

  if(isLocal(text)) {
    // 本地：等 pet.reply.message，最多 5s 超时
    let done=false;
    const unsub=field.observe('pet.reply.message',()=>{done=true;unsub();});
    setTimeout(()=>{ if(!done){typingEl.classList.remove('show');clearSprite();unsub();} },5000);
    scheduleYawn(); return;
  }

  // 后端（转：因果链传递给 skill field）
  try {
    const r=await api.query(text,CHAT_SESSION_ID);
    currentScopeId=r?.scopeId??r?.eventId??'__any__';
  } catch {
    field.emit('query.failed',{text});
  }
  scheduleYawn();
}

export function appendMsg(text: string, who: 'user'|'pet') {
  const div=document.createElement('div');
  div.className=`chat-bubble ${who}`;
  div.innerHTML=text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\n/g,'<br>');
  chatMsgs.insertBefore(div,typingEl);
  scrollMsgs();
}

function scrollMsgs() { chatMsgs.scrollTop=chatMsgs.scrollHeight; }

// ─────────────────────────────────────────────
// 闲置（住坏空：场在无观察时安住，然后坏灭）
// ─────────────────────────────────────────────
function scheduleYawn() {
  clearYawnTimer();
  yawnTimer=setTimeout(()=>{
    if(chatOpen){
      setGuide('g-doze');
      yawnTimer=setTimeout(()=>{ if(chatOpen)setGuide('g-sleep'); },30_000);
    }
  },18_000);
}
function clearYawnTimer(){ if(yawnTimer){clearTimeout(yawnTimer);yawnTimer=null;} }

function startIdleTimer() {
  clearIdleTimer();
  idleTimer=setTimeout(()=>{
    if(!chatOpen){ petVis='vanished'; setGuide('g-vanish');
      setTimeout(()=>{ guideWindow.classList.remove('visible');clearSprite(); },1600); }
  },60_000);
}
function clearIdleTimer(){ if(idleTimer){clearTimeout(idleTimer);idleTimer=null;} }
function resetIdleTimer(){ clearIdleTimer(); if(!chatOpen)startIdleTimer(); }

function playWakeVoice(){
  const a=new Audio('/ritual/wake-voice.mp3');a.volume=.65;a.play().catch(()=>{});
}

// ─────────────────────────────────────────────
// Field 初始化（起：气泡在场中缘起）
// ─────────────────────────────────────────────


function initField() {
  const W=window.innerWidth, H=window.innerHeight;
  [
    {id:'music',      icon:'🎵',title:'Music',       description:'Click to open',              x:W-90,  y:100, content:buildMusicModule},
    {id:'mail',       icon:'📬',title:'Mail',        description:'3 unread',                   x:W-90,  y:200, content:buildMailModule},
    {id:'agenda',     icon:'📅',title:'Agenda',      description:'2 meetings today',           x:W-90,  y:300, content:buildAgendaModule},
    {id:'weather',    icon:'🌤',title:'Weather',     description:"Say 'weather in Shenzhen'",  x:60,    y:100, content:buildWeatherModule, w:320,h:320},
    {id:'crm',        icon:'👥',title:'CRM',         description:'Sarah & James: follow-up',   x:60,    y:220, content:buildCRMModule},
    
    {id:'approval',   icon:'✅',title:'Approvals',   description:'2 pending',                  x:W/2-26,y:60,  content:buildApprovalModule},
    {id:'reflection', icon:'🪞',title:'Reflection',  description:"Today's energy",             x:W/2-26,y:160, content:buildReflectionModule},
    {id:'client', icon:'👤', title:'Client Profile', description:'Customer details', x:60, y:460, content:buildClientModule, w:380, h:460},
    {id:'sales', icon:'📊', title:'Sales Report', description:'Monthly revenue', x:60, y:580, content:buildSalesModule, w:380, h:460},
    {id:'knowledge', icon:'📚', title:'Knowledge', description:'Retrieved info', x:W-90, y:400, content:buildKnowledgeModule, w:420, h:500},
  ].forEach(m=>field.emit('manifestation.spawn',m));

  // 演示事件序列（缘起：事件从场中涌现）
  [
    {delay:4000,  id:'mail',     msg:'📬 Adam · Design review Friday'},
    {delay:10000, id:'agenda',   msg:'📅 Standup in 15 min'},
    {delay:17000, id:'approval', msg:'✅ Q4 budget ¥580k pending'},
    {delay:25000, id:'crm',      msg:'👥 Sarah: 3 days no contact'},
  ].forEach(({delay,id,msg})=>{
    setTimeout(()=>{
      field.emit('manifestation.notify',{id});
      field.emit('demo.event',{id,msg});
      showToast(msg);
      if(!chatOpen){ setGuide('g-awake'); setTimeout(()=>{ if(!chatOpen)setGuide('g-doze'); },2500); }
    },delay);
  });
}

function showToast(text: string) {
  const r=guideWindow.getBoundingClientRect();
  const el=document.createElement('div');
  el.className='glide-toast'; el.textContent=text;
  el.style.cssText=`left:${Math.max(10,r.left-250)}px;top:${Math.max(10,r.top-20)}px;`;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .4s';el.style.opacity='0'; setTimeout(()=>el.remove(),420); },3500);
}

// ── 模块内容（住：显现体的内容） ─────────────
// ========== 音乐播放器模块（支持播放列表、控制按钮、事件监听）==========
const MUSIC_PLAYLIST = [
  { name: 'Crystal Ball', artist: 'Local Library', src: '/music/Crystal Ball.mp3' },
  { name: 'Weight of the World', artist: 'Local Artist',   src: '/music/Weight_of_the_World.flac' },
  { name: 'Focus Flow',          artist: 'Studio',         src: '/music/Crystal Ball.mp3' },
];
let currentTrackIndex = 0;
let currentAudio: HTMLAudioElement | null = null;
let musicModuleElement: HTMLElement | null = null;

function renderMusicModule() {
  if (!musicModuleElement) return;
  const track = MUSIC_PLAYLIST[currentTrackIndex];
  musicModuleElement.innerHTML = `
    <div class="mod-section">
      <div class="mod-player">
        <div class="mod-player-art">🎵</div>
        <div class="mod-player-info">
          <div class="mod-player-name">${escapeHtml(track.name)}</div>
          <div class="mod-player-artist">${escapeHtml(track.artist)}</div>
          <div class="mod-progress"><div class="mod-progress-bar" id="music-progress-bar" style="width:0%"></div></div>
        </div>
      </div>
    </div>
    <div class="mod-section">
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
        <button class="mod-action-btn" data-music="prev">⏮ Previous</button>
        <button class="mod-action-btn" data-music="toggle">⏸ Pause</button>
        <button class="mod-action-btn" data-music="next">⏭ Next</button>
      </div>
    </div>
  `;
  // 事件委托：在容器上监听
  musicModuleElement.querySelectorAll('[data-music]').forEach(btn => {
    btn.removeEventListener('click', musicClickHandler);
    btn.addEventListener('click', musicClickHandler);
  });
}

function musicClickHandler(e: Event) {
  const btn = e.currentTarget as HTMLElement;
  const action = btn.getAttribute('data-music');
  if (action === 'prev') field.emit('music.prev', {});
  else if (action === 'next') field.emit('music.next', {});
  else if (action === 'toggle') field.emit('music.toggle', {});
}

async function playTrack(index: number) {
  if (index < 0) index = MUSIC_PLAYLIST.length - 1;
  if (index >= MUSIC_PLAYLIST.length) index = 0;
  if (currentTrackIndex === index && currentAudio && !currentAudio.paused) return;
  currentTrackIndex = index;
  const track = MUSIC_PLAYLIST[currentTrackIndex];
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const audio = new Audio(track.src);
  audio.volume = 0.7;
  try {
    await audio.play();
    currentAudio = audio;
    renderMusicModule();
    audio.addEventListener('ended', () => field.emit('music.next', {}));
    const updateProgress = () => {
      if (currentAudio && currentAudio.duration && !currentAudio.paused) {
        const percent = (currentAudio.currentTime / currentAudio.duration) * 100;
        const bar = musicModuleElement?.querySelector('#music-progress-bar') as HTMLElement;
        if (bar) bar.style.width = `${percent}%`;
        requestAnimationFrame(updateProgress);
      }
    };
    updateProgress();
  } catch (err) {
    console.error('Playback failed:', err);
  }
}

function buildMusicModule(): HTMLElement {
  const container = document.createElement('div');
  musicModuleElement = container;
  renderMusicModule();
  if (!currentAudio) playTrack(0); // 自动开始第一首（可注释）
  return container;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

let musicEventsRegistered = false;
function registerMusicEvents() {
  if (musicEventsRegistered) return;
  musicEventsRegistered = true;
  field.observe('music.prev', () => playTrack(currentTrackIndex - 1));
  field.observe('music.next', () => playTrack(currentTrackIndex + 1));
  field.observe('music.toggle', () => {
    if (currentAudio) {
      if (currentAudio.paused) currentAudio.play();
      else currentAudio.pause();
      renderMusicModule();
    }
  });
}

// ========== 音乐模块结束 ==========


function buildMailModule(): HTMLElement {
  const el=document.createElement('div');
  el.innerHTML=`
    <div class="mod-section"><div class="mod-label">Unread · 3</div>
      <div class="mod-row"><span class="mod-row-icon">📩</span>
        <div class="mod-row-text"><div class="mod-row-title">Adam · Friday design review</div><div class="mod-row-sub">Slides need review.</div></div></div>
      <div class="mod-row"><span class="mod-row-icon">📩</span>
        <div class="mod-row-text"><div class="mod-row-title">Sarah · Q4 Budget</div><div class="mod-row-sub">Please review attachment.</div></div></div>
    </div>`;
  return el;
}

function buildAgendaModule(): HTMLElement {
  const el=document.createElement('div');
  el.innerHTML=`
    <div class="mod-section"><div class="mod-label">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</div>
      <div class="mod-row"><span class="mod-row-icon">🕑</span>
        <div class="mod-row-text"><div class="mod-row-title">14:00 Design Review</div><div class="mod-row-sub">1h · Room B</div></div></div>
      <div class="mod-row"><span class="mod-row-icon">🕔</span>
        <div class="mod-row-text"><div class="mod-row-title">16:30 1:1 with Adam</div><div class="mod-row-sub">30m · Google Meet</div></div></div>
    </div>`;
  return el;
}

function buildWeatherModule(): HTMLElement {
  const el=document.createElement('div');
  el.innerHTML=`
    <div style="text-align:center;padding:16px 0 10px">
      <div style="font-size:44px" id="w-emoji">🌤</div>
      <div style="font-size:26px;color:rgba(200,225,255,.95);margin-top:6px" id="w-temp">–°C</div>
      <div style="font-size:11px;color:rgba(140,170,220,.6);margin-top:3px" id="w-city">Say "weather in Shenzhen"</div>
    </div>
    <div style="padding:8px;background:rgba(255,255,255,.04);border-radius:8px;font-size:11.5px;color:rgba(160,200,255,.6);text-align:center" id="w-detail">Loading…</div>
    <div style="margin-top:10px;text-align:center">
      <button class="mod-action-btn" id="w-btn">🔄 Reload</button>
    </div>`;

  // 监听天气更新事件
  const unsub=field.observe('weather.update',e=>{
    if(!el.isConnected){unsub();return;}
    const {text,city}=e.payload as any;
    const emoji=/^([^\s]+)/.exec(text)?.[1]??'🌡';
    const temp=/(\d+)°C/.exec(text)?.[0]??'–°C';
    const desc=/·\s*(.+?)(?:\n|$)/.exec(text)?.[1]?.trim()??'';
    el.querySelector('#w-emoji')!.textContent=emoji;
    el.querySelector('#w-temp')!.textContent=temp;
    el.querySelector('#w-city')!.textContent=city;
    el.querySelector('#w-detail')!.textContent=text.replace(/\*\*/g,'').replace(/\n/g,' · ');
  });

  setTimeout(()=>{
    el.querySelector('#w-btn')?.addEventListener('click',()=>field.emit('chat.user.message',{text:'weather'}));
    field.emit('chat.user.message',{text:'weather'});
  },800);
  return el;
}

function buildCRMModule(): HTMLElement {
  const el=document.createElement('div');
  el.innerHTML=`
    <div class="mod-section"><div class="mod-label">Follow-up needed</div>
      <div class="mod-row"><span class="mod-row-icon">👤</span>
        <div class="mod-row-text"><div class="mod-row-title">Sarah Liu · Acme</div><div class="mod-row-sub">3 days · Contract renewal</div></div>
        <button class="mod-action-btn" style="padding:5px 10px;font-size:11px">Contact</button></div>
      <div class="mod-row"><span class="mod-row-icon">👤</span>
        <div class="mod-row-text"><div class="mod-row-title">James · StartupX</div><div class="mod-row-sub">7 days · Demo follow-up</div></div>
        <button class="mod-action-btn" style="padding:5px 10px;font-size:11px">Contact</button></div>
    </div>`;
  return el;
}


function buildApprovalModule(): HTMLElement {
  const el=document.createElement('div');
  el.innerHTML=`
    <div class="mod-section"><div class="mod-label">Pending · 2</div>
      <div class="mod-row"><span class="mod-row-icon">📋</span>
        <div class="mod-row-text"><div class="mod-row-title">Q4 Budget Request</div><div class="mod-row-sub">¥580,000 · Finance</div></div></div>
      <div style="display:flex;gap:8px;margin:6px 0 12px">
        <button class="mod-action-btn">✅ Approve</button>
        <button class="mod-action-btn">❌ Reject</button>
      </div>
      <div class="mod-row"><span class="mod-row-icon">📋</span>
        <div class="mod-row-text"><div class="mod-row-title">Travel · James · ¥12,400</div><div class="mod-row-sub">Shanghai trip</div></div></div>
    </div>`;
  return el;
}

function buildReflectionModule(): HTMLElement {
  const el=document.createElement('div');
  el.innerHTML=`
    <div class="mod-section"><div class="mod-label">${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
      <div style="padding:10px;background:rgba(255,255,255,.04);border-radius:8px;border:1px solid rgba(100,180,255,.06);margin-bottom:10px;font-size:12.5px;color:rgba(180,210,255,.85);line-height:1.7">
        3 tasks done · 5 emails replied · Afternoon focus excellent! 💪
      </div>
      <div class="mod-label">Energy curve</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:44px;padding:4px 0">
        ${[40,65,80,55,90,70,45,60,85,72,50,35].map(h=>`<div style="flex:1;height:${h}%;background:rgba(100,160,255,${h/120+.2});border-radius:3px 3px 0 0"></div>`).join('')}
      </div>
    </div>`;
  return el;
}

function buildClientModule(): HTMLElement {
  const el = document.createElement('div');
  el.style.padding = '16px';
  el.innerHTML = 'Loading client data...';
  field.observe('client.update', (e) => {
    if (!el.isConnected) return;
    const data = (e.payload as any); 
    el.innerHTML = `
      <div><strong>${data.name}</strong> · ${data.country}</div>
      <div>💰 Revenue: ${data.totalRevenue ?? 0}</div>
      <div>📦 Orders: ${data.orderCount ?? 0}</div>
    `;
  });
  return el;
}

function buildSalesModule(): HTMLElement {
  const el = document.createElement('div');
  el.style.padding = '16px';
  el.innerHTML = 'Loading sales report...';
  field.observe('sales.update', (e) => {
    if (!el.isConnected) return;
    const data = (e.payload as any);  
    el.innerHTML = `
      <div><strong>${data.month}</strong></div>
      <div>💰 Total Revenue: $${data.totalRevenue?.toLocaleString() ?? 0}</div>
      <div>📦 Total Orders: ${data.totalOrders ?? 0}</div>
      <div>👥 Unique Customers: ${data.uniqueCustomers ?? 0}</div>
      <div>🏷️ Top Product: ${data.products?.[0]?.name ?? 'N/A'} (${data.products?.[0]?.units ?? 0} units)</div>
    `;
  });
  return el;
}

function buildKnowledgeModule(): HTMLElement {
  const el = document.createElement('div');
  el.style.padding = '16px';
  el.innerHTML = 'Loading knowledge...';
  field.observe('knowledge.update', (e) => {
    if (!el.isConnected) return;
    const data = (e.payload as any);  
    el.innerHTML = `<pre style="white-space:pre-wrap;font-size:12px;">${escapeHtml(data.text)}</pre>`;
  });
  return el;
}