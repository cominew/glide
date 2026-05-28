// apps/dashboard/manifestation.ts
// ══════════════════════════════════════════════════════════
//   Manifestation · 认知流体操作系统
//
//   Bubble Matter States（气泡物质态）：
//     Orb        → 潜伏奇点（hidden）
//     Bubble     → 可塑流体态（orb 52px）
//     Expanded   → 稳定现实态（自适应尺寸）
//     Dragging   → 半坍缩流动态（soap bubble + comet tail）
//     Merging    → 拓扑融合态（metaball liquid）
//     Dissolving → 消散态
//
//   物理引擎：
//     SVG MetaBall filter → 液滴融合视觉
//     Spring damping      → 软体弹性
//     Canvas comet tail   → 拖拽彗星尾迹
//     Intrinsic sizing    → 自适应展开尺寸
//
//   哲学：
//     每个 Bubble = 视角奇点（Perspective Singularity）
//     融合 = 语义共振（Semantic Resonance）
//     不察则无（短生命周期）
// ══════════════════════════════════════════════════════════

// apps/dashboard/manifestation.ts
// ══════════════════════════════════════════════════════════
//   Manifestation · 认知流体操作系统
// ══════════════════════════════════════════════════════════

import { field, ProjectionInstruction } from './field';

// ─────────────────────────────────────────────
// 辅助内容构建函数
// ─────────────────────────────────────────────
function buildWeatherContent(text: string, city: string): HTMLElement {
  const el = document.createElement('div');
  const emoji = /^([^\s]+)/.exec(text)?.[1] ?? '🌡';
  const temp = /(\d+)°C/.exec(text)?.[0] ?? '–°C';
  const desc = /·\s*(.+?)(?:\n|$)/.exec(text)?.[1]?.trim() ?? '';
  el.innerHTML = `
    <div style="text-align:center;padding:20px 0 12px">
      <div style="font-size:52px">${emoji}</div>
      <div style="font-size:30px;color:rgba(200,225,255,.95);margin-top:8px">${temp}</div>
      <div style="font-size:12px;color:rgba(140,170,220,.6);margin-top:4px">${city}</div>
      <div style="font-size:11px;color:rgba(140,170,220,.4);margin-top:2px">${desc}</div>
    </div>
    <div style="padding:10px 14px;background:rgba(255,255,255,.04);border-radius:10px;font-size:12px;color:rgba(160,200,255,.7);line-height:1.6">
      ${text.replace(/\*\*/g, '').replace(/\n/g, '<br>')}
    </div>`;
  return el;
}

