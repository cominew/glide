// apps/dashboard/manifestation.ts
// ══════════════════════════════════════════════════════════
//   Manifestation · 显现体
//
//   核心哲学：不察则无（由系统空闲事件驱动生命周期，无主动计时器）
//
//   存在三态：
//     hidden   → 寂灭
//     bubble   → 气泡（52px 圆，单击展开）
//     expanded → 展开（可调整大小，标题栏拖拽）
//
//   生命周期：
//     system.idle 事件 → 无任何交互时自动收缩/消隐
//
//   穿透：
//     每次状态变化调用 window.__glide_refreshHitZones()
//     Rust 50ms 轮询热区，自动切换 setIgnoreCursorEvents
//
//   注意力主次：
//     一个展开时，其他气泡 dim（半透明缩小）
//
//   BubbleMerge · 水珠融合系统
//
//   哲学基础：
//     气泡 = 因果事件的空间显现
//     融合 = 多个事件因缘聚合，坍缩为新的复合显现体
//     拆分 = 复合显现体因缘散去，各自回归独立气泡
//
//   交互：
//     拖拽气泡靠近另一气泡（距离 < MERGE_RADIUS）→ 磁吸预览
//     松手 → 融合完成，产生 manifestation.merged 事件
//     融合体右上角「拆」按钮 → 各子气泡原位弹出
// ══════════════════════════════════════════════════════════

import { field } from './field';

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const MERGE_RADIUS = 120; // 像素，两气泡中心距离小于此值触发融合
const MERGE_DURATION = 300; // ms，融合动画时长

// ─────────────────────────────────────────────
// 接口定义
// ─────────────────────────────────────────────
export interface ManifestationOptions {
  id: string;
  icon: string;
  title: string;
  description?: string;
  content: () => HTMLElement;
  x?: number;
  y?: number;
  w?: number; // 展开宽度，默认 380
  h?: number; // 展开高度，默认 460
}

// 融合体尺寸
function mergedSize(count: number): { w: number; h: number; radius: string } {
  if (count === 2) return { w: 320, h: 400, radius: '24px' };
  if (count === 3) return { w: 460, h: 500, radius: '22px' };
  return { w: 640, h: 600, radius: '20px' }; // 4+
}

// ─────────────────────────────────────────────
// 全局注意力状态
// ─────────────────────────────────────────────
let expandedId: string | null = null;

function notifyFocusChange(id: string | null) {
  expandedId = id;
  field.emit('manifestation.focus.changed', { id });
}

// ─────────────────────────────────────────────
// 热区上报
// ─────────────────────────────────────────────
function refreshHitZones() {
  const fn = (window as any).__glide_refreshHitZones;
  if (typeof fn === 'function') fn();
}

// ─────────────────────────────────────────────
// ResizeObserver + MutationObserver 自动热区刷新
// ─────────────────────────────────────────────
function startAutoRefresh() {
  const obs = new ResizeObserver(() => refreshHitZones());
  obs.observe(document.body);
  const mo = new MutationObserver(() => refreshHitZones());
  mo.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class', 'style'] });
  // 初始化立即刷新一次
  refreshHitZones();
}
setTimeout(startAutoRefresh, 100); // 等待 DOM 稳定

