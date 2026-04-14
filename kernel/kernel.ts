// kernel/kernel.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Kernel
// Thin accessors over the bootstrapped OS.
// Use bootstrapGlide() to start. Use getOS() / helpers to access.
// ─────────────────────────────────────────────────────────────

// kernel/kernel.ts
export { bootstrapGlide, getOS } from './bootstrap';
export type { GlideOS }          from './bootstrap';

import { getOS } from './bootstrap';

export const getEventBus   = () => getOS().eventBus;
export const getDispatcher = () => getOS().dispatcher;
export const getRegistry   = () => getOS().registry;
export const getContext    = () => getOS().context;
export const getPolicyEngine = () => getOS().policyEngine;
export const getEventLifecycleManager = () => getOS().eventLifecycleManager;