// ─────────────────────────────────────────────
// SVG MetaBall Filter
// ─────────────────────────────────────────────
function ensureMetaBallFilter() {
  if (document.getElementById('glide-metaball-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'glide-metaball-svg';
  svg.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none;z-index:-1';
  svg.innerHTML = `...`; // 内容不变，省略
  document.body.appendChild(svg);
}

// ─────────────────────────────────────────────
// Canvas 彗星尾迹层
// ─────────────────────────────────────────────
class CometTail {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private points: { x: number; y: number; t: number; r: number }[] = [];
  private raf = 0;
  active = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:8990;
      width:100vw; height:100vh;`;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d')!;
    document.body.appendChild(this.canvas);
  }

  addPoint(x: number, y: number, velocity: number) {
    this.points.push({
      x, y,
      t: Date.now(),
      r: Math.min(28, 8 + velocity * 0.4),
    });
    // 最多保留 40 个轨迹点
    if (this.points.length > 40) this.points.shift();
    if (!this.active) this._loop();
  }

  private _loop() {
    this.active = true;
    const now = Date.now();
    const LIFE = 600; // ms

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.points = this.points.filter(p => now - p.t < LIFE);

    if (this.points.length >= 2) {
      for (let i = 1; i < this.points.length; i++) {
        const prev = this.points[i - 1];
        const curr = this.points[i];
        const age  = (now - curr.t) / LIFE;
        const alpha = (1 - age) * 0.55;
        const r     = curr.r * (1 - age * 0.6);

        const grad = this.ctx.createRadialGradient(curr.x, curr.y, 0, curr.x, curr.y, r * 2);
        grad.addColorStop(0, `rgba(120,200,255,${alpha})`);
        grad.addColorStop(0.5, `rgba(80,160,255,${alpha * 0.5})`);
        grad.addColorStop(1, `rgba(40,100,200,0)`);

        this.ctx.beginPath();
        this.ctx.arc(curr.x, curr.y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // 连线（尾迹连续感）
        this.ctx.beginPath();
        this.ctx.moveTo(prev.x, prev.y);
        this.ctx.lineTo(curr.x, curr.y);
        this.ctx.strokeStyle = `rgba(100,180,255,${alpha * 0.3})`;
        this.ctx.lineWidth = r * 0.6;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
      }
    }

    if (this.points.length > 0) {
      this.raf = requestAnimationFrame(() => this._loop());
    } else {
      this.active = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.active = false;
    this.points = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// 全局彗星尾迹（所有气泡共用一个 canvas）
let globalCometTail: CometTail | null = null;
function getComet(): CometTail {
  if (!globalCometTail) globalCometTail = new CometTail();
  return globalCometTail;
}

// ─────────────────────────────────────────────
// Spring 弹性动画
// ─────────────────────────────────────────────
class Spring {
  value   = 1;
  target  = 1;
  velocity= 0;
  private raf = 0;
  private cb: (v: number) => void;

  constructor(cb: (v: number) => void) { this.cb = cb; }

  animateTo(target: number, stiffness = 180, damping = 18) {
    this.target = target;
    cancelAnimationFrame(this.raf);
    const step = () => {
      const force = (this.target - this.value) * stiffness / 1000;
      this.velocity += force;
      this.velocity *= 1 - damping / 1000;
      this.value    += this.velocity;
      this.cb(this.value);
      if (Math.abs(this.target - this.value) > 0.001 || Math.abs(this.velocity) > 0.001) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.value = this.target;
        this.cb(this.value);
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() { cancelAnimationFrame(this.raf); }
}

// ─────────────────────────────────────────────
// 融合合并函数
// ─────────────────────────────────────────────

export function mergeAllBubbles() {
  const visible = manifestationPool.all().filter(m => m.state !== 'hidden' && m.state !== 'dissolving');
  if (visible.length < 2) {
    console.warn('[Merge] Not enough visible bubbles to merge');
    return;
  }

  // 收集所有原子子节点（每个 Manifestation 自身）
  const allChildren: Manifestation[] = [];
  for (const bubble of visible) {
    allChildren.push(bubble);
  }

  // 计算中心点
  let sumX = 0, sumY = 0;
  for (const child of allChildren) {
    const c = child.center;
    sumX += c.x;
    sumY += c.y;
  }
  const centerX = sumX / allChildren.length;
  const centerY = sumY / allChildren.length;

  // 收集语义标签
  const allTags = allChildren.flatMap(c => (c as any).opts.semanticTags ?? []);
  const uniqueTags = [...new Set(allTags)];
  const semantic = resolveSemanticFromTags(uniqueTags);
  const icon  = semantic?.icon  ?? '🔮';
  const title = semantic?.title ?? `Merged (${allChildren.length} perspectives)`;
  const desc  = semantic?.description ?? 'All visible bubbles combined';

  // 隐藏原气泡
  for (const child of allChildren) {
    child.vanish();
  }

  // 创建融合体
  const merged = new MergedBubble(allChildren, centerX, centerY, {
    icon, title, description: desc, semanticTags: uniqueTags,
  });
  manifestationPool.registerMerged(merged);
  field.emit('manifestation.merged', { count: allChildren.length, semantic: semantic?.title ?? null });
}

// ─────────────────────────────────────────────
// 拖拽引擎（速度追踪 + 彗星尾迹）
// ─────────────────────────────────────────────
export function mountDrag(opts: {
  el:           HTMLElement;
  handle?:      HTMLElement;
  onDragStart?: (vx: number, vy: number) => void;
  onDragMove?:  (x: number, y: number, vx: number, vy: number) => void;
  onDragEnd?:   (x: number, y: number) => void;
  isDragging?:  (v: boolean) => void;
  comet?:       boolean;  // 是否显示彗星尾迹
}) {
  const { el, onDragStart, onDragMove, onDragEnd, isDragging } = opts;
  const handle = opts.handle ?? el;
  const showComet = opts.comet ?? true;

  let active = false, moved = false;
  let sx = 0, sy = 0, ox = 0, oy = 0;
  let lastX = 0, lastY = 0, lastT = 0;
  let vx = 0, vy = 0;
  const THRESH = 4;

  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(
      'button,input,textarea,select,a,[data-nodrag],.mani-resize'
    )) return;
    active = false; moved = false;
    sx = e.clientX; sy = e.clientY;
    lastX = sx; lastY = sy; lastT = Date.now();
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup',   onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function onMove(e: PointerEvent) {
    if (!active && Math.hypot(e.clientX - sx, e.clientY - sy) > THRESH) {
      active = true; moved = true;
      el.style.transition = 'none';
      el.classList.add('dragging');
      isDragging?.(true);
      onDragStart?.(vx, vy);
    }
    if (!active) return;

    // 速度计算
    const now = Date.now();
    const dt  = Math.max(1, now - lastT);
    vx = (e.clientX - lastX) / dt * 16;
    vy = (e.clientY - lastY) / dt * 16;
    lastX = e.clientX; lastY = e.clientY; lastT = now;

    const speed = Math.hypot(vx, vy);
    const x = Math.min(window.innerWidth  - el.offsetWidth,  Math.max(0, e.clientX - ox));
    const y = Math.min(window.innerHeight - el.offsetHeight, Math.max(0, e.clientY - oy));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.right = 'auto'; el.style.bottom = 'auto';

    // 彗星尾迹（跟随气泡中心）
    if (showComet) {
      const cx = x + el.offsetWidth  / 2;
      const cy = y + el.offsetHeight / 2;
      getComet().addPoint(cx, cy, speed);
    }

    onDragMove?.(x, y, vx, vy);
    refreshHitZones();
  }

  function onUp() {
  handle.removeEventListener('pointermove', onMove);
  handle.removeEventListener('pointerup', onUp);
  handle.removeEventListener('pointercancel', onUp);
  if (active) {
    el.classList.remove('dragging');
    requestAnimationFrame(() => { el.style.transition = ''; });
    // ⭐ 新增：重置变形和圆角
    el.style.borderRadius = '';
    el.style.transform = '';
    isDragging?.(false);
    getComet().stop();
    const r = el.getBoundingClientRect();
    onDragEnd?.(r.left, r.top);
    refreshHitZones();
  }
  active = false;
}

  handle.addEventListener('pointerdown', onDown);
  return { wasDragged: () => moved };
}

// ─────────────────────────────────────────────
// Resize 句柄
// ─────────────────────────────────────────────
export function mountResize(el: HTMLElement, handle: HTMLElement, onResize?: () => void) {
  let active = false, sx = 0, sy = 0, sw = 0, sh = 0;
  const MIN_W = 240, MIN_H = 160;
  handle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    active = true; sx = e.clientX; sy = e.clientY;
    sw = el.offsetWidth; sh = el.offsetHeight;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!active) return;
    const r  = el.getBoundingClientRect();
    const nw = Math.min(Math.max(MIN_W, sw + e.clientX - sx), window.innerWidth  - r.left - 8);
    const nh = Math.min(Math.max(MIN_H, sh + e.clientY - sy), window.innerHeight - r.top  - 8);
    el.style.width  = `${nw}px`;
    el.style.height = `${nh}px`;
    onResize?.();
    refreshHitZones();
  });
  handle.addEventListener('pointerup', () => { active = false; });
}

// ─────────────────────────────────────────────
// 热区上报
// ─────────────────────────────────────────────
function refreshHitZones() {
  const fn = (window as any).__glide_refreshHitZones;
  if (typeof fn === 'function') fn();
}

// ─────────────────────────────────────────────
// 全局注意力
// ─────────────────────────────────────────────
let expandedId: string | null = null;
let _expandedIds = new Set<string>(); 

function notifyFocusChange(id: string | null, open: boolean) {
  if (open && id)    _expandedIds.add(id);
  if (!open && id)   _expandedIds.delete(id);
  expandedId = _expandedIds.size > 0 ? [..._expandedIds].at(-1)! : null;
  field.emit('manifestation.focus.changed', { id: expandedId, openIds: [..._expandedIds] });
}

// ─────────────────────────────────────────────
// 短生命周期计时器
// ─────────────────────────────────────────────
class LifetimeClock {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hovered = false;

  constructor(
    private ms: number,
    private onExpire: () => void,
  ) {}

  start()  { this._clear(); if (!this.hovered && this.ms > 0) this.timer = setTimeout(() => { if (!this.hovered) this.onExpire(); }, this.ms); }
  pause()  { this._clear(); }
  enter()  { this.hovered = true;  this._clear(); }
  leave()  { this.hovered = false; this.start(); }
  clearAll(){ this._clear(); }
  private _clear() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}

// ─────────────────────────────────────────────
// ManifestationOptions
// ─────────────────────────────────────────────
export interface ManifestationOptions {
  id: string;
  icon: string;
  title: string;
  description?: string;
  content: () => HTMLElement;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  minW?: number;
  minH?: number;
  autoSize?: boolean;
  bubbleLifeMs?: number;
  expandedLifeMs?: number;
  semanticTags?: string[];
  meta?: {               // ✅ 新增
    title?: string;
    summary?: string;
    attention?: number;
    urgency?: number;
  };
}


// ─────────────────────────────────────────────
// Manifestation 类
// ─────────────────────────────────────────────
export class Manifestation {
  el: HTMLElement;
  state: 'hidden' | 'orb' | 'bubble' | 'expanded' | 'dragging' | 'dissolving' = 'hidden';

    public getManifestationOptions(): ManifestationOptions {
    return this.opts;
  }
  
  get icon() { return this.opts.icon; }
  get title() { return this.opts.title; }
  get semanticTags() { return this.opts.semanticTags ?? []; }
  getContent(): () => HTMLElement {
    return this.opts.content;
  }

  private opts: ManifestationOptions;
  public bubbleClock: LifetimeClock;
  public expandedClock: LifetimeClock;
  private scaleSpring: Spring;
  private _dragging = false;
  private _tooltip: HTMLElement | null = null;
  private _contentEl: HTMLElement | null = null;

  

  get center() {
    const r = this.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  constructor(opts: ManifestationOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'manifestation';
    this.el.dataset.id = opts.id;
    if (opts.semanticTags?.length) this.el.dataset.semantic = opts.semanticTags.join(',');

    const x = opts.x ?? 60 + Math.random() * (window.innerWidth - 200);
    const y = opts.y ?? 60 + Math.random() * (window.innerHeight - 200);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;

    this.bubbleClock = new LifetimeClock(opts.bubbleLifeMs ?? 10_000, () => this._dissolve());
    this.expandedClock = new LifetimeClock(opts.expandedLifeMs ?? 45_000, () => this.collapse());
    this.scaleSpring = new Spring(v => {
      if (this.state === 'bubble' || this.state === 'orb') this.el.style.transform = `scale(${v})`;
    });

    document.body.appendChild(this.el);
    this._toOrb();

    field.observe('manifestation.focus.changed', e => {
      const openIds: string[] = (e.payload as any)?.openIds ?? [];
      if (this.state === 'bubble' || this.state === 'orb') {
        this.el.classList.toggle('dim', openIds.length > 0 && !openIds.includes(this.opts.id));
      }
    });

    field.observe('field.attention.lost', () => {
      if (this.state === 'bubble') this.bubbleClock.start();
    });
  }  

  // ── Orb 态（刚生成时的潜伏奇点）─────────────
  private _toOrb() {
    this.state = 'orb';
    this.el.className = 'manifestation orb spawning';
    this.el.innerHTML = '';
    this.el.style.width = this.el.style.height = '';

    const icon = document.createElement('span');
    icon.className   = 'mani-bubble-icon';
    icon.textContent = this.opts.icon;
    this.el.appendChild(icon);

    this.el.addEventListener('animationend', () => {
      this.el.classList.remove('spawning');
      this._toBubble();
    }, { once: true });
  }

  // ── Bubble 态（可塑流体态）──────────────────
  private _toBubble(fromDrag = false) {
    this.state = 'bubble';
    this.expandedClock.clearAll();

    // 从展开态收回：肥皂泡弹性动画
    if (fromDrag || this.el.classList.contains('expanded')) {
      this.el.style.transition = 'none';
      this.el.classList.remove('expanded');
      this.el.style.width = this.el.style.height = '';
    }

    this.el.className = 'manifestation bubble';
    this.el.innerHTML = '';
    this.el.style.filter = 'url(#bubble-glow)';

    const icon = document.createElement('span');
    icon.className   = 'mani-bubble-icon';
    icon.textContent = this.opts.icon;
    this.el.appendChild(icon);

    // 入场弹性
    this.el.style.transform = 'scale(0.3)';
    this.scaleSpring.value  = 0.3;
    this.scaleSpring.animateTo(1, 200, 14);

    // 悬停 tooltip
    this.el.addEventListener('pointerenter', () => {
      this.bubbleClock.enter();
      this._showTooltip();
      // 悬停时轻微放大
      this.scaleSpring.animateTo(1.12, 300, 20);
    });
    this.el.addEventListener('pointerleave', () => {
      this._hideTooltip();
      this.bubbleClock.leave();
      this.scaleSpring.animateTo(1, 200, 16);
    });

    // 单击展开
    const drag = mountDrag({
      el: this.el,
      isDragging: v => { this._dragging = v; },
      comet: true,
      onDragStart: () => {
        // 拖动时进入流体态视觉
        this.el.style.filter = 'url(#bubble-glow)';
        this.el.style.opacity = '0.85';
        this.bubbleClock.pause();
      },
      onDragEnd: () => {
        this.el.style.opacity = '';
        this.bubbleClock.start();
        // 检查是否靠近另一个气泡→触发磁吸
        checkMergeProximity(this);
      },
    });

    this.el.addEventListener('click', () => {
      if (drag.wasDragged()) return;
      this.expand();
    });

    this.bubbleClock.start();
    refreshHitZones();
  }

  // ── Expanded 态（稳定现实态）────────────────
  private _toExpanded() {
    this.state = 'expanded';
    this.bubbleClock.clearAll();
    this.scaleSpring.stop();
    this._hideTooltip();
    this.el.classList.remove('dim');
    this.el.style.transform = '';
    this.el.style.filter    = '';

    const r  = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;

    // 构建内容以计算所需尺寸
    this._contentEl = this.opts.content();

    // intrinsic sizing：先测量内容自然尺寸
    const probe = document.createElement('div');
    probe.style.cssText = `
      position:fixed; visibility:hidden; pointer-events:none;
      left:-9999px; top:-9999px;
      padding:16px; min-width:300px; max-width:520px;
      font-family:inherit; font-size:13px;`;
    probe.appendChild(this._contentEl.cloneNode(true));
    document.body.appendChild(probe);
    const nat = { w: probe.scrollWidth + 32, h: probe.scrollHeight + 80 };
    probe.remove();

    const W = Math.min(Math.max(this.opts.minW ?? 300, nat.w, this.opts.w ?? 0), window.innerWidth  - 32);
    const H = Math.min(Math.max(this.opts.minH ?? 200, nat.h, this.opts.h ?? 0), window.innerHeight - 32);

    const left = Math.min(window.innerWidth  - W - 8, Math.max(8, cx - W / 2));
    const top  = Math.min(window.innerHeight - H - 8, Math.max(8, cy - H / 2));

    this.el.className = 'manifestation expanded expanding';
    this.el.innerHTML = '';
    this.el.style.left   = `${left}px`;
    this.el.style.top    = `${top}px`;
    this.el.style.width  = `${W}px`;
    this.el.style.height = `${H}px`;

    // 肥皂泡展开动画
    requestAnimationFrame(() => {
      this.el.classList.remove('expanding');
      this.el.classList.add('expanded-open');
    });

    // ── 头部
    const header = document.createElement('div');
    header.className = 'mani-header';
    header.innerHTML = `
      <span class="mani-icon">${this.opts.icon}</span>
      <span class="mani-title">${this.opts.title}</span>`;

    // 控制按钮组
    const controls = document.createElement('div');
    controls.className = 'mani-controls';
    controls.dataset.nodrag = '1';

    // 收回为气泡
    const collapseBtn = document.createElement('button');
    collapseBtn.className   = 'mani-ctrl-btn';
    collapseBtn.title       = 'Collapse to bubble';
    collapseBtn.textContent = '○';
    collapseBtn.style.pointerEvents = 'auto';
    collapseBtn.addEventListener('click', e => { e.stopPropagation(); this.collapse(); });

    // 关闭消隐
    const closeBtn = document.createElement('button');
    closeBtn.className   = 'mani-ctrl-btn mani-close';
    closeBtn.title       = 'Dissolve';
    closeBtn.textContent = '×';
    closeBtn.style.pointerEvents = 'auto';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); this._dissolve(); });

    controls.append(collapseBtn, closeBtn);
    header.appendChild(controls);
    this.el.appendChild(header);

    // ── 内容区（滚动仅当内容超过阈值）
    const body = document.createElement('div');
    body.className = 'mani-body';
    // 内容高度超过窗口 60% 才启用滚动
    const threshold = window.innerHeight * 0.6;
    body.style.overflowY = nat.h > threshold ? 'auto' : 'visible';
    body.appendChild(this._contentEl);
    this.el.appendChild(body);

    // ── Resize 句柄
    const rh = document.createElement('div');
    rh.className = 'mani-resize';
    this.el.appendChild(rh);
    mountResize(this.el, rh);

    // ── 标题栏拖拽（展开态拖动进入流体态）
    mountDrag({
      el:     this.el,
      handle: header,
      comet:  true,
      isDragging: v => {
        this._dragging = v;
        // 展开态拖动时：视觉变为流体态（不改变实际 DOM 结构）
        this.el.style.opacity = v ? '0.88' : '';
        this.el.style.filter  = v ? 'url(#bubble-glow)' : '';
      },
      onDragEnd: () => {
        this.el.style.opacity = '';
        this.el.style.filter  = '';
        checkMergeProximity(this);
      },
    });

    // ── 悬停停止消隐计时
    this.el.addEventListener('pointerenter', () => this.expandedClock.enter());
    this.el.addEventListener('pointerleave', () => this.expandedClock.leave());

    if (this.opts.expandedLifeMs !== 0) {
      this.expandedClock.start();
    }

    notifyFocusChange(this.opts.id, true);
    refreshHitZones();
  }

  // ── 消散（Dissolving）────────────────────────
  private _dissolve() {
    if (this.state === 'dissolving' || this.state === 'hidden') return;
    this.state = 'dissolving';
    this.bubbleClock.clearAll();
    this.expandedClock.clearAll();
    this._hideTooltip();
    notifyFocusChange(this.opts.id, false);

    this.el.classList.add('dissolving');
    setTimeout(() => {
      this.state = 'hidden';
      this.el.classList.add('hidden');
      this.el.classList.remove('dissolving');
      refreshHitZones();
    }, 600);
  }

  // ── Tooltip ──────────────────────────────────
  private _showTooltip() {
  if ((!this.opts.description && !this.opts.meta) || this.state !== 'bubble') return;
  this._hideTooltip();
  const t = document.createElement('div');
  t.className = 'mani-tooltip';
  if (this.opts.meta) {
    t.innerHTML = `<strong>${this.opts.meta.title || this.opts.title}</strong><br>${this.opts.meta.summary || this.opts.description || ''}`;
    if (this.opts.meta.attention) t.innerHTML += `<div style="font-size:10px; margin-top:4px;">⚡ Attention: ${this.opts.meta.attention}</div>`;
  } else {
    t.textContent = `${this.opts.icon} ${this.opts.title}`;
    if (this.opts.description) {
      const sub = document.createElement('div');
      sub.className = 'mani-tooltip-sub';
      sub.textContent = this.opts.description;
      t.appendChild(sub);
    }
  }
    const r = this.el.getBoundingClientRect();
    t.style.left = `${r.left + r.width / 2}px`;
    t.style.top  = `${r.top - 8}px`;
    document.body.appendChild(t);
    this._tooltip = t;
  }

  private _hideTooltip() { this._tooltip?.remove(); this._tooltip = null; }

  // ── 公开 API ────────────────────────────────
  expand() {
    if (this.state === 'expanded') return;
    this._toExpanded();
  }

  collapse() {
    if (this.state === 'bubble' || this.state === 'orb') return;
    notifyFocusChange(this.opts.id, false);
    this._toBubble(true);
  }

  vanish()  { this._dissolve(); }

  appear(withBadge = false) {
    this.el.classList.remove('hidden', 'dissolving');
    if (this.state === 'hidden' || this.state === 'dissolving') {
      this.state = 'orb';
      this._toBubble();
    }
    if (withBadge) {
      const b = document.createElement('div');
      b.className = 'mani-badge'; b.textContent = '●';
      this.el.appendChild(b);
      setTimeout(() => b.remove(), 5000);
    }
  }

  notify() { this.appear(true); }

  updateContent(factory: () => HTMLElement) {
    this.opts = { ...this.opts, content: factory };
    if (this.state === 'expanded') {
      const body = this.el.querySelector('.mani-body');
      if (body) { body.innerHTML = ''; body.appendChild(factory()); }
    }
  }

  // 进入 merge-ready 态（被拖向另一个气泡）
  enterMergeReady() {
    this.el.classList.add('merge-ready');
  }

  exitMergeReady() {
    this.el.classList.remove('merge-ready');
  }
}

// ─────────────────────────────────────────────
// 磁吸合并检测
// ─────────────────────────────────────────────
const MERGE_RADIUS = 90; // px
let _mergePreview: HTMLElement | null = null;

// MergeCandidate：统一接口，覆盖 Manifestation 和 MergedBubble
interface MergeCandidate {
  el:              HTMLElement;
  center:          { x: number; y: number };
  enterMergeReady: () => void;
  exitMergeReady:  () => void;
  // 提取所有子节点 Manifestation（用于重组融合体）
  flatChildren:    () => Manifestation[];
  semanticTags:    () => string[];
}

// Manifestation 包装为 MergeCandidate
function wrapManifestation(m: Manifestation): MergeCandidate {
  return {
    el:              m.el,
    center:          m.center,
    enterMergeReady: () => m.enterMergeReady(),
    exitMergeReady:  () => m.exitMergeReady(),
    flatChildren:    () => [m],
    semanticTags: () => m.semanticTags,
  };
}

// MergedBubble 包装为 MergeCandidate（携带所有子节点）
function wrapMergedBubble(mb: MergedBubble): MergeCandidate {
  return {
    el:     mb.el,
    center: {
      x: mb.el.getBoundingClientRect().left + mb.el.offsetWidth  / 2,
      y: mb.el.getBoundingClientRect().top  + mb.el.offsetHeight / 2,
    },
    enterMergeReady: () => { mb.el.classList.add('merge-ready'); },
    exitMergeReady:  () => { mb.el.classList.remove('merge-ready'); },
    flatChildren:    () => mb.children,
    semanticTags:    () => (mb.el.dataset.semantic ?? '').split(',').filter(Boolean),
  };
}

let _mergeTargetCandidate: MergeCandidate | null = null;

function checkMergeProximity(dragged: Manifestation) {
  const dc = dragged.center;

  // 收集所有可融合候选（Manifestation + MergedBubble）
  const candidates: MergeCandidate[] = [
    ...manifestationPool.all()
      .filter(m => m !== dragged && m.state !== 'hidden' && m.state !== 'dissolving')
      .map(wrapManifestation),
    ...manifestationPool.allMerged()
      .map(wrapMergedBubble),
  ];

  let nearest: MergeCandidate | null = null;
  let nearestDist = Infinity;

  for (const c of candidates) {
    const dist = Math.hypot(c.center.x - dc.x, c.center.y - dc.y);
    if (dist < MERGE_RADIUS && dist < nearestDist) {
      nearest = c; nearestDist = dist;
    }
  }

  // 清理旧预览
  if (_mergeTargetCandidate && _mergeTargetCandidate !== nearest) {
    _mergeTargetCandidate.exitMergeReady();
    _mergePreview?.remove(); _mergePreview = null;
    _mergeTargetCandidate = null;
  }

  if (nearest && !_mergeTargetCandidate) {
    _mergeTargetCandidate = nearest;
    nearest.enterMergeReady();
    dragged.enterMergeReady();

    // 磁吸涟漪预览
    const ring = document.createElement('div');
    ring.className = 'merge-preview-ring';
    const r = nearest.el.getBoundingClientRect();
    // 预览圆圈包围目标
    const pad = 14;
    ring.style.cssText = `
      position:fixed; pointer-events:none; z-index:9991;
      left:${r.left - pad}px; top:${r.top - pad}px;
      width:${r.width + pad*2}px; height:${r.height + pad*2}px;
      border-radius:${nearest.el.classList.contains('expanded') ? '24px' : '50%'};
      border:2px solid rgba(100,220,255,.75);
      animation:merge-pulse .5s ease-in-out infinite;`;
    document.body.appendChild(ring);
    _mergePreview = ring;

    // 松手→融合
    const onUp = () => {
      document.removeEventListener('pointerup', onUp);
      if (_mergeTargetCandidate) {
        performMergeGeneric(wrapManifestation(dragged), _mergeTargetCandidate);
        _mergeTargetCandidate.exitMergeReady();
        dragged.exitMergeReady();
        _mergePreview?.remove(); _mergePreview = null;
        _mergeTargetCandidate = null;
      }
    };
    document.addEventListener('pointerup', onUp, { once: true });
  }
}

async function summarizeCluster(children: Manifestation[]): Promise<{ title: string; summary: string; icon: string }> {
  const titles = children.map(c => c.title);
  return {
    icon: '🔮',
    title: titles.join(' + '),
    summary: `聚合了 ${children.length} 个视角：${titles.join(', ')}。详细内容请拆分查看。`
  };
}
// ─────────────────────────────────────────────
// 语义共振融合（Semantic Resonance Merge）
// ─────────────────────────────────────────────
interface SemanticRule {
  tags:   string[];   // 需要包含的语义标签
  result: { icon: string; title: string; description: string };
}

const SEMANTIC_RULES: SemanticRule[] = [
  {
    tags:   ['customer', 'mail'],
    result: { icon: '🤝', title: 'Relationship Intelligence', description: 'Customer × Communication' },
  },
  {
    tags:   ['customer', 'sales'],
    result: { icon: '💡', title: 'Revenue Intelligence', description: 'Customer × Sales' },
  },
  {
    tags:   ['agenda', 'approval'],
    result: { icon: '⚡', title: 'Decision Hub', description: 'Agenda × Authority' },
  },
  {
    tags:   ['knowledge', 'customer'],
    result: { icon: '🧠', title: 'Context Intelligence', description: 'Knowledge × Customer' },
  },
  {
    tags:   ['news', 'sales'],
    result: { icon: '📈', title: 'Market Intelligence', description: 'News × Sales' },
  },
  {
    tags:   ['reflection', 'agenda'],
    result: { icon: '🌀', title: 'Consciousness Loop', description: 'Reflection × Agenda' },
  },
];


function resolveSemanticFromTags(tags: string[]): SemanticRule['result'] | null {
  const tagSet = new Set(tags);
  for (const rule of SEMANTIC_RULES) {
    if (rule.tags.every(t => tagSet.has(t))) {
      return rule.result;
    }
  }
  return null;
}


function resolveSemanticMerge(a: Manifestation, b: Manifestation): SemanticRule['result'] | null {
  const tagsA = (a.el.dataset.semantic ?? '').split(',').filter(Boolean);
  const tagsB = (b.el.dataset.semantic ?? '').split(',').filter(Boolean);
  const combined = [...tagsA, ...tagsB];
  return resolveSemanticFromTags(combined);
}

// performMergeGeneric：支持 Manifestation×Manifestation、Manifestation×MergedBubble
// 以及未来的 MergedBubble×MergedBubble
function performMergeGeneric(draggedC: MergeCandidate, targetC: MergeCandidate) {
  const anchor = targetC.center;

  // 收集所有子节点（展平）
  const allChildren = [
    ...draggedC.flatChildren(),
    ...targetC.flatChildren(),
  ];
  const allTags = [...new Set([
    ...draggedC.semanticTags(),
    ...targetC.semanticTags(),
  ])];

  // 隐藏参与融合的所有元素
  draggedC.el.style.opacity       = '0';
  draggedC.el.style.pointerEvents = 'none';
  targetC.el.style.opacity        = '0';
  targetC.el.style.pointerEvents  = 'none';

  // 液滴融合动画
  const wrapper = document.createElement('div');
  wrapper.className = 'merge-wrapper';
  wrapper.style.cssText = `
    position:fixed; z-index:8500; pointer-events:none;
    left:${anchor.x - 60}px; top:${anchor.y - 60}px;
    width:120px; height:120px;
    filter:url(#metaball);`;

  const d1 = document.createElement('div');
  const d2 = document.createElement('div');
  [d1, d2].forEach((d, i) => {
    d.style.cssText = `
      position:absolute; width:52px; height:52px; border-radius:50%;
      background:rgba(80,160,255,0.85);
      animation:merge-drop${i+1} 0.6s cubic-bezier(.16,1,.3,1) forwards;`;
  });
  wrapper.append(d1, d2);
  document.body.appendChild(wrapper);

  setTimeout(() => {
    wrapper.remove();

    // 如果目标是 MergedBubble，先移除它（子节点回收到 allChildren）
    if (targetC instanceof MergedBubble) {
      manifestationPool.removeMerged(targetC);
    }
    if (draggedC instanceof MergedBubble) {
      manifestationPool.removeMerged(draggedC);
    }

    // 语义共振：基于所有子节点计算
    const semantic = resolveSemanticFromTags(allTags);
    const icon     = semantic?.icon  ?? '🔮';
    const title    = semantic?.title ?? allChildren.map(c => (c as any).opts.icon).join(' ');
    const desc     = semantic?.description ?? `${allChildren.length} perspectives merged`;

    const newMerged = new MergedBubble(allChildren, anchor.x, anchor.y, {
      icon, title, description: desc, semanticTags: allTags,
    });
    manifestationPool.registerMerged(newMerged);

    field.emit('manifestation.merged', {
      count:    allChildren.length,
      semantic: semantic?.title ?? null,
      tags:     allTags,
    });
  }, 650);
}

// 兼容旧调用
function performMerge(dragged: Manifestation, target: Manifestation) {
  performMergeGeneric(wrapManifestation(dragged), wrapManifestation(target));

}

// ─────────────────────────────────────────────
// MergedBubble · 融合显现体
// ─────────────────────────────────────────────
export class MergedBubble {
  el:       HTMLElement;
  children: Manifestation[];
  private clock: LifetimeClock;

  constructor(
    members:  Manifestation[],
    anchorX:  number,
    anchorY:  number,
    meta:     { icon: string; title: string; description: string; semanticTags?: string[] },
  ) {
    this.children = [...members];
    this.el       = document.createElement('div');
    this.el.className  = 'manifestation merged expanded';
    this.el.dataset.merged = '1';
    this.el.dataset.semantic = (meta.semanticTags ?? []).join(',');

    const count = members.length;
    const W = count === 2 ? 640 : count === 3 ? 720 : 800;
    const H = count === 2 ? 480 : count === 3 ? 540 : 600;
    const left = Math.min(window.innerWidth  - W - 8, Math.max(8, anchorX - W / 2));
    const top  = Math.min(window.innerHeight - H - 8, Math.max(8, anchorY - H / 2));

    this.el.style.cssText = `
      left:${left}px; top:${top}px;
      width:${W}px; height:${H}px;`;

    this._build(meta);
    document.body.appendChild(this.el);

    // 拖拽
    const header = this.el.querySelector('.mani-header') as HTMLElement;
    if (header) {
      mountDrag({
        el: this.el, handle: header, comet: true,
        isDragging: v => {
          this.el.style.opacity = v ? '0.88' : '';
          this.el.style.filter  = v ? 'url(#bubble-glow)' : '';
        },
        onDragEnd: () => { this.el.style.opacity = ''; this.el.style.filter = ''; },
      });
    }

    this.clock = new LifetimeClock(60_000, () => this.split());
    this.el.addEventListener('pointerenter', () => this.clock.enter());
    this.el.addEventListener('pointerleave', () => this.clock.leave());
    this.clock.start();

    // 展开动画
    requestAnimationFrame(() => this.el.classList.add('expanded-open'));
    notifyFocusChange(`merged-${Date.now()}`, true);
    refreshHitZones();
  }

  private _build(meta: { icon: string; title: string; description: string }) {
    // 头部
    const header = document.createElement('div');
    header.className = 'mani-header merged-header';
    header.innerHTML = `
  <div class="merged-icons">
    ${this.children.map(c => `<span class="merged-child-icon">${(c as any).opts.icon}</span>`).join('')}
  </div>
      <div>
        <div class="mani-title">${meta.icon} ${meta.title}</div>
        <div style="font-size:10px;color:rgba(100,180,255,.5);margin-top:2px">${meta.description}</div>
      </div>`;

    const controls = document.createElement('div');
    controls.className = 'mani-controls';
    controls.dataset.nodrag = '1';

    const splitBtn = document.createElement('button');
    splitBtn.className   = 'mani-ctrl-btn';
    splitBtn.title       = 'Split perspectives';
    splitBtn.textContent = '⟠';
    splitBtn.style.pointerEvents = 'auto';
    splitBtn.addEventListener('click', e => { e.stopPropagation(); this.split(); });

    const closeBtn = document.createElement('button');
    closeBtn.className   = 'mani-ctrl-btn mani-close';
    closeBtn.textContent = '×';
    closeBtn.style.pointerEvents = 'auto';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); this._dissolve(); });

    controls.append(splitBtn, closeBtn);
    header.appendChild(controls);
    this.el.appendChild(header);

    // 多视角面板（横向排列）
    const body = document.createElement('div');
    body.className = 'merged-body';
    body.style.cssText = `
      flex:1; display:flex; flex-direction:row; overflow:hidden; gap:1px;`;

    this.children.forEach((child, idx) => {
      const pane = document.createElement('div');
      pane.style.cssText = `
      flex:1; overflow-y:auto; padding:14px;
      border-right:${idx < this.children.length - 1 ? '1px solid rgba(100,180,255,.06)' : 'none'};
      scrollbar-width:thin; scrollbar-color:rgba(100,180,255,.1) transparent;`;
      
      const sub = document.createElement('div');
      sub.style.cssText = `font-size:10px;letter-spacing:.08em;
      color:rgba(120,180,255,.4);text-transform:uppercase;margin-bottom:8px;`;      
      sub.textContent = `${child.icon} ${child.title}`;
      pane.appendChild(sub);
      pane.appendChild(child.getManifestationOptions().content());
      body.appendChild(pane);
    });

    this.el.appendChild(body);

    // Resize
    const rh = document.createElement('div');
    rh.className = 'mani-resize';
    this.el.appendChild(rh);
    mountResize(this.el, rh);
  }

  split() {
    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;

    this.children.forEach((child, idx) => {
      const angle = (idx / this.children.length) * Math.PI * 2 - Math.PI / 2;
      const tx = cx + Math.cos(angle) * 100 - 26;
      const ty = cy + Math.sin(angle) * 100 - 26;
      child.el.style.left = `${Math.min(window.innerWidth - 60, Math.max(8, tx))}px`;
      child.el.style.top  = `${Math.min(window.innerHeight - 60, Math.max(8, ty))}px`;
      child.el.style.opacity = '1';
      child.el.style.pointerEvents = '';
      child.appear();
    });

    field.emit('manifestation.split', { count: this.children.length });
    this.clock.clearAll();
    this.el.remove();
    refreshHitZones();
  }

  private _dissolve() {
    this.clock.clearAll();
    this.children.forEach(c => {
      c.el.style.opacity = '1';
      c.el.style.pointerEvents = '';
    });
    this.el.classList.add('dissolving');
    setTimeout(() => this.el.remove(), 600);
    refreshHitZones();
  }
}