// ─────────────────────────────────────────────
// 拖拽引擎（drag/click 互斥，4px 阈值）
// ─────────────────────────────────────────────
export function mountDrag(opts: {
  el: HTMLElement;
  handle?: HTMLElement;
  onDragStart?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  isDragging?: (v: boolean) => void;
}) {
  const { el, onDragStart, onDragEnd, isDragging } = opts;
  const handle = opts.handle ?? el;
  let active = false,
    moved = false;
  let sx = 0,
    sy = 0,
    ox = 0,
    oy = 0;
  const THRESH = 4;

  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button,input,textarea,select,a,[data-nodrag],.mani-resize')) return;
    active = false;
    moved = false;
    sx = e.clientX;
    sy = e.clientY;
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function onMove(e: PointerEvent) {
    if (!active && Math.hypot(e.clientX - sx, e.clientY - sy) > THRESH) {
      active = true;
      moved = true;
      el.style.transition = 'none';
      el.classList.add('dragging');
      isDragging?.(true);
      onDragStart?.();
    }
    if (!active) return;
    const x = Math.min(window.innerWidth - el.offsetWidth, Math.max(0, e.clientX - ox));
    const y = Math.min(window.innerHeight - el.offsetHeight, Math.max(0, e.clientY - oy));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    refreshHitZones(); // 拖动时持续更新热区
  }

  function onUp() {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    if (active) {
      el.classList.remove('dragging');
      requestAnimationFrame(() => {
        el.style.transition = '';
      });
      isDragging?.(false);
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
// Resize 句柄（右下角）
// ─────────────────────────────────────────────
function mountResize(el: HTMLElement, handle: HTMLElement) {
  let active = false,
    sx = 0,
    sy = 0,
    sw = 0,
    sh = 0;
  const MIN_W = 260,
    MIN_H = 180;
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    sw = el.offsetWidth;
    sh = el.offsetHeight;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!active) return;
    const r = el.getBoundingClientRect();
    el.style.width = `${Math.min(Math.max(MIN_W, sw + e.clientX - sx), window.innerWidth - r.left - 8)}px`;
    el.style.height = `${Math.min(Math.max(MIN_H, sh + e.clientY - sy), window.innerHeight - r.top - 8)}px`;
    refreshHitZones();
  });
  handle.addEventListener('pointerup', () => {
    active = false;
  });
}

// ─────────────────────────────────────────────
// 融合体类（MergedBubble）
// ─────────────────────────────────────────────
export class MergedBubble {
  el: HTMLElement;
  children: Manifestation[];
  private mergeId: string;
  private idleUnsubscribe?: () => void; // 用于取消 system.idle 监听

