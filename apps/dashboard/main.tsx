import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

async function boot() {
  // 优先使用注入的全局变量，其次 URL 参数，最后默认为 pet
  let mode: 'pet' | 'dashboard' = 'pet';
  if ((window as any).__GLIDE_MODE === 'dashboard') {
    mode = 'dashboard';
  } else {
    const params = new URLSearchParams(location.search);
    mode = params.get('mode') === 'dashboard' ? 'dashboard' : 'pet';
  }

  console.log('[Main] mode:', mode);
  document.body.classList.add(`mode-${mode}`);

  if (mode === 'dashboard') {
    const { default: App } = await import('./App');
    const root = document.getElementById('root');
    if (root) {
      createRoot(root).render(
        <StrictMode><App /></StrictMode>
      );
    }
  } else {
    await import('./ritual');
  }

  document.body.classList.add('ready');
}

boot().catch(err => {
  console.error('[Glide] Boot failed:', err);
  document.body.classList.add('ready');
});