// ─────────────────────────────────────────────
// ManifestationPool（Field 驱动，全局单例）
// ─────────────────────────────────────────────
class ManifestationPool {
  private pool    = new Map<string, Manifestation>();
  private merged  = new Set<MergedBubble>();

  constructor() {
    ensureMetaBallFilter();

    field.observe('manifestation.spawn', e => this._onSpawn(e.payload as ManifestationOptions));
    field.observe('manifestation.notify', e => this.pool.get((e.payload as any).id)?.notify());
    field.observe('manifestation.expand', e => this.pool.get((e.payload as any).id)?.expand());
    field.observe('manifestation.collapse', e => this.pool.get((e.payload as any).id)?.collapse());
    field.observe('manifestation.request', e => {
      const { id, level } = e.payload as { id: string; level: string };
      const m = this.pool.get(id);
      if (!m) return;
      if (level === 'full') m.expand();
      if (level === 'bubble') m.collapse();
      if (level === 'hidden') m.vanish();
    });

    field.observe('field.bubbles.show', () => {
      this.pool.forEach(m => {
        if (m.state === 'hidden') {
          m.appear();
          m.bubbleClock.clearAll();
          m.expandedClock.clearAll();
        }
      });
    });

    field.observe('field.bubbles.hide', () => {
      this.pool.forEach(m => m.vanish());
    });

    field.observe('client.update', e => this._updateDynamic('client', e.payload));
    field.observe('sales.update', e => this._updateDynamic('sales', e.payload));
    field.observe('knowledge.update', e => this._updateDynamic('knowledge', e.payload));

    // ✅ 投影指令监听（正确位置）
    field.observe('projection.instruction', (event) => {
      const instruction = event.payload as ProjectionInstruction;
      const { id, action, level, priority, payload } = instruction;
      let bubble = this.pool.get(id);

      if (!bubble && (action === 'create' || action === 'update')) {
        console.log(`[Manifestation] 动态创建气泡: ${id}`);
        field.emit('manifestation.spawn', {
          id,
          icon: '🔮',
          title: id.toUpperCase(),
          content: () => document.createElement('div'),
          bubbleLifeMs: 0,
          expandedLifeMs: 0,
        });
        bubble = this.pool.get(id);
      }

      if (!bubble) return;

      if (payload) {
        let contentFactory: () => HTMLElement;
        if (id === 'client') contentFactory = () => buildClientContent(payload);
        else if (id === 'sales') contentFactory = () => buildSalesContent(payload);
        else if (id === 'knowledge') contentFactory = () => buildKnowledgeContent(payload);
        else if (id === 'weather') contentFactory = () => buildWeatherContent(payload.text, payload.city);
        else {
          contentFactory = () => {
            const el = document.createElement('div');
            el.className = 'mod-section';
            el.innerHTML = `<pre style="padding:8px;font-size:12px;">${typeof payload === 'object' ? JSON.stringify(payload, null, 2) : payload}</pre>`;
            return el;
          };
        }
        bubble.updateContent(contentFactory);
      }

      if (level === 'expanded') bubble.expand();
      else if (level === 'bubble') bubble.collapse();
      else if (level === 'hidden') bubble.vanish();

      if (priority > 0.8) {
        bubble.el.classList.add('high-priority-resonance');
        bubble.el.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.6)';
      } else {
        bubble.el.classList.remove('high-priority-resonance');
      }

      if (typeof (window as any).refreshAllHitZones === 'function') {
        (window as any).refreshAllHitZones();
      }
    });
  }


  private _onSpawn(opts: ManifestationOptions) {
    if (this.pool.has(opts.id)) {
      this.pool.get(opts.id)!.notify();
      return;
    }
    const m = new Manifestation(opts);
    this.pool.set(opts.id, m);
  }

  private _updateDynamic(id: string, data: any) {
    const m = this.pool.get(id);
    if (!m) return;
    // 更新 content factory 并刷新展开态内容
    const prev = (m as any).opts;
    if (id === 'client') {
      (m as any).opts.content = () => buildClientContent(data);
      (m as any).opts.description = (data as any)?.name ?? 'Customer';
    } else if (id === 'sales') {
      (m as any).opts.content = () => buildSalesContent(data);
      (m as any).opts.description = (data as any)?.month ?? 'Report';
    } else if (id === 'knowledge') {
      (m as any).opts.content = () => buildKnowledgeContent(data);
    }
    if (m.state === 'expanded') {
      const body = m.el.querySelector('.mani-body');
      if (body) {
        body.innerHTML = '';
        body.appendChild((m as any).opts.content());
      }
    }
  }

  registerMerged(mb: MergedBubble) { this.merged.add(mb); }

  get(id: string)  { return this.pool.get(id); }
  all()            { return Array.from(this.pool.values()); }
  centers()        { return Array.from(this.pool.values()).map(m => m.center); }
  
  
  allMerged(): MergedBubble[] {
    return Array.from(this.merged);
  }

  removeMerged(mb: MergedBubble) {
    this.merged.delete(mb);
  }
}

