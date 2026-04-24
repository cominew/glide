export class TaskQueue {
  private q: any[] = []

  push(t: any) {
    this.q.push(t)
  }

  pop() {
    return this.q.shift()
  }
}