  constructor(members: Manifestation[], anchorX: number, anchorY: number) {
    this.children = [...members];
    this.mergeId = `merged_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.el = document.createElement('div');
    this.el.className = 'manifestation merged-bubble expanded';
    this.el.dataset.merged = '1';
    this.el.dataset.mergeId = this.mergeId;

    const { w, h, radius } = mergedSize(members.length);
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, anchorX - w / 2));
    const top = Math.min(window.innerHeight - h - 8, Math.max(8, anchorY - h / 2));

    this.el.style.cssText = `
      width: ${w}px; height: ${h}px;
      left: ${left}px; top: ${top}px;
      border-radius: ${radius};
      transition: all ${MERGE_DURATION}ms cubic-bezier(0.2, 0.9, 0.4, 1.1);
    `;

    this._buildDOM();
    document.body.appendChild(this.el);

    // 融合体可整体拖拽（标题区）
    const header = this.el.querySelector('.merged-header') as HTMLElement;
    if (header) mountDrag({ el: this.el, handle: header });

    // 监听系统空闲事件（用于自动拆分）
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => this.split(), 45000);
    };
    this.el.addEventListener('pointerenter', resetTimer);
    this.el.addEventListener('pointerleave', resetTimer);
    resetTimer();

    // 注意：这里使用 field.observe 返回取消函数，不再使用 field.off
    // 但我们实际上不需要在融合体销毁前取消 system.idle 事件，因为融合体消失后 resetTimer 仍然会调用 split，但 split 会检查是否已被移除。
    // 为避免内存泄漏，我们可以在 split 中清理，但这里简单起见，不额外监听全局 system.idle，因为已经有了基于悬停的计时器。
    // 之前代码中 field.observe('system.idle', ...) 并试图 field.off，现将其移除。若需要全局空闲则可由外部统一处理。
    // 这里改为完全由本地悬停计时器驱动自动拆分，更简洁，也避免了 field.off 问题。

    // 通知 Field：融合发生
    field.emit('manifestation.merged', {
      mergeId: this.mergeId,
      ids: members.map((m) => m.opts.id),
      count: members.length,
      pos: { x: left, y: top },
    });

    refreshHitZones();
  }

  private _buildDOM() {
    this.el.innerHTML = '';

    // 融合头部：显示所有子珠图标 + 拆分按钮
    const header = document.createElement('div');
    header.className = 'merged-header';
    header.innerHTML = `
      <div class="merged-icons">
        ${this.children.map((c) => `<span class="merged-child-icon">${c.opts.icon}</span>`).join('')}
      </div>
      <span class="merged-title">${this.children.map((c) => c.opts.title).join(' · ')}</span>
    `;

    // 拆分按钮
    const splitBtn = document.createElement('button');
    splitBtn.className = 'merged-split-btn';
    splitBtn.textContent = '⟠ Split';
    splitBtn.dataset.nodrag = '1';
    splitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.split();
    });
    header.appendChild(splitBtn);
    this.el.appendChild(header);

    // 子珠内容区（水平/垂直排列）
    const body = document.createElement('div');
    body.className = 'merged-body';
    body.style.cssText = `
      flex: 1; display: flex;
      flex-direction: ${this.children.length === 2 ? 'row' : 'column'};
      overflow: hidden; gap: 1px;
    `;

    this.children.forEach((child, idx) => {
      const pane = document.createElement('div');
      pane.className = 'merged-pane';
      pane.style.cssText = `
        flex: 1; overflow-y: auto; padding: 12px;
        border-right: ${idx < this.children.length - 1 && this.children.length === 2 ? '1px solid rgba(100,180,255,.06)' : 'none'};
        border-bottom: ${idx < this.children.length - 1 && this.children.length > 2 ? '1px solid rgba(100,180,255,.06)' : 'none'};
        scrollbar-width: thin;
        scrollbar-color: rgba(100,180,255,.12) transparent;
      `;

      // 子珠小标题
      const subTitle = document.createElement('div');
      subTitle.style.cssText = `
        font-size: 10px; letter-spacing: 0.08em;
        color: rgba(120,180,255,.45); text-transform: uppercase;
        margin-bottom: 8px;
      `;
      subTitle.textContent = `${child.opts.icon} ${child.opts.title}`;
      pane.appendChild(subTitle);

      // 子珠内容
      const childContent = child.opts.content();
      pane.appendChild(childContent);
      body.appendChild(pane);
    });

    this.el.appendChild(body);
  }

  // 拆分：各子珠回归独立气泡，原位弹出
  split() {
    // 如果已经移除，直接返回
    if (!this.el.isConnected) return;

    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    // 恢复每个子气泡的位置（围绕融合体中心向外扩散）
    const angleStep = (Math.PI * 2) / this.children.length;
    this.children.forEach((child, idx) => {
      const angle = idx * angleStep;
      const radius = 80;
      const newX = cx + Math.cos(angle) * radius - (child.el.offsetWidth || 52) / 2;
      const newY = cy + Math.sin(angle) * radius - (child.el.offsetHeight || 52) / 2;
      child.el.style.left = `${Math.min(window.innerWidth - 60, Math.max(0, newX))}px`;
      child.el.style.top = `${Math.min(window.innerHeight - 60, Math.max(0, newY))}px`;
      child.el.classList.remove('hidden');
      child._toBubble(); // 确保回到气泡态
    });

    this.el.remove();
    refreshHitZones();
    field.emit('manifestation.split', { mergeId: this.mergeId, ids: this.children.map((c) => c.opts.id) });
  }
}

// ─────────────────────────────────────────────
// Manifestation 类
// ─────────────────────────────────────────────
export class Manifestation {
  el: HTMLElement;
  state: 'hidden' | 'bubble' | 'expanded' = 'hidden';
  opts: ManifestationOptions;
  private _dragging = false;
  private _tooltip: HTMLElement | null = null;

  get center() {
    const r = this.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  constructor(opts: ManifestationOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'manifestation';
    this.el.dataset.id = opts.id;

    const x = opts.x ?? 60 + Math.random() * (window.innerWidth - 200);
    const y = opts.y ?? 60 + Math.random() * (window.innerHeight - 200);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;

    document.body.appendChild(this.el);
    this._toBubble(true);

    // 注意力变化：其他展开时自己淡化
    field.observe('manifestation.focus.changed', (e) => {
      const fid = (e.payload as any)?.id;
      if (this.state === 'bubble') {
        this.el.classList.toggle('dim', !!(fid && fid !== this.opts.id));
      }
    });

    // 监听系统空闲事件，自动消隐
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (this.state === 'bubble') this.vanish();
        else if (this.state === 'expanded') this.collapse();
      }, 30000);
    };
    this.el.addEventListener('pointerenter', resetIdle);
    this.el.addEventListener('pointerleave', resetIdle);
    resetIdle();
  }

  // ── Tooltip ────────────────────────────────
  private _showTooltip() {
    if (!this.opts.description || this.state !== 'bubble') return;
    this._hideTooltip();
    const t = document.createElement('div');
    t.className = 'mani-tooltip';
    t.textContent = `${this.opts.icon} ${this.opts.title}`;
    if (this.opts.description) {
      const sub = document.createElement('div');
      sub.className = 'mani-tooltip-sub';
      sub.textContent = this.opts.description;
      t.appendChild(sub);
    }
    const r = this.el.getBoundingClientRect();
    t.style.left = `${r.left + r.width / 2}px`;
    t.style.top = `${r.top - 8}px`;
    document.body.appendChild(t);
    this._tooltip = t;
  }

  private _hideTooltip() {
    this._tooltip?.remove();
    this._tooltip = null;
  }

  // ── 气泡态 ─────────────────────────────────
  _toBubble(initial = false) {
    this.state = 'bubble';
    this._hideTooltip();
    this.el.className = `manifestation bubble${initial ? ' spawning' : ''}`;
    this.el.innerHTML = '';
    this.el.style.width = this.el.style.height = '';
    this.el.classList.remove('dim');

    const icon = document.createElement('span');
    icon.className = 'mani-bubble-icon';
    icon.textContent = this.opts.icon;
    this.el.appendChild(icon);

    // 悬停 tooltip
    this.el.addEventListener('pointerenter', () => {
      this._showTooltip();
    });
    this.el.addEventListener('pointerleave', () => {
      this._hideTooltip();
    });

    // 单击展开
    const drag = mountDrag({
      el: this.el,
      isDragging: (v) => {
        this._dragging = v;
      },
      onDragEnd: () => {
        // 拖拽结束时检查融合
        checkMerge(this);
      },
    });
    this.el.addEventListener('click', () => {
      if (drag.wasDragged()) return;
      this.expand();
    });

    if (initial) {
      this.el.addEventListener(
        'animationend',
        () => {
          this.el.classList.remove('spawning');
        },
        { once: true }
      );
    }

    refreshHitZones();
  }

  // ── 展开态 ─────────────────────────────────
  private _toExpanded() {
    this._hideTooltip();
    this.state = 'expanded';
    this.el.classList.remove('dim');

    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const W = this.opts.w ?? 380;
    const H = this.opts.h ?? 460;
    const left = Math.min(window.innerWidth - W - 8, Math.max(8, cx - W / 2));
    const top = Math.min(window.innerHeight - H - 8, Math.max(8, cy - H / 2));

    this.el.className = 'manifestation expanded';
    this.el.innerHTML = '';
    this.el.style.width = `${W}px`;
    this.el.style.height = `${H}px`;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;

    // 头部（拖拽手柄）
    const header = document.createElement('div');
    header.className = 'mani-header';
    header.innerHTML = `
      <span class="mani-icon">${this.opts.icon}</span>
      <span class="mani-title">${this.opts.title}</span>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mani-close';
    closeBtn.textContent = '×';
    closeBtn.dataset.nodrag = '1';
    closeBtn.addEventListener('click', () => this.collapse());
    header.appendChild(closeBtn);
    this.el.appendChild(header);

    // 内容
    const body = document.createElement('div');
    body.className = 'mani-body';
    body.appendChild(this.opts.content());
    this.el.appendChild(body);

    // Resize
    const rh = document.createElement('div');
    rh.className = 'mani-resize';
    this.el.appendChild(rh);
    mountResize(this.el, rh);

    // 展开态：标题栏拖拽
    mountDrag({ el: this.el, handle: header, isDragging: (v) => (this._dragging = v) });

    notifyFocusChange(this.opts.id);
    refreshHitZones();
  }

