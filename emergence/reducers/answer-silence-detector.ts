// runtime/capability/answer-silence-detectors.ts

import { EventBus } from '../../kernel/event-bus/event-bus'

export class AnswerSilenceDetector {

  private timers = new Map<string, any>()

  constructor(private bus: EventBus) {}

  start() {
    
    this.bus.on('skill.fragment', (e: any) => {    
      
      const taskId = e.trace?.taskId;
      
      if (!taskId) return;

      if (this.timers.has(taskId)) {
        clearTimeout(this.timers.get(taskId))
      }

      const timer = setTimeout(() => {

        this.bus.emitEvent(
          'task.silent_complete',
          { taskId },
          'RUNTIME',
          taskId
        )

      }, 1200)

      this.timers.set(taskId, timer)
    })

    this.bus.on('task.completed', (e: any) => {
      const id = e.trace?.taskId
      if (!id) return
      this.timers.delete(id)
    })
  }
}