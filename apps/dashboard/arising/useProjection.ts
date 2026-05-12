// apps/dashboard/arising/useProjection.ts
//
// The single hook that drives Observer Collapse for all UI components.
//
// Previously each panel had its own filter logic on raw events[].
// Now there is ONE observation act, producing ONE reality projection.
// All panels read from this projection — never from raw events directly.
//
// Architecture:
//   useEventStream → events[] → useProjection → RealityProjection
//                                                      ↓
//                                          ConsciousPanel (reads cognitive)
//                                          AgendaPanel    (reads agenda)
//                                          AuthorityPanel (reads proposals)
//                                          ReflectionPanel(reads reflections)

import { useMemo } from 'react';
import { UIEvent } from '../events/events';
import { collapseReality, RealityProjection } from '../projections/projection-observer';

export function useProjection(events: readonly UIEvent[]): RealityProjection {
  // collapseReality is a pure function — useMemo ensures it only runs
  // when the events array reference changes (i.e., on each new event).
  // No loops. No timers. Collapse happens exactly once per event arrival.
  return useMemo(() => collapseReality(events), [events]);
}