  private _toHidden() {
    this._hideTooltip();
    this.state = 'hidden';
    this.el.classList.add('hidden');
    if (expandedId === this.opts.id) notifyFocusChange(null);
    refreshHitZones();
  }

  // ── 公开 API ────────────────────────────────
  expand() {
    if (this.state !== 'expanded') this._toExpanded();
  }

  collapse() {
    if (this.state === 'bubble') return;
    if (expandedId === this.opts.id) notifyFocusChange(null);
    this._toBubble();
  }

  vanish() {
    this._toHidden();
  }

  appear(withBadge = false) {
    this.el.classList.remove('hidden');
    this._toBubble();
    if (withBadge) {
      const b = document.createElement('div');
      b.className = 'mani-badge';
      b.textContent = '●';
      this.el.appendChild(b);
      setTimeout(() => b.remove(), 5000);
    }
  }

  notify() {
    this.appear(true);
  }

  updateContent(factory: () => HTMLElement) {
    this.opts = { ...this.opts, content: factory };
    if (this.state === 'expanded') {
      const body = this.el.querySelector('.mani-body');
      if (body) {
        body.innerHTML = '';
        body.appendChild(factory());
      }
    }
  }
}

// ─────────────────────────────────────────────
// 磁吸融合检测
// ─────────────────────────────────────────────
function checkMerge(dragged: Manifestation) {
  console.log('[Merge] dragged:', dragged.opts.id, 'state:', dragged.state);
  if (dragged.state !== 'bubble') return;
  const all = manifestationPool.all().filter((m) => m !== dragged && m.state === 'bubble');
  let closest: Manifestation | null = null;
  let minDist = Infinity;
  const draggedCenter = dragged.center;
  for (const m of all) {
    const d = Math.hypot(draggedCenter.x - m.center.x, draggedCenter.y - m.center.y);
    if (d < MERGE_RADIUS && d < minDist) {
      minDist = d;
      closest = m;
    }
  }
  if (closest) {
    // 融合：两个气泡消失，生成 MergedBubble
    const mergeCenter = {
      x: (draggedCenter.x + closest.center.x) / 2,
      y: (draggedCenter.y + closest.center.y) / 2,
    };
    dragged.vanish();
    closest.vanish();
    new MergedBubble([dragged, closest], mergeCenter.x, mergeCenter.y);
    field.emit('manifestation.mergeExecuted', { ids: [dragged.opts.id, closest.opts.id] });
  }
}

