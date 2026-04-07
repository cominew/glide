// runtime/orchestrator/ui-log.ts
export function renderTimelineLogs(timeline: any) {
  if (!timeline?.steps?.length) return 'No execution timeline available.';

  return timeline.steps.map((step: any, idx: number) => {
    const lines: string[] = [];
    lines.push(`🛠 Step ${idx + 1}: ${step.skill}`);
    if (step.thoughtBefore) lines.push(`💭 Thought before: ${step.thoughtBefore}`);
    lines.push(`📥 Input: ${JSON.stringify(step.input, null, 2)}`);
    lines.push(`⏱ Duration: ${step.duration} ms`);
    lines.push(`📤 Output: ${JSON.stringify(step.output, null, 2)}`);
    if (step.thoughtAfter) lines.push(`💡 Thought after: ${step.thoughtAfter}`);
    lines.push('--------------------------------------------------');
    return lines.join('\n');
  }).join('\n');
}