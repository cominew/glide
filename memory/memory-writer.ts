// memory/memory-writer.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Memory Writer
// Thinking type: EXPERIENTIAL — records completed tasks ONLY.
//
// Invariant: Memory NEVER self-writes. It only writes when it
// receives a 'task.completed' event from an authorized source
// (which must have been approved by Governance).
// ─────────────────────────────────────────────────────────────

import { EventBus } from '../kernel/event-bus/event-bus';
import { Task } from '../kernel/types';
import fs from 'fs';
import path from 'path';

export class MemoryWriter {
    constructor(private eventBus: EventBus, private storagePath: string) {
        this.eventBus.on('task.completed', (event) => this.handleCompletedTask(event.payload));
    }

    private async handleCompletedTask(task: Task) {
        const expDir = path.join(this.storagePath, 'experiences');
        if (!fs.existsSync(expDir)) {
            fs.mkdirSync(expDir, { recursive: true });
        }

        const record = {
            taskId: task.id,
            timestamp: Date.now(),
            intent: task.intent,
            result: task.result,
            metadata: task.metadata,
            policyDecision: task.policyDecision,
        };

        const filename = path.join(expDir, `${task.id}.json`);
        fs.writeFileSync(filename, JSON.stringify(record, null, 2));
        console.log(`[MemoryWriter] Recorded experience for task ${task.id}`);
    }
}