export const manifestationPool = new ManifestationPool();

// ─────────────────────────────────────────────
// 动态气泡内容构建函数（由 ritual.ts 调用）
// ─────────────────────────────────────────────
export function buildClientContent(v: any): HTMLElement {
  const el = document.createElement('div');
  const orders = (v?.recentOrders ?? v?.orders ?? []).slice(0, 6);
  el.innerHTML = `
    <div class="mod-section">
      <div style="display:flex;align-items:center;gap:12px;padding:12px;
          background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:10px">
        <div style="width:44px;height:44px;border-radius:50%;
            background:linear-gradient(135deg,rgba(80,130,255,.4),rgba(140,80,255,.4));
            display:flex;align-items:center;justify-content:center;
            font-size:18px;font-weight:700;color:rgba(200,220,255,.9)">
          ${(v?.name?.[0] ?? '?').toUpperCase()}
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;color:rgba(220,235,255,.95)">${v?.name ?? '–'}</div>
          <div style="font-size:11px;color:rgba(140,170,220,.6)">${v?.country ?? ''} ${v?.city ? '· ' + v.city : ''}</div>
        </div>
      </div>
      <div class="mod-row"><span class="mod-row-icon">📧</span>
        <div class="mod-row-text"><div class="mod-row-title">${v?.email ?? '–'}</div></div></div>
      <div class="mod-row"><span class="mod-row-icon">📞</span>
        <div class="mod-row-text"><div class="mod-row-title">${v?.phone ?? '–'}</div></div></div>
      <div class="mod-row"><span class="mod-row-icon">💰</span>
        <div class="mod-row-text">
          <div class="mod-row-title">$${(v?.totalRevenue ?? 0).toLocaleString()}</div>
          <div class="mod-row-sub">${v?.orderCount ?? 0} orders · ${v?.metrics?.valueLevel ?? '–'}</div>
        </div></div>
    </div>
    ${orders.length ? `<div class="mod-section"><div class="mod-label">Orders</div>
      ${orders.map((o: any) => `
        <div class="mod-row"><span class="mod-row-icon">📦</span>
          <div class="mod-row-text">
            <div class="mod-row-title">${(o.product ?? o.orderNo ?? '').slice(0, 42)}</div>
            <div class="mod-row-sub">${o.date ?? ''} · $${o.amount ?? 0}</div>
          </div></div>`).join('')}
    </div>` : ''}`;
  return el;
}

