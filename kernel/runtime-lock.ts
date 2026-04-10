class RuntimeLock {
  private locked = false;

  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release() {
    this.locked = false;
  }

  isLocked() {
    return this.locked;
  }
}

export const runtimeLock = new RuntimeLock(); 