// ─────────────────────────────────────────────
// ManifestationPool（Field 驱动，全局单例）
// ─────────────────────────────────────────────
class ManifestationPool {
  private pool = new Map<string, Manifestation>();

  constructor() {
    field.observe('manifestation.spawn', (e) => this._onSpawn(e.payload as ManifestationOptions));
    field.observe('manifestation.notify', (e) => this.pool.get((e.payload as any).id)?.notify());
    field.observe('manifestation.expand', (e) => this.pool.get((e.payload as any).id)?.expand());
    field.observe('manifestation.collapse', (e) => this.pool.get((e.payload as any).id)?.collapse());

    field.observe('manifestation.request', (e) => {
      const { id, level } = e.payload as { id: string; level: string };
      const m = this.pool.get(id);
      if (!m) return;
      if (level === 'full') m.expand();
      if (level === 'bubble') m.collapse();
      if (level === 'hidden') m.vanish();
    });

    // 不察则无：入场后由用户主动召唤，不自动全显
    field.observe('field.bubbles.show', () => {
      this.pool.forEach((m) => {
        if (m.state === 'hidden') m.appear();
      });
    });

    field.observe('field.bubbles.hide', () => {
      this.pool.forEach((m) => m.vanish());
    });

    // 天气内容更新
    field.observe('weather.update', (e) => {
      const { text, city } = e.payload as any;
      const m = this.pool.get('weather');
      if (!m) return;
      m.updateContent(() => buildWeatherContent(text, city));
    });

    // 融合请求（例如从语音命令触发）
    field.observe('manifestation.mergeRequest', (e) => {
      const { ids } = e.payload as { ids: string[] };
      const members = ids.map((id) => this.pool.get(id)).filter((m): m is Manifestation => !!m && m.state === 'bubble');
      if (members.length >= 2) {
        const center = members.reduce((acc, m) => ({ x: acc.x + m.center.x, y: acc.y + m.center.y }), { x: 0, y: 0 });
        center.x /= members.length;
        center.y /= members.length;
        members.forEach((m) => m.vanish());
        new MergedBubble(members, center.x, center.y);
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

  get(id: string) {
    return this.pool.get(id);
  }
  centers() {
    return Array.from(this.pool.values()).map((m) => m.center);
  }
  all() {
    return Array.from(this.pool.values());
  }
}

export const manifestationPool = new ManifestationPool();

// ─────────────────────────────────────────────
// 天气气泡内容构建
// ─────────────────────────────────────────────
function buildWeatherContent(text: string, city: string): HTMLElement {
  const emoji = /^([^\s]+)/.exec(text)?.[1] ?? '🌡';
  const temp = /(\d+)°C/.exec(text)?.[0] ?? '–°C';
  const desc = /·\s*(.+?)(?:\n|$)/.exec(text)?.[1]?.trim() ?? '';
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="text-align:center;padding:20px 0 12px">
      <div style="font-size:52px">${emoji}</div>
      <div style="font-size:30px;color:rgba(200,225,255,.95);margin-top:8px">${temp}</div>
      <div style="font-size:12px;color:rgba(140,170,220,.6);margin-top:4px">${city}</div>
      <div style="font-size:11px;color:rgba(140,170,220,.4);margin-top:2px">${desc}</div>
    </div>
    <div style="padding:10px 14px;background:rgba(255,255,255,.04);border-radius:10px;
                border:1px solid rgba(100,180,255,.07);font-size:12px;
                color:rgba(160,200,255,.7);line-height:1.6">
      ${text.replace(/\*\*/g, '').replace(/\n/g, '<br>')}
    </div>`;
  return el;
}

// ─────────────────────────────────────────────
// 音乐模块内容构建
// ─────────────────────────────────────────────
const MUSIC_PLAYLIST = [
  { name: 'Weight of the World', artist: 'Local Library', src: '/music/Weight_of_the_World.flac' },
  { name: 'Morning Coffee Jazz', artist: 'Local Artist',   src: '/music/morning_jazz.mp3' },
  { name: 'Focus Flow',          artist: 'Studio',         src: '/music/focus_flow.mp3' },
];
let currentTrackIndex = 0;
let currentAudio: HTMLAudioElement | null = null;

function buildMusicModule(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'music-module';
  
  function render() {
    const track = MUSIC_PLAYLIST[currentTrackIndex];
    container.innerHTML = `
      <div class="mod-section">
        <div class="mod-player">
          <div class="mod-player-art">🎵</div>
          <div class="mod-player-info">
            <div class="mod-player-name">${escapeHtml(track.name)}</div>
            <div class="mod-player-artist">${escapeHtml(track.artist)}</div>
            <div class="mod-progress"><div class="mod-progress-bar" id="music-progress-bar"></div></div>
          </div>
        </div>
      </div>
      <div class="mod-section">
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
          <button class="mod-action-btn" id="music-prev">⏮ Previous</button>
          <button class="mod-action-btn" id="music-playpause">⏸ Pause</button>
          <button class="mod-action-btn" id="music-next">⏭ Next</button>
        </div>
      </div>
    `;

    // 绑定事件
    const prevBtn = container.querySelector('#music-prev');
    const playPauseBtn = container.querySelector('#music-playpause');
    const nextBtn = container.querySelector('#music-next');
    
    prevBtn?.addEventListener('click', () => field.emit('music.prev', {}));
    playPauseBtn?.addEventListener('click', () => field.emit('music.toggle', {}));
    nextBtn?.addEventListener('click', () => field.emit('music.next', {}));

    // 更新进度条（可选）
    if (currentAudio && !currentAudio.paused) {
      const progressBar = container.querySelector('#music-progress-bar') as HTMLElement;
      const updateProgress = () => {
        if (currentAudio && currentAudio.duration) {
          const percent = (currentAudio.currentTime / currentAudio.duration) * 100;
          progressBar.style.width = `${percent}%`;
          requestAnimationFrame(updateProgress);
        }
      };
      updateProgress();
    }
  }

  // 播放指定索引的歌曲
  async function playTrack(index: number) {
    if (index < 0) index = MUSIC_PLAYLIST.length - 1;
    if (index >= MUSIC_PLAYLIST.length) index = 0;
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
      render(); // 重新渲染以更新显示和进度条绑定
      audio.addEventListener('ended', () => field.emit('music.next', {}));
    } catch (err) {
      console.error('Playback failed:', err);
    }
  }

  // 监听控制事件
  const unsubPrev = field.observe('music.prev', () => playTrack(currentTrackIndex - 1));
  const unsubNext = field.observe('music.next', () => playTrack(currentTrackIndex + 1));
  const unsubToggle = field.observe('music.toggle', () => {
    if (currentAudio) {
      if (currentAudio.paused) currentAudio.play();
      else currentAudio.pause();
      render(); // 更新按钮文字（可选）
    }
  });

  // 组件销毁时取消监听（可选，manifestation 销毁时需清理，这里简化）
  container.dataset.unsubPrev = unsubPrev.toString();
  container.dataset.unsubNext = unsubNext.toString();
  container.dataset.unsubToggle = unsubToggle.toString();

  // 初始渲染
  render();
  // 如果当前没有播放任何歌曲，自动开始第一首
  if (!currentAudio) playTrack(0);

  return container;
}

// 简单的防XSS辅助函数
function escapeHtml(str: string): string {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}