export function buildSalesContent(r: any): HTMLElement {
  const el = document.createElement('div');
  const products = (r?.products ?? []).slice(0, 6);
  el.innerHTML = `
    <div class="mod-section">
      <div class="mod-label">Monthly Report · ${r?.month ?? ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        ${[
          ['$' + (r?.totalRevenue ?? 0).toLocaleString(), 'Revenue'],
          [r?.totalOrders ?? 0, 'Orders'],
          [r?.uniqueCustomers ?? 0, 'Customers'],
          [(r?.products ?? []).length, 'Products'],
        ].map(([v, l]) => `
          <div style="padding:10px;background:rgba(255,255,255,.04);border-radius:10px;text-align:center">
            <div style="font-size:18px;font-weight:700;color:rgba(220,235,255,.95)">${v}</div>
            <div style="font-size:10px;color:rgba(140,170,220,.5);margin-top:3px">${l}</div>
          </div>`).join('')}
      </div>
    </div>
    ${products.length ? `<div class="mod-section"><div class="mod-label">Product Breakdown</div>
      ${products.map((p: any) => `
        <div class="mod-row"><span class="mod-row-icon">📦</span>
          <div class="mod-row-text">
            <div class="mod-row-title">${(p.name ?? '').slice(0, 42)}</div>
            <div class="mod-row-sub">${p.units ?? 0} units · $${(p.revenue ?? 0).toLocaleString()}</div>
          </div></div>`).join('')}
    </div>` : ''}`;
  return el;
}

