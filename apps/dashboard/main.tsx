// apps/dashboard/main.tsx
// Vite 唯一入口
// pet 模式     → import ritual.ts（纯 DOM）
// dashboard 模式 → 渲染 React App

import { StrictMode } from 'react';
import { createRoot }  from 'react-dom/client';

console.log('URL search:', window.location.search);
const MODE = new URLSearchParams(window.location.search).get('mode') === 'dashboard'
  ? 'dashboard' : 'pet';

// 立即加 mode class（同步，CSS 即时生效）
document.body.classList.add(`mode-${MODE}`);

async function boot() {
  if (MODE === 'dashboard') {
    const { default: App } = await import('./App');
    const root = document.getElementById('root');
    if (root) {
      createRoot(root).render(
        <StrictMode><App /></StrictMode>
      );
    }
  } else {
    // pet 模式：ritual.ts 用 initIfReady() 处理 DOM ready 竞态
    await import('./ritual');
  }
  // 无论成功失败都显示界面
  document.body.classList.add('ready');
}

boot().catch(err => {
  console.error('[Glide] Boot failed:', err);
  document.body.classList.add('ready');
});