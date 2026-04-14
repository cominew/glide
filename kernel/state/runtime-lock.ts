// kernel/state/runtime-lock.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Runtime Locks
// Prevents concurrent access to critical execution sections.
// ─────────────────────────────────────────────────────────────

class RuntimeLock {
  private locked = false;

  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}

export const runtimeLocks: Record<string, RuntimeLock> = {
  llm:        new RuntimeLock(),
  reflection: new RuntimeLock(),
  planning:   new RuntimeLock(),
};

// Named exports for convenience
export const llmLock        = runtimeLocks.llm;
export const reflectionLock = runtimeLocks.reflection;
export const planningLock   = runtimeLocks.planning;