export function buildKnowledgeContent(data: any): HTMLElement {
  const raw     = data?.text ?? data?.raw ?? '';
  const cleaned = raw
    .replace(/â€™/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"')
    .replace(/Â©/g, '©').replace(/Â /g, ' ')
    .replace(/\r\n/g, '\n').trim();
  const lines   = cleaned.split('\n').map((l: string) => l.trim()).filter(Boolean);
  const title   = lines.find((l: string) => l.startsWith('# '))?.replace(/^#+\s*/, '') ?? 'Knowledge';
  const bullets = lines.filter((l: string) => l.match(/^[-*•]/)).slice(0, 10)
    .map((b: string) => b.replace(/^[-*•]\s*/, ''));

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="mod-section">
      <div style="font-size:14px;font-weight:600;color:rgba(220,235,255,.95);margin-bottom:10px">
        📄 ${title}
      </div>
      ${bullets.length ? `
        <div style="display:flex;flex-direction:column;gap:5px">
          ${bullets.map((b: any) => `
            <div style="display:flex;gap:8px;padding:6px 10px;
                background:rgba(255,255,255,.04);border-radius:8px;
                font-size:12.5px;color:rgba(195,218,255,.85)">
              <span style="color:rgba(100,180,255,.6);flex-shrink:0">•</span>
              <span>${b}</span>
            </div>`).join('')}
        </div>` : ''}
    </div>
    <div class="mod-section">
      <button class="mod-action-btn" style="font-size:11px;padding:5px 12px" id="kb-raw-btn">
        📄 Show full document
      </button>
      <pre id="kb-raw" style="display:none;margin-top:8px;padding:10px;
          background:rgba(0,0,0,.25);border-radius:8px;
          font-size:10px;color:rgba(140,170,220,.5);
          white-space:pre-wrap;word-break:break-word;
          max-height:200px;overflow-y:auto">
        ${cleaned.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 4000)}
      </pre>
    </div>`;
  setTimeout(() => {
    el.querySelector('#kb-raw-btn')?.addEventListener('click', () => {
      const d = el.querySelector('#kb-raw') as HTMLElement;
      if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
    });
  }, 50);
  return el;
}