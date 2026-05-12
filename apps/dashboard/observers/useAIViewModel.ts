import { useMemo } from 'react';
import { UIEvent } from '../events/events';

export function useAIViewModel(events: UIEvent[], taskId?: string) {

  const taskEvents = useMemo(() => {
    if (!taskId) return [];
    return events.filter(e => e.taskId === taskId);
  }, [events, taskId]);

  const answer = useMemo(() => {
    const ready = [...events]
      .reverse()
      .find(e => e.type === 'answer.ready' && (!taskId || e.taskId === taskId));

    const fragments = ready?.payload?.fragments ?? [];
    return fragments.find((x:any)=>x.name==='final.answer')?.value ?? '';
  }, [events, taskId]);

  const skills = useMemo(() => {
    return []; // or pure extraction from metadata only
  }, []);

  const isThinking = useMemo(() => {
    return taskEvents.length > 0 &&
      !events.some(e => e.type === 'answer.ready' && e.taskId === taskId);
  }, [events, taskEvents, taskId]);

  return {
    taskEvents,
    answer,
    isThinking,
    skills
  };
}