// apps/dashboard/hooks/useEventStream.ts
// ─────────────────────────────────────────────────────────────
// Thin re-export of useGlide for components that just need
// the event list (EventViewer, LogsTab, OperationsTab).
//
// Keeps backward compatibility — no changes needed in those components.
// ─────────────────────────────────────────────────────────────

export { useGlide as useEventStream } from './useGlide';
export type { UIEvent, EventFilter, ReplaySession } from './useGlide';
