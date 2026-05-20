// apps/dashboard/presence.ts
// ══════════════════════════════════════════════════════════
//   Presence · 意识场存在感管理
//   负责监测用户与界面交互的状态，并通知 manifestation 模块调整表现
// ══════════════════════════════════════════════════════════   
import { field} from './field';

let hovering = false;

export function initPresence() {
  console.log('[Presence] initialized');

  window.addEventListener('mousemove', (e) => {
    const target = e.target as HTMLElement | null;

    if (!target) return;

    const interactive = target.closest('[data-interactive]');

    if (interactive && !hovering) {
      hovering = true;

      field.emit('manifestation.expand', {
        reason: 'hover',
      }, 'presence');
    }

    if (!interactive && hovering) {
      hovering = false;

      field.emit('manifestation.collapse', {
        reason: 'leave',
      }, 'presence');
    }
  });
}