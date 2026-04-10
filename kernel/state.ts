export type KernelState =
  | 'IDLE'
  | 'THINKING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'REFLECTING';

class KernelStateManager {
  private state: KernelState = 'IDLE';

  set(state: KernelState) {
    this.state = state;
    console.log(`[KernelState] → ${state}`);
  }

  get() {
    return this.state;
  }

  isBusy() {
    return this.state !== 'IDLE';
  }
}

export const kernelState = new KernelStateManager();

export const kernelActivity = {
  lastActivity: Date.now(),

  touch() {
    this.lastActivity = Date.now();
  },

  isStalled(timeout = 30000) {
    return Date.now() - this.lastActivity > timeout;
  }
};
