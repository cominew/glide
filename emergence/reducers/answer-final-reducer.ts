// runtime/capability/answer-final-reducer.ts

import { EventBus } from '../../kernel/event-bus/event-bus'

export class AnswerFinalReducer {

  private buffer = new Map<string, any[]>()

  constructor(private bus: EventBus) {}

  start() {

    this.bus.on('skill.output', (e: any) => {

      const taskId = e.trace?.taskId
      if (!taskId) return

      if (!this.buffer.has(taskId)) {
        this.buffer.set(taskId, [])
      }

      this.buffer.get(taskId)!.push(e.payload.output)
    })

    this.bus.on('task.silent_complete', (e: any) => {

      const taskId = e.payload.taskId
      const outputs = this.buffer.get(taskId) || []

      const final =
        outputs.length === 0 ? null :
        outputs.length === 1 ? outputs[0] :
        outputs

      this.bus.emitEvent(
        'answer.final',
        { result: final },
        'RUNTIME',
        taskId
      )

      this.bus.emitEvent(
        'task.completed',
        { taskId },
        'RUNTIME',
        taskId
      )

      this.buffer.delete(taskId)
    })
  }
}