// cognition/diagnostics/ui-log.ts

export interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  time: number;
}

type Listener = (event: LogEvent) => void;

const listeners: Listener[] = [];

export function onLog(listener: Listener) {
  listeners.push(listener);
}

function emit(level: LogEvent['level'], message: string) {
  const event: LogEvent = {
    level,
    message,
    time: Date.now(),
  };

  // console output
  console[level](message);

  // notify subscribers (UI / Dashboard / Kernel)
  for (const l of listeners) {
    try {
      l(event);
    } catch {}
  }
}

export const log = {
  info: (msg: string) => emit('info', msg),
  warn: (msg: string) => emit('warn', msg),
  error: (msg: string) => emit('error', msg),
};

export function renderTimelineLogs(timeline: any) {
  if (!timeline?.steps?.length)
    return 'No execution timeline available.';

  return timeline.steps
    .map((step: any, idx: number) => {
      const lines: string[] = [];

      lines.push(`🛠 Step ${idx + 1}: ${step.skill}`);

      if (step.thoughtBefore)
        lines.push(`💭 Thought before: ${step.thoughtBefore}`);

      lines.push(
        `📥 Input: ${JSON.stringify(step.input, null, 2)}`
      );

      lines.push(`⏱ Duration: ${step.duration} ms`);

      lines.push(
        `📤 Output: ${JSON.stringify(step.output, null, 2)}`
      );

      if (step.thoughtAfter)
        lines.push(`💡 Thought after: ${step.thoughtAfter}`);

      lines.push('--------------------------------------------------');

      return lines.join('\n');
    })
    .join('\n');
}