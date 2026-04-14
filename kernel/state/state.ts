// kernel/state/state.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Kernel State
// Tracks the high-level operating state of the kernel.
// Read by ConsciousLoop, Scheduler, and diagnostics.
// ─────────────────────────────────────────────────────────────

export type KernelState =
  | 'IDLE'
  | 'THINKING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'REFLECTING';

class KernelStateManager {
  private state: KernelState = 'IDLE';
  private updatedAt = Date.now();

  set(next: KernelState): void {
    this.state     = next;
    this.updatedAt = Date.now();
    console.log(`[KernelState] → ${next}`);
  }

  get(): KernelState {
    return this.state;
  }

  isSystemBusy(): boolean {
    return this.state !== 'IDLE';
  }

  timeSinceUpdate(): number {
    return Date.now() - this.updatedAt;
  }
}

export const kernelState = new KernelStateManager();

// ── Activity tracker ──────────────────────────────────────────

export const kernelActivity = {
  lastActivity: Date.now(),

  touch(): void {
    this.lastActivity = Date.now();
  },

  isStalled(timeoutMs = 30_000): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  },

  idleMs(): number {
    return Date.now() - this.lastActivity;
  },
};
